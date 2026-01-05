from django.conf import settings
from django.db import models
from django.utils import timezone
from django.apps import apps
from django.db.models import Sum, F
from users.models import User # Pour les constantes de rôle


# -----------------------------
# STATUT ÉLÈVE (métier clair)
# -----------------------------
class StudentStatus(models.TextChoices):
    ACTIVE = "active", "Actif"
    INACTIVE = "inactive", "Inactif"
    DROPOUT = "dropout", "Abandonné"


# -----------------------------
# MODÈLE ÉLÈVE (PRO)
# -----------------------------
class Student(models.Model):

    # 🔐 Compte utilisateur élève (optionnel)
    user_account = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_profile",
        limit_choices_to={"user_type": User.STUDENT},
        verbose_name="Compte utilisateur élève"
    )

    # 🧾 IDENTITÉ (Afrique-friendly)
    last_name = models.CharField("Nom", max_length=100)
    middle_name = models.CharField("Post-nom", max_length=100, blank=True, null=True)
    first_name = models.CharField("Prénom", max_length=100)

    date_of_birth = models.DateField("Date de naissance", null=True, blank=True)

    gender = models.CharField(
        "Genre",
        max_length=10,
        choices=[
            ("male", "Masculin"),
            ("female", "Féminin"),
            ("other", "Autre"),
        ],
        null=True,
        blank=True
    )

    # 📍 CONTACT
    address = models.TextField("Adresse", blank=True, null=True)
    phone_number = models.CharField("Téléphone", max_length=20, blank=True, null=True)
    email = models.EmailField("Email", blank=True, null=True)

    profile_picture = models.ImageField(
        upload_to="students/photos/",
        blank=True,
        null=True
    )

    # 🆔 IDENTIFIANT SCOLAIRE
    student_id_code = models.CharField(
        "Matricule élève",
        max_length=50,
        unique=True,
        blank=True,
        null=True
    )

    # 🏫 SCOLARITÉ
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.PROTECT,
        related_name="students",
        verbose_name="École"
    )

    current_classe = models.ForeignKey(
        "academia.Classe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        verbose_name="Classe actuelle"
    )

    academic_period = models.ForeignKey(
        "AcademicPeriod.AcademicPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Période académique"
    )

    enrollment_date = models.DateField(
        "Date d'inscription",
        default=timezone.now
    )

    # 👨‍👩‍👧 PARENTS / TUTEURS (OPTIONNEL)
    parents = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="children",
        limit_choices_to={"user_type": User.PARENT},
        blank=True,
        verbose_name="Parents / Tuteurs"
    )

    # 🚦 STATUT ÉLÈVE
    status = models.CharField(
        "Statut",
        max_length=20,
        choices=StudentStatus.choices,
        default=StudentStatus.ACTIVE
    )

    is_active = models.BooleanField(
        "Compte actif",
        default=True,
        help_text="Désactiver sans supprimer"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # -----------------------------
    # MÉTADONNÉES
    # -----------------------------
    class Meta:
        verbose_name = "Élève"
        verbose_name_plural = "Élèves"
        ordering = ["last_name", "middle_name", "first_name"]
        indexes = [
            models.Index(fields=["last_name", "first_name"]),
            models.Index(fields=["student_id_code"]),
            models.Index(fields=["status"]),
        ]

    # -----------------------------
    # AFFICHAGE
    # -----------------------------
    def __str__(self):
        return self.full_name

    @property
    def full_name(self):
        return " ".join(filter(None, [
            self.last_name,
            self.middle_name,
            self.first_name
        ]))

    # -----------------------------
    # LOGIQUE MÉTIER
    # -----------------------------
    def save(self, *args, **kwargs):
        AcademicPeriod = apps.get_model("schools", "AcademicPeriod")

        if not self.academic_period and self.school:
            self.academic_period = AcademicPeriod.objects.filter(
                school=self.school,
                is_current=True
            ).first()

        super().save(*args, **kwargs)

        # Inscription automatique aux cours
        if self.status == StudentStatus.ACTIVE:
            self.enroll_in_class_courses()

    def enroll_in_class_courses(self):
        """
        Inscription automatique aux cours de la classe
        """
        if not self.current_classe or not self.academic_period:
            return

        TeachingAssignment = apps.get_model("schools", "TeachingAssignment")
        Enrollment = apps.get_model("schools", "Enrollment")

        assignments = TeachingAssignment.objects.filter(
            classe=self.current_classe,
            academic_period=self.academic_period
        ).select_related("course")

        for assignment in assignments:
            Enrollment.objects.get_or_create(
                student=self,
                course=assignment.course,
                academic_period=self.academic_period,
                defaults={
                    "classe": self.current_classe,
                    "status": "active"
                }
            )

    # -----------------------------
    # MOYENNE GÉNÉRALE
    # -----------------------------
    def get_general_average(self, period=None):
        Grade = apps.get_model("schools", "Grade")

        qs = Grade.objects.filter(enrollment__student=self)

        if period:
            qs = qs.filter(evaluation__period=period)

        total_weight = qs.aggregate(
            total=Sum("evaluation__evaluation_weight")
        )["total"] or 0

        if total_weight == 0:
            return None

        weighted_sum = qs.aggregate(
            total=Sum(F("score") * F("evaluation__evaluation_weight"))
        )["total"] or 0

        return round(weighted_sum / total_weight, 2)
