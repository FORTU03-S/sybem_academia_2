from django.contrib.auth.management.commands.createsuperuser import Command as BaseCommand
from users.models import User

class Command(BaseCommand):
    def handle(self, *args, **options):
        super().handle(*args, **options)

        user = User.objects.get(email=options["email"])
        user.user_type = User.SUPERADMIN
        user.save()

        self.stdout.write(self.style.SUCCESS("✅ user_type = superadmin assigné"))
