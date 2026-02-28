from django.core.mail import send_mail
from django.conf import settings

def send_invitation_email(invitation):
    link = f"{settings.FRONTEND_URL}/accept-invitation/{invitation.token}"

    send_mail(
        subject="Invitation à rejoindre l'école",
        message=(
            f"Bonjour,\n\n"
            f"Vous avez été invité à rejoindre {invitation.school.name}.\n\n"
            f"Cliquez ici pour accepter : {link}\n\n"
            f"Ce lien expire dans 7 jours."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
    )
