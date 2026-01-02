# users/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.serializers import UserListSerializer
from users.models import User
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

    # ==========================
    # 🔹 LISTE DES UTILISATEURS
    # ==========================
    def get(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != User.SCHOOL_ADMIN:
            return Response(
                {"detail": "Accès refusé"},
                status=status.HTTP_403_FORBIDDEN
            )

        users = (
            User.objects
            .filter(school=user.school)
            .order_by("-date_joined")
        )

        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ==========================
    # 🔹 CRÉATION / INVITATION
    # ==========================
    def post(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != User.SCHOOL_ADMIN:
            return Response(
                {"detail": "Accès refusé"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        mode = data["mode"]

        # 🔹 Rôles personnalisés de l'école
        roles = CustomRole.objects.filter(
            id__in=data["roles"],
            school=user.school
        )

        if not roles.exists():
            return Response(
                {"detail": "Rôles invalides pour cette école"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 🔹 Génération d’un username UNIQUE
        base_username = slugify(data["email"].split("@")[0])
        username = base_username
        index = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{index}"
            index += 1

        # ==========================
        # 🔹 TRANSACTION ATOMIQUE
        # ==========================
        with transaction.atomic():

            if mode == "create":
                new_user = User.objects.create(
                    email=data["email"],
                    username=username,
                    first_name=data.get("first_name", ""),
                    last_name=data.get("last_name", ""),
                    school=user.school,
                    status="active",
                )

                new_user.set_unusable_password()
                new_user.save()

            elif mode == "invite":
                new_user = User.objects.create(
                    email=data["email"],
                    username=username,
                    school=user.school,
                    status="pending",
                )

                # 👉 plus tard : envoi email d’invitation

            else:
                return Response(
                    {"detail": "Mode invalide"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 🔹 Association des rôles via le modèle intermédiaire
            for role in roles:
                UserCustomRole.objects.create(
                    user=new_user,
                    role=role
                )

        return Response(
            UserListSerializer(new_user).data,
            status=status.HTTP_201_CREATED
        )

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
