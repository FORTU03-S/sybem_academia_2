ROLE_INTERFACE_MAP = {
    "finance.access": "finance",
    "academics.access": "academia",
    "hr.access": "hr",
}

def get_default_interface(user):
    perms = user.get_all_permissions()

    for perm, interface in ROLE_INTERFACE_MAP.items():
        if perm in perms:
            return interface

    return "dashboard"
