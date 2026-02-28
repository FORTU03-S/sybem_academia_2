
from rest_framework import permissions

def get_user_role(user):
    """Utilitaire pour récupérer le rôle sans faire planter l'app"""
    return getattr(user, 'role', None)

class IsCashier(permissions.BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return request.user.is_authenticated and role in ['CASHIER', 'ACCOUNTANT', 'DIRECTOR', 'ADMIN']


class IsAccountant(permissions.BasePermission):
    def has_permission(self, request, view):
        print(f"DEBUG: User={request.user.username}, IsStaff={request.user.is_staff}, Role={getattr(request.user, 'role', 'NON DEFINI')}")
        return request.user.is_authenticated and (request.user.is_superuser or getattr(request.user, 'role', None) in ['ACCOUNTANT', 'ADMIN'])

class IsDirector(permissions.BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return request.user.is_authenticated and role in ['DIRECTOR', 'ADMIN']

class IsAuditor(permissions.BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return request.user.is_authenticated and role == 'AUDITOR'

class CanValidateTransaction(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)
        config = obj.school.finance_config
        if obj.transaction_type == 'EXPENSE' and obj.amount > config.expense_approval_threshold:
            return role in ['DIRECTOR', 'ADMIN']
        return True