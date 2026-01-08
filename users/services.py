def infer_user_type_from_roles(roles):
    for role in roles:
        perms = role.permissions.values_list("codename", flat=True)

        if "teacher.access" in perms:
            return "teacher"

    return "staff"
