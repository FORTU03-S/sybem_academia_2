from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.contrib.auth.password_validation import validate_password

from users.models import User, UserInvitation
from schools.models import SchoolMembership, SchoolRoleAssignment


@transaction.atomic
def invite_or_create_user(
    *,
    school,
    mode,
    data,
    roles,
    invited_by
):
    """
    mode = "create" | "invite"
    """

    # =========================
    # INVITATION
    # =========================
    if mode == "invite":
        invitation = UserInvitation.objects.create(
            email=data["email"],
            school=school,
            invited_by=invited_by,
            expires_at=timezone.now() + timedelta(days=7)
        )

        invitation.roles.set(roles)

        return {
            "type": "invitation",
            "invitation": invitation
        }

    # =========================
    # CRÉATION DIRECTE
    # =========================

    # 🔐 user_type sécurisé (pas confiance au frontend)
    user_type = data.get("user_type") or User.SCHOOL_USER

    # 🔑 mot de passe
    password = data.get("password") or User.objects.make_random_password()
    validate_password(password)

    user = User.objects.create_user(
        email=data["email"],
        first_name=data.get("first_name", ""),
        post_name=data.get("post_name", ""),
        last_name=data.get("last_name", ""),
        user_type=user_type,
        password=password,
    )

    # 📸 photo de profil
    if data.get("profile_picture"):
        user.profile_picture = data["profile_picture"]
        user.save()

    # 🏫 rattachement école
    membership = SchoolMembership.objects.create(
        user=user,
        school=school
    )

    # 🎭 rôles
    for role in roles:
        SchoolRoleAssignment.objects.create(
            membership=membership,
            role=role
        )

    return {
        "type": "user",
        "user": user,
        "password": password if "password" not in data else None
    }
