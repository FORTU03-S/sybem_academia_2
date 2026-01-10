# users/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.serializers import UserListSerializer
from users.models import User
from users.utils.passwords import generate_temp_password
from users.serializers import CustomRoleSerializer
from users.models import UserCustomRole
from django.db import transaction

from rest_framework.views import APIView
from django.utils.text import slugify
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from users.serializers import UserListSerializer
from users.models import User
from users.serializers import UserSerializer
from users.models import CustomRole
from users.serializers import SchoolUserCreateSerializer
from users.models import UserInvitation
import secrets
from datetime import timedelta
import string
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        "id": user.id,
        "full_name": user.get_full_name(),
        "email": user.email,
        "user_type": user.user_type  # ou custom_role selon ton modèle
    })
    

class SchoolUsersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Accès refusé"}, status=403)

        users = User.objects.filter(school=request.user.school)
        return Response(UserListSerializer(users, many=True).data)
     
    def generate_temp_password(length=10):
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

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

        
# school/views.py
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from users.models import User

# ---------------------
# APPROUVER UN UTILISATEUR
# ---------------------
@require_POST
def approve_user(request, user_id):
    user = get_object_or_404(User, pk=user_id)
    
    if user.status != User.STATUS_PENDING:
        return JsonResponse({"error": "Utilisateur déjà actif ou suspendu"}, status=400)
    
    user.status = User.STATUS_ACTIVE
    user.approved_at = timezone.now()
    user.approved_by = request.user  # Assure-toi que l'utilisateur est authentifié
    user.save()
    
    return JsonResponse({"message": "Utilisateur approuvé avec succès"})


# ---------------------
# DÉSACTIVER UN UTILISATEUR
# ---------------------
@require_POST
def disable_user(request, user_id):
    user = get_object_or_404(User, pk=user_id)
    
    if user.status != User.STATUS_ACTIVE:
        return JsonResponse({"error": "Utilisateur non actif"}, status=400)
    
    user.status = User.STATUS_SUSPENDED
    user.save()
    
    return JsonResponse({"message": "Utilisateur désactivé"})


# ---------------------
# SUPPRIMER UN UTILISATEUR
# ---------------------
from django.views.decorators.http import require_http_methods

@require_http_methods(["DELETE"])
def delete_user(request, user_id):
    user = get_object_or_404(User, pk=user_id)
    user.delete()
    return JsonResponse({"message": "Utilisateur supprimé"})

class SchoolRolesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != user.SCHOOL_ADMIN:
            return Response({"detail": "Accès refusé"}, status=403)

        roles = CustomRole.objects.filter(
            school=user.school,
            is_active=True
        ).order_by("name")

        serializer = CustomRoleSerializer(roles, many=True)
        return Response(serializer.data)
