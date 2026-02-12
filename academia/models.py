# academia/models.py

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from schools.models import School 
from AcademicPeriod.models import AcademicPeriod 
from users.models import User # Pour les constantes de rôle
from django.db.models import Sum

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
    
    academic_period = models.ForeignKey(
    AcademicPeriod,
    on_delete=models.PROTECT,
    null=True,
    blank=True,
    related_name="courses"
    )

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

class Classe(models.Model):
    class EducationLevel(models.TextChoices):
        PRIMARY = 'PRIMARY', _('Primaire')
        SECONDARY = 'SECONDARY', _('Secondaire')
        UNIVERSITY = 'UNIVERSITY', _('Universitaire')
        OTHER = 'OTHER', _('Autre')

    # NOUVEAU : Pour gérer la structure des périodes
    class SystemType(models.TextChoices):
        TRIMESTER = 'TRIMESTER', _('Trimestriel (ex: Primaire - 3 Cycles)')
        SEMESTER = 'SEMESTER', _('Semestriel (ex: Secondaire - 2 Cycles)')

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classes', verbose_name="École")
    
    education_level = models.CharField(
        max_length=15, 
        choices=EducationLevel.choices, 
        default=EducationLevel.SECONDARY, 
        verbose_name="Niveau d'Éducation"
    )

    # NOUVEAU : Définit si on aura 3 trimestres ou 2 semestres
    system_type = models.CharField(
        max_length=15,
        choices=SystemType.choices,
        default=SystemType.SEMESTER,
        verbose_name="Système de division"
    )
    
    name = models.CharField(max_length=100, verbose_name="Nom de la Classe")
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    
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
    
    def get_student_score_for_period(self, enrollment, grading_period):
        """Calcule le total des points d'un élève pour UNE période précise (ex: P1)"""
        return Grade.objects.filter(
            enrollment=enrollment,
            evaluation__teaching_assignment=self,
            evaluation__grading_period=grading_period
        ).aggregate(total=Sum('score'))['total'] or 0

    def get_cycle_total(self, enrollment, cycle_root_period):
        """
        CALCUL AUTOMATIQUE : Somme (P1 + P2 + EXAM)
        cycle_root_period: l'objet GradingPeriod de type 'ROOT' (ex: Trimestre 1)
        """
        if cycle_root_period.category != GradingPeriod.Category.CYCLE_ROOT:
            return 0
        
        # On récupère toutes les sous-périodes (P1, P2, Examen)
        child_periods = cycle_root_period.sub_periods.all()
        
        total_cycle = 0
        for period in child_periods:
            total_cycle += self.get_student_score_for_period(enrollment, period)
            
        return total_cycle
# ... (Après le modèle TeachingAssignment dans academia/models.py)

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



# --- 4. MODÈLE GRADING PERIOD (Sous-périodes de notation) ---
class GradingPeriod(models.Model):
    class Category(models.TextChoices):
        ROOT = 'ROOT', _('Cycle Principal (Trimestre/Semestre)')
        REGULAR_PERIOD = 'PERIOD', _('Période de cours (P1, P2...)')
        EXAM_PERIOD = 'EXAM', _('Session d\'Examen')

    academic_period = models.ForeignKey(
        AcademicPeriod,
        on_delete=models.CASCADE,
        related_name='grading_periods',
        verbose_name="Période Académique Parent"
    )
    
    # AUTO-RÉFÉRENCE : Un Trimestre est le parent de P1, P2 et Examen
    parent = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, blank=True, 
        related_name='sub_periods',
        verbose_name="Période Parente (Cycle)"
    )

    name = models.CharField(max_length=100, verbose_name="Nom (ex: Trimestre 1 ou Période 1)")
    
    category = models.CharField(
        max_length=10, 
        choices=Category.choices, 
        default=Category.REGULAR_PERIOD,
        verbose_name="Catégorie"
    )
    
    sequence_order = models.PositiveIntegerField(default=1, verbose_name="Ordre d'affichage")
    start_date = models.DateField(verbose_name="Début")
    end_date = models.DateField(verbose_name="Fin")
    is_closed = models.BooleanField(default=False, verbose_name="Saisie fermée")

    class Meta:
        ordering = ['academic_period', 'sequence_order']
        unique_together = ('academic_period', 'name')
        verbose_name = "Période de Notation"
        verbose_name_plural = "Périodes de Notation"

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} > {self.name}"
        return f"{self.name} ({self.academic_period.name})"

    # --- LOGIQUE DE CALCUL AUTOMATIQUE ---
    def get_total_for_assignment(self, enrollment_id, assignment_id):
        """
        Calcule la somme automatique : P1 + P2 + EXAMEN
        Utilisable uniquement sur une période de type 'ROOT' (Trimestre/Semestre)
        """
        if self.category != self.Category.ROOT:
            return 0

        from .models import Grade # Import local pour éviter l'import circulaire
        
        # On récupère les IDs de toutes les sous-périodes (ex: P1, P2, EX1)
        sub_period_ids = self.sub_periods.values_list('id', flat=True)
        
        # On fait la somme de toutes les notes de l'élève pour cet assignment dans ces périodes
        total = Grade.objects.filter(
            enrollment_id=enrollment_id,
            evaluation__teaching_assignment_id=assignment_id,
            evaluation__grading_period_id__in=sub_period_ids
        ).aggregate(models.Sum('score'))['score__sum']
        
        return float(total) if total else 0.0
    
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