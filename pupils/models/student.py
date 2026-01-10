from django.db import models
from django.utils import timezone
from django.conf import settings
from datetime import date

class Student(models.Model):

    STATUS_ACTIVE = "active"
    STATUS_DROPPED = "dropped"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Actif"),
        (STATUS_DROPPED, "Abandonné"),
    ]

    # 🧑 Identité africaine
    last_name = models.CharField(max_length=100, verbose_name="Nom")
    middle_name = models.CharField(max_length=100, null=True, blank=True, verbose_name="Post-nom")
    first_name = models.CharField(max_length=100, verbose_name="Prénom")

    date_of_birth = models.DateField(null=True, blank=True)

    gender = models.CharField(
        max_length=10,
        choices=[
            ("Male", "Homme"),
            ("Female", "Femme"),
            ("Other", "Autre"),
        ],
        null=True,
        blank=True
    )

    student_id_code = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True
    )

    profile_picture = models.ImageField(
        upload_to="students/",
        null=True,
        blank=True
    )

    # 🔗 Relations CORRIGÉES
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="students"
    )

    current_classe = models.ForeignKey(
        "academia.Classe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    academic_period = models.ForeignKey(
        "AcademicPeriod.AcademicPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    parents = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="children",
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE
    )

    is_active = models.BooleanField(default=True, verbose_name="Est actif")

    # enrollment_date recevra automatiquement la date du jour
    enrollment_date = models.DateField(default=date.today)

# dropped_at est déjà correct en DateTimeField
    dropped_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "school",
                    "last_name",
                    "middle_name",
                    "first_name",
                    "date_of_birth",
                ],
                name="unique_student_identity_per_school"
            )
        ]
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.last_name} {self.middle_name or ''} {self.first_name}"
