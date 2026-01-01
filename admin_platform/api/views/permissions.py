# admin_platform/api/views/permissions.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from users.models import CustomRole, PermissionCategory, CustomPermission, RolePermission
from sybem.users.permissions_backend import SchoolAdminPermission
from admin_platform.api .serializers import (
    PermissionCategorySerializer,
    CustomPermissionSerializer,
    CustomRoleSerializer,
    RolePermissionSerializer
)
from users.models import User
from django.db.models import Q


class PermissionCategoryListAPIView(APIView):
    """Liste des catégories de permissions"""
    #permission_classes = [IsAuthenticated, SchoolAdminPermission]
    
    def get(self, request):
        categories = PermissionCategory.objects.all().order_by('order')
        serializer = PermissionCategorySerializer(categories, many=True)
        return Response(serializer.data)


class CustomPermissionListAPIView(APIView):
    """Liste des permissions personnalisées"""
    permission_classes = [IsAuthenticated, SchoolAdminPermission]
    
    def get(self, request):
        category_id = request.query_params.get('category_id')
        search = request.query_params.get('search', '')
        
        queryset = CustomPermission.objects.select_related('category')
        
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(description__icontains=search)
            )
        
        serializer = CustomPermissionSerializer(queryset, many=True)
        return Response(serializer.data)


class RolePermissionManagementAPIView(APIView):
    """Gestion des permissions d'un rôle"""
    permission_classes = [IsAuthenticated, SchoolAdminPermission]
    
    def get(self, request, role_id):
        try:
            role = CustomRole.objects.get(id=role_id, school=request.user.school)
        except CustomRole.DoesNotExist:
            return Response(
                {"error": "Rôle non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Récupérer toutes les permissions avec l'état pour ce rôle
        all_permissions = CustomPermission.objects.all().order_by('category__order', 'name')
        role_permissions = RolePermission.objects.filter(role=role).select_related('permission')
        
        # Créer un mapping des permissions du rôle
        role_permission_map = {
            rp.permission_id: rp.access_level for rp in role_permissions
        }
        
        data = []
        for perm in all_permissions:
            data.append({
                'id': perm.id,
                'code': perm.code,
                'name': perm.name,
                'description': perm.description,
                'category': {
                    'id': perm.category.id,
                    'name': perm.category.name,
                    'code': perm.category.code,
                },
                'requires_approval': perm.requires_approval,
                'is_dangerous': perm.is_dangerous,
                'access_level': role_permission_map.get(perm.id, None),
                'has_access': perm.id in role_permission_map,
            })
        
        return Response({
            'role': {
                'id': role.id,
                'name': role.name,
                'description': role.description,
            },
            'permissions': data,
        })
    
    def post(self, request, role_id):
        """Mettre à jour les permissions d'un rôle"""
        try:
            role = CustomRole.objects.get(id=role_id, school=request.user.school)
        except CustomRole.DoesNotExist:
            return Response(
                {"error": "Rôle non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        permissions_data = request.data.get('permissions', [])
        
        with transaction.atomic():
            # Supprimer les anciennes permissions
            RolePermission.objects.filter(role=role).delete()
            
            # Ajouter les nouvelles permissions
            for perm_data in permissions_data:
                permission_id = perm_data.get('permission_id')
                access_level = perm_data.get('access_level', 'VIEW')
                
                try:
                    permission = CustomPermission.objects.get(id=permission_id)
                except CustomPermission.DoesNotExist:
                    continue
                
                RolePermission.objects.create(
                    role=role,
                    permission=permission,
                    access_level=access_level,
                    scope={}  # Peut être étendu
                )
        
        return Response({
            "message": "Permissions mises à jour avec succès",
            "role_id": role.id
        }, status=status.HTTP_200_OK)


class UserPermissionCheckAPIView(APIView):
    """Vérifier les permissions d'un utilisateur"""
    permission_classes = [IsAuthenticated, SchoolAdminPermission]
    
    def post(self, request):
        user_id = request.data.get('user_id')
        permission_codes = request.data.get('permissions', [])
        
        try:
            target_user = User.objects.get(id=user_id, school=request.user.school)
        except User.DoesNotExist:
            return Response(
                {"error": "Utilisateur non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        from sybem.users.permissions_backend import check_permission
        
        results = {}
        for perm_code in permission_codes:
            results[perm_code] = check_permission(target_user, perm_code)
        
        return Response({
            'user_id': target_user.id,
            'user_email': target_user.email,
            'permissions': results
        })


class PermissionMatrixAPIView(APIView):
    """Matrice des permissions pour visualisation"""
    permission_classes = [IsAuthenticated, SchoolAdminPermission]
    
    def get(self, request):
        # Récupérer tous les rôles de l'école
        roles = CustomRole.objects.filter(school=request.user.school).order_by('name')
        
        # Récupérer toutes les permissions groupées par catégorie
        categories = PermissionCategory.objects.all().order_by('order')
        
        matrix = []
        for category in categories:
            category_data = {
                'id': category.id,
                'name': category.name,
                'code': category.code,
                'permissions': []
            }
            
            permissions = CustomPermission.objects.filter(category=category).order_by('code')
            for perm in permissions:
                permission_data = {
                    'id': perm.id,
                    'code': perm.code,
                    'name': perm.name,
                    'description': perm.description,
                    'roles': {}
                }
                
                # Pour chaque rôle, vérifier s'il a cette permission
                for role in roles:
                    has_access = RolePermission.objects.filter(
                        role=role,
                        permission=perm,
                        is_active=True
                    ).exists()
                    
                    if has_access:
                        role_perm = RolePermission.objects.get(role=role, permission=perm)
                        permission_data['roles'][role.id] = {
                            'has_access': True,
                            'access_level': role_perm.access_level,
                            'role_name': role.name
                        }
                    else:
                        permission_data['roles'][role.id] = {
                            'has_access': False,
                            'access_level': None,
                            'role_name': role.name
                        }
                
                category_data['permissions'].append(permission_data)
            
            matrix.append(category_data)
        
        return Response({
            'roles': CustomRoleSerializer(roles, many=True).data,
            'matrix': matrix
        })