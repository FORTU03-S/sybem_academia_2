# users/permissions.py

from rest_framework import permissions
from .models import User  # Assurez-vous d'importer votre modèle User

class IsSuperAdmin(permissions.BasePermission):
    """
    Custom permission to only allow SuperAdmin users to access or modify resources.
    """
    def has_permission(self, request, view):
        # 1. Vérifier si l'utilisateur est authentifié
        if not request.user or not request.user.is_authenticated:
            return False
        
        # 2. Vérifier si l'utilisateur est un SuperAdmin
        # Nous supposons que votre modèle User a une méthode 'is_superadmin()'
        # ou que vous pouvez vérifier le champ 'user_type'.
        
        # L'utilisateur de la requête doit être un SuperAdmin (user_type = 'superadmin')
        return request.user.user_type == User.SUPERADMIN
    
class CanManageSchoolResources(permissions.BasePermission):
    """
    Seuls SuperAdmin ou SchoolAdmin peuvent accéder aux ressources spécifiques à l'école.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        # SuperAdmin a accès à tout
        if user.user_type == User.SUPERADMIN:
            return True
        
        # SchoolAdmin a accès à tout (le filtrage par école se fait dans la vue)
        if user.user_type == User.SCHOOL_ADMIN:
            return True
            
        return False
    
class IsDirectionOrSchoolAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.user_type in [
            User.SCHOOL_ADMIN,
            'DIRECTION',  # si tu ajoutes ce type plus tard
        ]
# users/permissions.py - VERSION AMÉLIORÉE
from rest_framework import permissions
from django.contrib.auth.models import Permission as DjangoPermission
from django.db.models import Q
from .models import User, CustomRole, RolePermission, CustomPermission

class DynamicPermissionBackend:
    """
    Backend d'authentification personnalisé pour les permissions dynamiques
    """
    def has_perm(self, user_obj, perm, obj=None):
        # Formater le code de permission
        if '.' in perm:
            category_code, perm_code = perm.split('.', 1)
        else:
            perm_code = perm
            category_code = None
        
        # 1. SuperAdmin a tout
        if user_obj.is_superadmin():
            return True
        
        # 2. Vérifier les permissions du rôle personnalisé
        if hasattr(user_obj, 'custom_role') and user_obj.custom_role:
            # Vérifier dans RolePermission
            role_permissions = RolePermission.objects.filter(
                role=user_obj.custom_role,
                permission__code=perm_code,
                is_active=True
            )
            
            if category_code:
                role_permissions = role_permissions.filter(
                    permission__category__code=category_code
                )
            
            if role_permissions.exists():
                # Vérifier le scope si un objet est fourni
                if obj and hasattr(obj, 'school'):
                    # Exemple: Vérifier si l'utilisateur a accès à cet objet spécifique
                    role_perm = role_permissions.first()
                    scope = role_perm.scope
                    
                    if scope.get('school_only', False):
                        return obj.school == user_obj.school
                    
                    if scope.get('own_department', False) and hasattr(obj, 'department'):
                        return obj.department == user_obj.department
                
                return True
        
        # 3. Vérifier les permissions Django standard
        django_perm = DjangoPermission.objects.filter(codename=perm_code).first()
        if django_perm and user_obj.has_perm(f"{django_perm.content_type.app_label}.{perm_code}"):
            return True
        
        return False
    
    def get_all_permissions(self, user_obj, obj=None):
        """Retourne toutes les permissions d'un utilisateur"""
        permissions = set()
        
        # Permissions du rôle personnalisé
        if hasattr(user_obj, 'custom_role') and user_obj.custom_role:
            role_perms = RolePermission.objects.filter(
                role=user_obj.custom_role,
                is_active=True
            ).select_related('permission', 'permission__category')
            
            for role_perm in role_perms:
                perm_code = f"{role_perm.permission.category.code}.{role_perm.permission.code}"
                permissions.add(perm_code)
        
        # Permissions Django
        django_perms = user_obj.get_all_permissions()
        permissions.update(django_perms)
        
        return permissions


class HasPermission(permissions.BasePermission):
    """
    Permission personnalisée basée sur le système dynamique
    Usage: permission_classes = [HasPermission('academic.manage_courses')]
    """
    def __init__(self, permission_code):
        self.permission_code = permission_code
    
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        backend = DynamicPermissionBackend()
        return backend.has_perm(user, self.permission_code)


class HasAnyPermission(permissions.BasePermission):
    """Vérifie si l'utilisateur a au moins une des permissions"""
    def __init__(self, permission_codes):
        self.permission_codes = permission_codes
    
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        backend = DynamicPermissionBackend()
        return any(backend.has_perm(user, perm) for perm in self.permission_codes)


class SchoolAdminPermission(permissions.BasePermission):
    """Permission spécifique pour l'admin d'école"""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        # Admin d'école a accès à tout dans son école
        if user.user_type == User.SCHOOL_ADMIN:
            return True
        
        # Vérifier les permissions dynamiques
        backend = DynamicPermissionBackend()
        
        # Liste des permissions admin d'école
        admin_permissions = [
            'users.manage_users',
            'academic.manage_courses',
            'finance.manage_budget',
            'hr.manage_staff',
            'reports.view_all',
        ]
        
        return any(backend.has_perm(user, perm) for perm in admin_permissions)


def check_permission(user, permission_code, obj=None):
    """Fonction utilitaire pour vérifier une permission"""
    backend = DynamicPermissionBackend()
    return backend.has_perm(user, permission_code, obj)


def get_user_permissions(user, include_django=True):
    """Récupère toutes les permissions d'un utilisateur"""
    backend = DynamicPermissionBackend()
    return backend.get_all_permissions(user)

from rest_framework.permissions import BasePermission
from users.models import User

class IsSchoolAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated and
            user.user_type in [User.SUPERADMIN, User.SCHOOL_ADMIN]
        )
