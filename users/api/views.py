# users/api/views.py

import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken
# --- Imports Locaux (Assure-toi que ces fichiers existent) ---
from users.models import User, UserInvitation, CustomRole, UserCustomRole
from users.serializers import (
    UserSerializer, 
    UserListSerializer, 
    SchoolUserCreateSerializer, 
    AcceptInvitationSerializer,
    CustomRoleSerializer,
    SuperAdminUserSerializer
)
# Tu devras créer ou vérifier ce fichier permissions_backend.py
from users.permissions_backend import IsSuperAdmin, IsSchoolAdminOrSuperAdmin
from users.utils.passwords import generate_temp_password

# ==============================================================================
# 1. AUTHENTIFICATION & COMPTE
# ==============================================================================

# users/api/views.py

@method_decorator(csrf_exempt, name='dispatch')
class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(request, username=email, password=password)

        if not user:
            return Response(
                {"error": "Identifiants incorrects"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)
        
        # --- CORRECTION BASÉE SUR TON MODEL ---
        
        # 1. Récupérer les objets de liaison (UserCustomRole)
        # On utilise select_related('role') pour éviter de faire une requête SQL par rôle (optimisation)
        user_roles_relations = user.custom_roles.all().select_related('role')
        
        # 2. Extraire les noms des rôles depuis la table liée
        # structure: UserCustomRole -> champ 'role' -> champ 'name'
        roles_list = [relation.role.name for relation in user_roles_relations]

        # 3. Déterminer le "Rôle Principal" pour la redirection JS
        # On définit une priorité : Si on trouve "Comptable", c'est prioritaire sur "Staff"
        primary_role = "STAFF" # Valeur par défaut
        
        # Normalisation en majuscules pour la comparaison
        roles_upper = [r.upper() for r in roles_list]
        
        if "ADMIN" in roles_upper or "SUPERADMIN" in roles_upper:
            primary_role = "SUPERADMIN"
        elif "DIRECTOR" in roles_upper or "DIRECTION" in roles_upper:
            primary_role = "DIRECTOR"
        elif "COMPTABLE" in roles_upper or "ACCOUNTANT" in roles_upper:
            primary_role = "ACCOUNTANT"
        elif "CAISSIER" in roles_upper or "CASHIER" in roles_upper:
            primary_role = "CASHIER"
        elif roles_list:
            # S'il a un rôle mais pas dans la liste prioritaire, on prend le premier
            primary_role = roles_list[0]

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.get_full_name(),
                "user_type": user.user_type, # ex: 'staff'
                
                # C'est ici que le JS va lire l'info pour rediriger
                "role": primary_role,       # ex: 'ACCOUNTANT'
                "roles": roles_list,        # Liste complète pour affichage futur
                
                "is_superadmin": user.is_superadmin(),
                "must_change_password": user.must_change_password,
                "school_id": user.school.id if user.school else None 
            }
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Renvoie les infos de l'utilisateur connecté"""
    user = request.user
    return Response({
        "id": user.id,
        "full_name": user.get_full_name(),
        "email": user.email,
        "user_type": user.user_type,
        "school": user.school.name if user.school else None,
        "roles": [r.name for r in user.custom_role.all()] # Si ManyToMany
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Renvoie les infos de l'utilisateur connecté"""
    user = request.user
    return Response({
        "id": user.id,
        "full_name": user.get_full_name(),
        "email": user.email,
        "user_type": user.user_type,
        "school": user.school.name if user.school else None,
        "roles": [r.name for r in user.custom_role.all()] # Si ManyToMany
    })

class ForceChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        new_password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        if not new_password or not confirm_password:
            return Response({"detail": "Mot de passe requis"}, status=400)

        if new_password != confirm_password:
            return Response({"detail": "Les mots de passe ne correspondent pas"}, status=400)

        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        return Response({"detail": "Mot de passe mis à jour"}, status=200)

class PasswordResetRequestAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email requis"}, status=400)

        user = User.objects.filter(email=email).first()
        
        # Sécurité : on répond toujours OK même si l'user n'existe pas
        if not user:
            return Response({"message": "Si cet email existe, un lien sera envoyé"}, status=200)

        token = PasswordResetTokenGenerator().make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # Adapte l'URL selon ton frontend
        reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

        send_mail(
            subject="Réinitialisation de mot de passe - SYBEM",
            message=f"Cliquez sur ce lien pour réinitialiser votre mot de passe :\n{reset_link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response({"message": "Email envoyé"}, status=200)




class SchoolUsersView(APIView):
    """
    Gère la liste et la création des utilisateurs pour une école.
    Accessible uniquement aux Admins d'École ou SuperAdmin.
    """
    permission_classes = [IsAuthenticated]

    # --------------------------------------------------
    # GET : LISTE DES UTILISATEURS
    # --------------------------------------------------
    def get(self, request):
        user = request.user

        if not (user.is_superadmin() or user.user_type == User.SCHOOL_ADMIN):
            return Response(
                {"detail": "Accès refusé"},
                status=status.HTTP_403_FORBIDDEN
            )

        queryset = User.objects.filter(
            school=user.school
        ).exclude(id=user.id)

        # 🔍 Filtres
        search = request.GET.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )

        user_type = request.GET.get("user_type")
        if user_type:
            queryset = queryset.filter(user_type=user_type)

        queryset = queryset.order_by("-date_joined")

        return Response(
            UserListSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK
        )

    # --------------------------------------------------
    # POST : CRÉATION / INVITATION
    # --------------------------------------------------
    def post(self, request):
        admin = request.user

        if not (admin.is_superadmin() or admin.user_type == User.SCHOOL_ADMIN):
            return Response(
                {"detail": "Action non autorisée"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        school = admin.school

        roles = CustomRole.objects.filter(
            id__in=data["roles"],
            school=school
        )

        if not roles.exists():
            return Response(
                {"detail": "Rôles invalides"},
                status=status.HTTP_400_BAD_REQUEST
            )

        role_names = ", ".join(role.name for role in roles)

        # Type utilisateur sécurisé
        target_user_type = data.get("user_type", User.SCHOOL_USER)
        if target_user_type not in [
            User.TEACHER,
            User.STAFF,
            User.STUDENT,
            User.SCHOOL_USER
        ]:
            target_user_type = User.SCHOOL_USER

        # ==================================================
        # MODE INVITATION
        # ==================================================
        if data["mode"] == "invite":

            if UserInvitation.objects.filter(
                email=data["email"],
                school=school,
                accepted_at__isnull=True
            ).exists():
                return Response(
                    {"detail": "Une invitation est déjà en cours"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                invitation = UserInvitation.objects.create(
                    email=data["email"],
                    school=school,
                    invited_by=admin,
                    user_type=target_user_type,
                    expires_at=timezone.now() + timedelta(days=2)
                )
                invitation.roles.set(roles)

                invite_link = (
                    f"{settings.FRONTEND_URL}"
                    f"/auth/accept-invite?token={invitation.token}"
                )

                send_mail(
                    subject=f"Invitation – {school.name} | SyBEM Academia",
                    message=(
                        f"Bonjour,\n\n"
                        f"L’établissement {school.name} vous invite à rejoindre "
                        f"la plateforme SyBEM Academia.\n\n"
                        f"Rôle(s) attribué(s) : {role_names}\n\n"
                        f"👉 Lien d’activation :\n{invite_link}\n\n"
                        f"Cette invitation est valable 48 heures.\n\n"
                        f"Cordialement,\n"
                        f"{school.name}\n"
                        f"SyBEM Academia"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[data["email"]],
                    fail_silently=False
                )

            return Response(
                {"message": "Invitation envoyée avec succès"},
                status=status.HTTP_201_CREATED
            )

        # ==================================================
        # MODE CRÉATION DIRECTE
        # ==================================================
        elif data["mode"] == "create":

            base_username = data["email"].split("@")[0]
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            temp_password = generate_temp_password()

            with transaction.atomic():
                new_user = User.objects.create(
                    email=data["email"],
                    username=username,
                    first_name=data.get("first_name", ""),
                    last_name=data.get("last_name", ""),
                    school=school,
                    user_type=target_user_type,
                    status=User.STATUS_ACTIVE,
                    is_active=True,
                    must_change_password=True
                )
                new_user.set_password(temp_password)
                new_user.save()

                for role in roles:
                    UserCustomRole.objects.create(
                        user=new_user,
                        role=role,
                        assigned_by=admin
                    )

                # 📧 EMAIL CHALEUREUX
                send_mail(
                    subject=f"Bienvenue sur SyBEM Academia – {school.name}",
                    message=(
                        f"Bonjour {new_user.first_name},\n\n"
                        f"Nous sommes ravis de vous accueillir sur "
                        f"la plateforme SyBEM Academia.\n\n"
                        f"Votre compte a été créé par l’administration de "
                        f"{school.name}.\n\n"
                        f"👤 Identifiant : {new_user.email}\n"
                        f"🔐 Mot de passe temporaire : {temp_password}\n"
                        f"🎓 Rôle(s) : {role_names}\n\n"
                        f"👉 Accédez à la plateforme ici :\n"
                        f"{settings.FRONTEND_URL}/login\n\n"
                        f"⚠️ Pour des raisons de sécurité, vous devrez "
                        f"changer votre mot de passe lors de votre première connexion.\n\n"
                        f"Bienvenue parmi nous,\n"
                        f"L’équipe {school.name}\n"
                        f"SyBEM Academia"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[new_user.email],
                    fail_silently=False
                )

            return Response(
                {"message": "Utilisateur créé et email envoyé"},
                status=status.HTTP_201_CREATED
            )

        return Response(
            {"detail": "Mode invalide"},
            status=status.HTTP_400_BAD_REQUEST
        )



class SchoolUserDetailView(APIView):
    """
    Gère les actions sur un utilisateur spécifique (Désactiver, Supprimer).
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        return get_object_or_404(User, pk=pk, school=request.user.school)

    def post(self, request, pk):
        """Toggle status (Active <-> Suspended)"""
        user = request.user
        if user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Non autorisé"}, status=403)

        target = self.get_object(request, pk)
        if target == user:
            return Response({"detail": "Impossible de modifier votre propre statut"}, status=400)

        target.status = User.STATUS_SUSPENDED if target.status == User.STATUS_ACTIVE else User.STATUS_ACTIVE
        target.save()
        
        return Response({"status": target.status, "message": "Statut mis à jour"})

    def delete(self, request, pk):
        """Suppression logique ou physique"""
        user = request.user
        if user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Non autorisé"}, status=403)

        target = self.get_object(request, pk)
        if target == user:
            return Response({"detail": "Impossible de se supprimer soi-même"}, status=400)

        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SchoolRolesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.school:
            return Response([], status=200)
            
        roles = CustomRole.objects.filter(school=request.user.school, is_active=True).order_by("name")
        serializer = CustomRoleSerializer(roles, many=True)
        return Response(serializer.data)


# ==============================================================================
# 3. GESTION DES INVITATIONS (Côté invité)
# ==============================================================================

# users/api/views.py

class AcceptInvitationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invitation = get_object_or_404(UserInvitation, token=data["token"])

        # ... (vérifications expiration/déjà accepté identiques) ...

        with transaction.atomic():
            username = invitation.email.split("@")[0]
            if User.objects.filter(username=username).exists():
                username = f"{username}_{secrets.token_hex(2)}"

            user = User.objects.create(
                email=invitation.email,
                username=username,
                first_name=data["first_name"],
                last_name=data["last_name"],
                school=invitation.school,
                user_type=invitation.user_type, # <--- ICI : On prend le type de l'invitation
                status=User.STATUS_ACTIVE,
                must_change_password=True 
            )
            # ... (reste du code identique) ...


# ==============================================================================
# 4. SUPER ADMIN
# ==============================================================================

class SuperAdminUserViewSet(ModelViewSet):
    queryset = User.objects.select_related("school").all()
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return UserSerializer
        return SuperAdminUserSerializer