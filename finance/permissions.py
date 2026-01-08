from rest_framework import permissions
from users.models import UserCustomRole

class HasFinancePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return UserCustomRole.objects.filter(
            user=request.user, 
            role__role_permissions__permission__code="manage_finance"
        ).exists()