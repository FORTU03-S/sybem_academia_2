from django.utils.crypto import get_random_string
from django.contrib.auth import get_user_model
from users.emails.invitations import send_account_credentials_email

User = get_user_model()

def generate_temp_password():
    return get_random_string(10)

def create_school_user(*, school, data, roles, created_by):
    password = generate_temp_password()

    user = User.objects.create_user(
        email=data["email"],
        last_name=data["last_name"],
        post_name=data.get("post_name", ""),
        first_name=data["first_name"],
        user_type=data["user_type"],
        school=school,
        is_active=True,
    )

    user.set_password(password)
    user.must_change_password = True
    user.save()

    user.custom_roles.set(roles)

    send_account_credentials_email(
        email=user.email,
        password=password,
        full_name=user.full_name
    )

    return user
