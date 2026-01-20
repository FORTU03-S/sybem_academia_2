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
        unique_together = ('name', 'education_level', 'academic_period', 'school')
        ordering = ['school__name', 'academic_period__name', 'education_level', 'name']
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
    
# ... (Après le modèle TeachingAssignment dans academia/models.py)

# --- 4. MODÈLE GRADING PERIOD (Sous-périodes de notation) ---
class GradingPeriod(models.Model):
    """
    Définit les périodes spécifiques de notation à l'intérieur d'une période académique.
    Remplace l'ancien Enum 'Period' (T1P1, T1EX, etc.) pour être dynamique.
    Ex: 'Première Période', 'Examens Mi-Session'.
    """
    academic_period = models.ForeignKey(
        AcademicPeriod,
        on_delete=models.CASCADE,
        related_name='grading_periods',
        verbose_name="Période Académique Parent"
    )
    name = models.CharField(max_length=100, verbose_name="Nom (ex: Période 1)")
    
    # Pour l'ordre d'affichage (1, 2, 3...)
    sequence_order = models.PositiveIntegerField(default=1, verbose_name="Ordre séquentiel")
    
    start_date = models.DateField(verbose_name="Début de la période de notation")
    end_date = models.DateField(verbose_name="Fin de la période de notation")
    
    # Est-ce une période d'examen (qui compte souvent pour un % plus gros) ?
    is_exam = models.BooleanField(default=False, verbose_name="Est une période d'examen")
    
    # Si vous voulez bloquer la saisie des notes après une date
    is_closed = models.BooleanField(default=False, verbose_name="Saisie fermée")

    class Meta:
        ordering = ['academic_period', 'sequence_order']
        unique_together = ('academic_period', 'name')
        verbose_name = "Période de Notation"
        verbose_name_plural = "Périodes de Notation"

    def __str__(self):
        return f"{self.name} ({self.academic_period.name})"


# --- 5. MODÈLE EVALUATION (L'épreuve) ---
class Evaluation(models.Model):
    """
    Représente une épreuve spécifique (Interro, Devoir, Examen) créée par un prof
    dans le cadre de son assignation (TeachingAssignment).
    """
    class EvaluationType(models.TextChoices):
        EXAMEN = 'EX', 'Examen'
        DEVOIR = 'DV', 'Devoir'
        PARTICIPATION = 'PT', 'Participation/Pratique'
        INTERROGATION = 'IN', 'Interrogation'
        AUTRE = 'AU', 'Autre'

    # Lien direct avec l'assignation (Prof + Classe + Cours)
    teaching_assignment = models.ForeignKey(
        'TeachingAssignment',
        on_delete=models.CASCADE,
        related_name='evaluations',
        verbose_name="Cours/Classe concerné"
    )
    
    # Lien temporel (Dans quelle sous-période cela tombe ?)
    grading_period = models.ForeignKey(
        'GradingPeriod',
        on_delete=models.CASCADE,
        related_name='evaluations',
        verbose_name="Période de notation"
    )

    name = models.CharField(max_length=200, verbose_name="Titre de l'évaluation")
    description = models.TextField(blank=True, null=True, verbose_name="Description / Contenu")
    
    evaluation_type = models.CharField(
        max_length=20,
        choices=EvaluationType.choices,
        default=EvaluationType.INTERROGATION,
        verbose_name="Type d'épreuve"
    )

    date = models.DateField(default=models.functions.Now, verbose_name="Date de l'épreuve")
    
    # Sur combien est notée l'épreuve (ex: sur 20, sur 100)
    max_score = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=20.00,
        verbose_name="Note Maximale (Sur)"
    )
    
    # Coefficient spécifique de cette épreuve dans la période (optionnel)
    weight = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=1.00, 
        verbose_name="Coefficient de l'épreuve"
    )

    # État de publication
    is_published = models.BooleanField(default=False, verbose_name="Notes publiées aux élèves")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', 'name']
        verbose_name = "Évaluation"
        verbose_name_plural = "Évaluations"

    def __str__(self):
        return f"{self.name} - {self.teaching_assignment.course.name} ({self.teaching_assignment.classe.name})"

    def clean(self):
        from django.core.exceptions import ValidationError
        # Vérifier que la grading_period appartient à la même école/période que la classe
        # Note: Ceci est une validation complexe, simplifiée ici.
        assignment_period = self.teaching_assignment.classe.academic_period
        if self.grading_period.academic_period != assignment_period:
            raise ValidationError("La période de notation ne correspond pas à la période académique de la classe.")


# --- 6. MODÈLE GRADE (La Note) ---
class Grade(models.Model):
    """
    La note individuelle d'un élève pour une évaluation donnée.
    """
    # NOTE: J'assume que vous avez un modèle Enrollment (Inscription) dans l'app 'pupils'
    # Si ce n'est pas le cas, il faudra le créer. Il lie Student à Classe pour une année.
    enrollment = models.ForeignKey(
        'pupils.Enrollment', 
        on_delete=models.CASCADE,
        related_name='grades',
        verbose_name="Élève (Inscription)"
    )
    
    evaluation = models.ForeignKey(
        'Evaluation',
        on_delete=models.CASCADE,
        related_name='grades',
        verbose_name="Évaluation"
    )
    
    score = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        verbose_name="Note obtenue"
    )
    
    observation = models.CharField(max_length=255, blank=True, null=True, verbose_name="Appréciation")
    
    # Métadonnées
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name="Saisi par"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('enrollment', 'evaluation') # Un élève ne peut avoir qu'une note par épreuve
        verbose_name = "Note"
        verbose_name_plural = "Notes"

    def __str__(self):
        return f"{self.score}/{self.evaluation.max_score} - {self.enrollment}"

    @property
    def percentage(self):
        if self.evaluation.max_score > 0:
            return (self.score / self.evaluation.max_score) * 100
        return 0
    

class GradeChangeRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('APPROVED', 'Approuvé'),
        ('REJECTED', 'Rejeté'),
    ]

    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    enrollment = models.ForeignKey('pupils.Enrollment', on_delete=models.CASCADE)
    evaluation = models.ForeignKey('Evaluation', on_delete=models.CASCADE)
    
    old_score = models.DecimalField(max_digits=5, decimal_places=2)
    new_score = models.DecimalField(max_digits=5, decimal_places=2)
    reason = models.TextField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Demande de {self.teacher}: {self.old_score} -> {self.new_score}"