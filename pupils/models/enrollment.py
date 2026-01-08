from django.db import models

class Enrollment(models.Model):

    STATUS_CHOICES = [
        ("active", "Actif"),
        ("completed", "Terminé"),
        ("withdrawn", "Abandonné"),
    ]

    student = models.ForeignKey(
        "pupils.Student",
        on_delete=models.CASCADE,
        related_name="enrollments"
    )

    course = models.ForeignKey(
        "academia.Course",
        on_delete=models.CASCADE
    )

    classe = models.ForeignKey(
        "academia.Classe",
        on_delete=models.CASCADE
    )

    academic_period = models.ForeignKey(
        "AcademicPeriod.AcademicPeriod",
        on_delete=models.CASCADE
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active"
    )

    class Meta:
        unique_together = ("student", "course", "academic_period")
