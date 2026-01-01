# academia/models.py

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from schools.models import School 
from AcademicPeriod.models import AcademicPeriod 
from users.models import User # Pour les constantes de rôle

# --- 1. MODÈLE COURSE (unité de travail académique) ---
class Course(models.Model):
    """
    Représente une unité d'enseignement ou matière (Ex: Mathématiques, Français).
    Liée uniquement à l'école.
    """
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name='courses', verbose_name="École"
    )
    name = models.CharField(max_length=100, verbose_name="Nom du Cours")
    code = models.CharField(max_length=20, unique=False, blank=True, null=True, verbose_name="Code du Cours")
    description = models.TextField(blank=True, null=True, verbose_name="Description du Cours")
    
    # Pondération et évaluation (dépend du type d'évaluation)
    #weight = models.PositiveIntegerField(default=1, verbose_name="Pondération du cours")
    #credits = models.DecimalField(
    #   max_digits=4, decimal_places=2, default=0.0, verbose_name="Crédits ECTS/Unités"
    #)

    class Meta:
        unique_together = ('school', 'name')
        verbose_name = "Cours"
        verbose_name_plural = "Cours"
        ordering = ['school__name', 'name']

    def __str__(self):
        return f"{self.name} ({self.school.name})"

# --- 2. MODÈLE CLASSE ---
class Classe(models.Model):
    
    class EducationLevel(models.TextChoices):
        PRIMARY = 'PRIMARY', _('Primaire')
        SECONDARY = 'SECONDARY', _('Secondaire')
        UNIVERSITY = 'UNIVERSITY', _('Universitaire')
        OTHER = 'OTHER', _('Autre')

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classes', verbose_name="École")
    
    education_level = models.CharField(
        max_length=15, 
        choices=EducationLevel.choices, 
        default=EducationLevel.SECONDARY, 
        verbose_name="Niveau d'Éducation"
    )
    
    name = models.CharField(max_length=100, verbose_name="Nom de la Classe") # Ex: 6ème A, L1 Info
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    
    # Liaison à la Période Académique pour le filtrage
    academic_period = models.ForeignKey(
        AcademicPeriod, 
        on_delete=models.CASCADE, 
        related_name='classes_in_period', 
        verbose_name="Période Académique"
    )
    
    titulaire = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='titular_of_classes', 
        limit_choices_to={'user_type': User.TEACHER}, 
        verbose_name="Enseignant Titulaire"
    )

    # Liaison Many-to-Many entre la Classe et les Cours
    courses = models.ManyToManyField('Course', related_name='classes', blank=True, verbose_name="Cours de la classe")

    class Meta:
        unique_together = ('name', 'academic_period', 'school')
        ordering = ['school__name', 'academic_period__name', 'name']
        verbose_name = "Classe"
        verbose_name_plural = "Classes"

    def __str__(self):
        return f"{self.name} ({self.get_education_level_display()}) - {self.academic_period.name}"
    
class TeachingAssignment(models.Model):
    """
    Modèle intermédiaire Many-to-Many entre Classe, Course, et User (Enseignant).
    Contient la pondération (coefficient) propre à cette classe/cours.
    """
    classe = models.ForeignKey(
        'Classe', 
        on_delete=models.CASCADE, 
        related_name='assignments',
        verbose_name="Classe Assignée"
    )
    course = models.ForeignKey(
        'Course', 
        on_delete=models.CASCADE, 
        related_name='assignments',
        verbose_name="Cours Assigné"
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='teaching_loads',
        limit_choices_to={'user_type': User.TEACHER}, 
        verbose_name="Enseignant Responsable"
    )
    
    # 🛑 LA PONDÉRATION EST DÉPLACÉE ICI !
    weight = models.PositiveIntegerField(default=1, verbose_name="Coefficient/Pondération")
    
    # Le cours peut-il être noté ? (Pour les cours non évaluatifs comme le sport)
    is_evaluative = models.BooleanField(default=True, verbose_name="Évaluatif")

    class Meta:
        verbose_name = "Assignation Pédagogique"
        verbose_name_plural = "Assignations Pédagogiques"
        # Un cours ne peut être assigné qu'une seule fois par classe
        unique_together = ('classe', 'course') 
        ordering = ['classe__name', 'course__name']

    def __str__(self):
        return f"{self.course.name} ({self.weight}) en {self.classe.name}"