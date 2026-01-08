from django.db import models
from django.conf import settings

class Parent(models.Model):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="parent_profile"
    )

    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE
    )

    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return self.user.email
