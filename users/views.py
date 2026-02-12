# users/views.py
print("!!!!!!!!!! LE FICHIER USERS/VIEWS.PY EST CHARGÉ !!!!!!!!!!")
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
    
        
# users/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from users.models import User


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_user(request, user_id):
    # On récupère l'utilisateur lié à l'école de l'admin connecté
    user_to_approve = get_object_or_404(User, pk=user_id, school=request.user.school)
    
    if user_to_approve.status != User.STATUS_PENDING:
        return Response({"error": "Utilisateur déjà actif ou suspendu"}, status=status.HTTP_400_BAD_REQUEST)
    
    user_to_approve.status = User.STATUS_ACTIVE
    user_to_approve.approved_at = timezone.now()
    user_to_approve.approved_by = request.user 
    user_to_approve.save()
    
    return Response({"message": "Utilisateur approuvé avec succès"})

# ---------------------
# DÉSACTIVER / ACTIVER (TOGGLE) (Transformé en API View)
# ---------------------
# Note: J'ai ajouté PATCH pour être cohérent avec ton JS qui utilise PATCH ou POST
@api_view(['POST', 'PATCH']) 
@permission_classes([IsAuthenticated])
def disable_user(request, user_id):
    user_to_edit = get_object_or_404(User, pk=user_id, school=request.user.school)
    
    # Toggle simple : si actif -> suspendu, sinon -> actif
    if user_to_edit.status == User.STATUS_ACTIVE:
        user_to_edit.status = User.STATUS_SUSPENDED
        msg = "Utilisateur désactivé"
    else:
        user_to_edit.status = User.STATUS_ACTIVE
        msg = "Utilisateur activé"

    user_to_edit.save()
    
    return Response({"message": msg, "new_status": user_to_edit.status})

# ---------------------
# SUPPRIMER UN UTILISATEUR (Transformé en API View)
# ---------------------
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    user_to_delete = get_object_or_404(User, pk=user_id, school=request.user.school)
    
    # Sécurité : on ne se supprime pas soi-même
    if user_to_delete.id == request.user.id:
         return Response({"detail": "Impossible de se supprimer soi-même"}, status=status.HTTP_400_BAD_REQUEST)

    user_to_delete.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

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
