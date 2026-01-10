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
        
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.get_full_name(),
                "user_type": user.user_type,
                "is_superadmin": user.is_superadmin(),
                "must_change_password": user.must_change_password,
                # Sécurité : vérifier si school existe avant d'accéder
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


# ==============================================================================
# 2. GESTION UTILISATEURS ÉCOLE (ADMIN SCOLAIRE)
# ==============================================================================

class SchoolUsersView(APIView):
    """
    Gère la liste et la création des utilisateurs pour une école spécifique.
    Accessible uniquement aux Admins d'École ou SuperAdmin.
    """
    permission_classes = [IsAuthenticated] # Ajoute IsSchoolAdminOrSuperAdmin si tu l'as créé

    def get_permissions(self):
        # Logique pour restreindre l'accès si besoin
        return super().get_permissions()

    def get(self, request):
        user = request.user
        if not (user.is_superadmin() or user.user_type == User.SCHOOL_ADMIN):
            return Response({"detail": "Accès refusé"}, status=403)

        queryset = User.objects.filter(school=user.school).exclude(id=user.id)

        # --- Filtres ---
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
        return Response(UserListSerializer(queryset, many=True).data)

    def post(self, request):
        user = request.user
        if user.user_type != User.SCHOOL_ADMIN and not user.is_superadmin():
            return Response({"detail": "Action non autorisée"}, status=403)

        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        school = user.school
        roles = CustomRole.objects.filter(id__in=data["roles"], school=school)

        if not roles.exists():
            return Response({"detail": "Rôles invalides"}, status=400)

        # ============================================================
        # 1. MODE INVITATION
        # ============================================================
        if data["mode"] == "invite":
            if UserInvitation.objects.filter(email=data["email"], school=school, accepted_at__isnull=True).exists():
                return Response({"detail": "Une invitation est déjà en cours pour cet email"}, status=400)

            with transaction.atomic():
                invitation = UserInvitation.objects.create(
                    email=data["email"],
                    school=school,
                    invited_by=user,
                    expires_at=timezone.now() + timedelta(days=2)
                )
                invitation.roles.set(roles)
                
                # --- LE CODE MANQUANT EST ICI ---
                invite_link = f"{settings.FRONTEND_URL}/auth/accept-invite?token={invitation.token}"
                print(f"------------ TENTATIVE ENVOI MAIL INVITATION ------------")
                try:
                    send_mail(
                        subject="Invitation - SyBem Academia",
                        message=f"Lien d'activation : {invite_link}",
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[data["email"]],
                        fail_silently=False,
                    )
                    print(f"✅ MAIL ENVOYÉ DANS LE TERMINAL A : {data['email']}")
                    print(f"Lien : {invite_link}")
                except Exception as e:
                    print(f"❌ ERREUR MAIL : {e}")
                print(f"-------------------------------------------------------")
                
            return Response({"message": "Invitation créée et envoyée"}, status=201)

        # ============================================================
        # 2. MODE CRÉATION DIRECTE
        # ============================================================
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
                    user_type=User.SCHOOL_USER,
                    status=User.STATUS_ACTIVE,
                    must_change_password=True
                )
                new_user.set_password(temp_password)
                new_user.save()
                
                for role in roles:
                    UserCustomRole.objects.create(user=new_user, role=role)

                # --- LE CODE MANQUANT EST ICI ---
                print(f"------------ TENTATIVE ENVOI MAIL CRÉATION ------------")
                try:
                    send_mail(
                        subject="Bienvenue sur SyBem",
                        message=f"Email: {data['email']}\nMot de passe: {temp_password}",
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[data["email"]],
                        fail_silently=False,
                    )
                    print(f"✅ MAIL ENVOYÉ DANS LE TERMINAL A : {data['email']}")
                    print(f"Mot de passe temporaire : {temp_password}")
                except Exception as e:
                    print(f"❌ ERREUR MAIL : {e}")
                print(f"-------------------------------------------------------")

            return Response({
                "message": "Utilisateur créé",
                "temp_password": temp_password
            }, status=201)
        
        return Response({"detail": "Mode invalide"}, status=400)


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

class AcceptInvitationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invitation = get_object_or_404(UserInvitation, token=data["token"])

        if invitation.accepted_at:
            return Response({"detail": "Invitation déjà utilisée"}, status=400)

        if invitation.is_expired():
            return Response({"detail": "Invitation expirée"}, status=400)

        with transaction.atomic():
            # Création de l'utilisateur
            username = invitation.email.split("@")[0]
            # S'assurer que le username est unique
            if User.objects.filter(username=username).exists():
                username = f"{username}_{secrets.token_hex(2)}"

            user = User.objects.create(
                email=invitation.email,
                username=username,
                first_name=data["first_name"],
                last_name=data["last_name"],
                school=invitation.school,
                user_type=User.TEACHER, # Type par défaut pour une invitation
                status=User.STATUS_ACTIVE
            )
            user.set_password(data["password"])
            user.save()

            # Attribution des rôles
            for role in invitation.roles.all():
                UserCustomRole.objects.create(user=user, role=role)

            # Marquer l'invitation comme acceptée
            invitation.accepted_at = timezone.now()
            invitation.save()

        return Response({"message": "Compte créé avec succès. Vous pouvez vous connecter."}, status=201)


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