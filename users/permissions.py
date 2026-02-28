
from rest_framework import permissions
from .models import User

class IsSuperAdmin(permissions.BasePermission):
    """
    Custom permission to only allow SuperAdmin users to access or modify resources.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return request.user.user_type == User.SUPERADMIN
    
class CanManageSchoolResources(permissions.BasePermission):
    """
    Seuls SuperAdmin ou SchoolAdmin peuvent accéder aux ressources spécifiques à l'école.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.user_type == User.SUPERADMIN:
            return True
        
        if user.user_type == User.SCHOOL_ADMIN:
            return True
            
        return False
    
class IsDirectionOrSchoolAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.user_type in [
            User.SCHOOL_ADMIN,
            'DIRECTION',
        ]

class SchoolAdminPermission(permissions.BasePermission):
    """Permission pour l'admin d'école"""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        if user.is_superadmin():
            return True
        
        if user.user_type == User.SCHOOL_ADMIN:
            return True
        
        from .permissions_backend import check_permission
        return check_permission(user, 'admin.manage')

try:
    from .permissions_backend import check_permission, get_user_permissions
except ImportError:
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
        
