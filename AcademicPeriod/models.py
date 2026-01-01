from django.db import models
from django.utils.translation import gettext_lazy as _


class AcademicPeriodType(models.TextChoices):
    PERIOD = "PERIOD", _("Période")
    TRIMESTER = "TRIMESTER", _("Trimestre")
    SEMESTER = "SEMESTER", _("Semestre")
    YEAR = "YEAR", _("Année académique")
    SESSION = "SESSION", _("Session")


class AcademicPeriod(models.Model):

    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="academic_periods",
        verbose_name=_("École")
    )

    name = models.CharField(
        max_length=100,
        verbose_name=_("Nom de la période")
    )

    type = models.CharField(
        max_length=20,
        choices=AcademicPeriodType.choices,
        default=AcademicPeriodType.PERIOD,
        verbose_name=_("Type de période")
    )

    start_date = models.DateField(
        verbose_name=_("Date de début")
    )

    end_date = models.DateField(
        verbose_name=_("Date de fin")
    )

    is_current = models.BooleanField(
        default=False,
        verbose_name=_("Période en cours")
    )

    # --- Métadonnées importantes ---
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="academic_periods_created"
    )

    def __str__(self):
        return f"{self.name} - {self.school.name}"

    class Meta:
        verbose_name = _("Période académique")
        verbose_name_plural = _("Périodes académiques")
        unique_together = ("school", "name")
        ordering = ["school__name", "-start_date"]
