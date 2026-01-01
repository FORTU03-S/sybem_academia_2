# users/permissions.py
from rest_framework import permissions
from .models import User

class IsSuperAdmin(permissions.BasePermission):
    """
    Custom permission to only allow SuperAdmin users to access or modify resources.
    """
    def has_permission(self, request, view):
        # 1. Vérifier si l'utilisateur est authentifié
        if not request.user or not request.user.is_authenticated:
            return False
        
        # 2. Vérifier si l'utilisateur est un SuperAdmin
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

class SchoolAdminPermission(permissions.BasePermission):
    """Permission pour l'admin d'école"""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        # SuperAdmin a toujours accès
        if user.is_superadmin():
            return True
        
        # Admin d'école a accès
        if user.user_type == User.SCHOOL_ADMIN:
            return True
        
        # Vérifier si l'utilisateur a des permissions d'admin via son rôle
        from .permissions_backend import check_permission
        return check_permission(user, 'admin.manage')


# Import des fonctions du backend
try:
    from .permissions_backend import check_permission, get_user_permissions
except ImportError:
    # Fonctions de secours si permissions_backend n'existe pas encore
    def check_permission(user, permission_code):
        """Fonction de secours"""
        return user.is_superadmin() or user.user_type == User.SCHOOL_ADMIN
    
    def get_user_permissions(user):
        """Fonction de secours"""
        if user.is_superadmin():
            return ['*']
        elif user.user_type == User.SCHOOL_ADMIN:
            return ['academic.view', 'finance.view', 'users.view', 'reports.view']
        else:
            return []
        
