from django.db import models
from django.utils.translation import gettext_lazy as _
from AcademicPeriod.models import AcademicPeriod
from django.conf import settings
class School(models.Model):
    
    # --- AJOUT DU TYPE D'ÉCOLE ---
    PRIMARY = 'PRI'
    SECONDARY = 'SEC'
    MIXED = 'MIX'
    UNIVERSITY = 'UNI'

    SCHOOL_TYPE_CHOICES = [
        (PRIMARY, _('Primaire')),
        (SECONDARY, _('Secondaire')),
        (MIXED, _('Mixte (Primaire et Secondaire)')),
        (UNIVERSITY, _('Université')),
    ]

    school_type = models.CharField(
        _("Type d'École"),
        max_length=3,
        choices=SCHOOL_TYPE_CHOICES,
        default=SECONDARY, # Définissons Secondaire comme défaut pour l'amorçage
        help_text=_("Définit si l'école est primaire, secondaire, mixte ou universitaire.")
    )
    
    class Status(models.TextChoices):
        DRAFT = "DRAFT", _("Brouillon")
        ACTIVE = "ACTIVE", _("Active")
        SUSPENDED = "SUSPENDED", _("Suspendue")
        EXPIRED = "EXPIRED", _("Abonnement expiré")

    name = models.CharField(
        max_length=200,
        unique=True,
        verbose_name=_("Nom de l'École")
    )

    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name=_("Code unique")
    )
    
    school_admin = models.OneToOneField(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_school",
        verbose_name=_("Administrateur de l'école")
    )
    
    academic_period = models.ForeignKey(
    AcademicPeriod,
    on_delete=models.PROTECT,
    null=True,
    blank=True,
    related_name="schools",
    verbose_name=_("Année académique active")
)


    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_("Statut")
    )

    # --- Informations de contact ---
    address = models.TextField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    # --- Branding ---
    logo = models.ImageField(
        upload_to="schools/logos/",
        blank=True,
        null=True
    )

    # --- Limites définies par le super admin ---
    max_students = models.PositiveIntegerField(default=0)
    max_staff = models.PositiveIntegerField(default=0)
    max_teachers = models.PositiveIntegerField(default=0)

    # --- Métadonnées ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="schools_created"
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _("École")
        verbose_name_plural = _("Écoles")
        ordering = ["name"]

class SchoolMembership(models.Model):
    """
    Lien entre un utilisateur et une école
    avec rôle(s) et statut
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='school_memberships'
    )
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='memberships'
    )

    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'school')

    def __str__(self):
        return f"{self.user.email} @ {self.school.name}"
    
class SchoolRoleAssignment(models.Model):
    membership = models.ForeignKey(
        'schools.SchoolMembership',
        on_delete=models.CASCADE,
        related_name='role_assignments'
    )
    role = models.ForeignKey(
        'users.CustomRole',
        on_delete=models.CASCADE
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('membership', 'role')