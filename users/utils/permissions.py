from django.contrib.auth.models import Permission

def user_has_permission(user, perm_codename):
    """
    Vérifie si un utilisateur a une permission donnée
    via :
    - son user_type
    - son CustomRole
    - les permissions Django natives
    """

    if not user or not user.is_authenticated:
        return False

    # 🔥 SUPERADMIN : accès total
    if user.user_type == user.SUPERADMIN:
        return True

    # 🔥 SCHOOL_ADMIN : accès total dans son école
    if user.user_type == user.SCHOOL_ADMIN:
        return True

    # 🔐 Permissions Django natives
    if user.has_perm(perm_codename):
        return True

    # 🎯 Permissions via CustomRole
    if user.custom_role:
        return user.custom_role.permissions.filter(
            codename=perm_codename.split('.')[-1]
        ).exists()

    return False
