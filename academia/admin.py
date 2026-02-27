from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Course, Classe, TeachingAssignment, Grade, Evaluation, GradingPeriod
from django.utils.html import format_html

# --- Inlines ---

class GradeInline(admin.TabularInline):
    """Permet de saisir les notes directement dans la page de l'Évaluation"""
    model = Grade
    extra = 0
    autocomplete_fields = ['enrollment']
    readonly_fields = ('percentage_display', 'created_at')
    fields = ('enrollment', 'score', 'percentage_display', 'observation')
    
    def percentage_display(self, obj):
        # Sécurité !!!
        if obj and obj.evaluation and obj.evaluation.max_score > 0:
            try:
                # Force la conversion en float AVANT le formatage
                val_float = float(obj.percentage)
                return f"{val_float:.1f}%"
            except (TypeError, ValueError):
                return "0.0%"
        return "-"
    percentage_display.short_description = "%"

class TeachingAssignmentInline(admin.TabularInline):
    """Permet d'ajouter des cours et des enseignants directement dans la Classe."""
    model = TeachingAssignment
    extra = 1
    autocomplete_fields = ['teacher', 'course']
    fields = ('course', 'teacher', 'weight', 'is_evaluative')


# --- Configurations Admin ---

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    """Gestion des matières/cours."""
    list_display = ('name', 'code', 'school')
    list_filter = ('school',)
    search_fields = ('name', 'code', 'school__name')
    autocomplete_fields = ['school']
    ordering = ['school', 'name']


@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    """Gestion des classes avec ses assignations pédagogiques."""
    list_display = ('name', 'education_level', 'academic_period', 'school', 'titulaire')
    list_filter = ('education_level', 'academic_period', 'school')
    search_fields = ('name', 'school__name', 'academic_period__name')
    
    # Utilisation d'autocomplete pour géstion  les gros volumes de données
    autocomplete_fields = ['school', 'academic_period', 'titulaire']
    
    # Intégration des cours directement dans la vue de la classe
    inlines = [TeachingAssignmentInline]

    fieldsets = (
        (_('Informations de Base'), {
            'fields': ('school', 'academic_period', 'name', 'education_level')
        }),
        (_('Responsabilité'), {
            'fields': ('titulaire', 'description'),
        }),
    )


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    """
    Gestion individuelle des assignations. 
    Utile pour voir la charge horaire globale par enseignant.
    """
    list_display = ('course', 'classe', 'teacher', 'weight', 'is_evaluative')
    list_filter = ('is_evaluative', 'classe__school', 'teacher')
    search_fields = ('course__name', 'classe__name', 'teacher__email')
    autocomplete_fields = ['classe', 'course', 'teacher']
    
@admin.register(GradingPeriod)
class GradingPeriodAdmin(admin.ModelAdmin):
    list_display = ('name', 'academic_period', 'start_date', 'end_date', 'is_exam', 'is_closed', 'sequence_order')
    list_filter = ('academic_period__school', 'academic_period', 'is_exam', 'is_closed')
    search_fields = ('name', 'academic_period__name')
    list_editable = ('start_date', 'end_date', 'is_closed', 'sequence_order')
    ordering = ('academic_period', 'sequence_order')


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = (
        'name', 
        'get_course', 
        'get_classe', 
        'evaluation_type', 
        'grading_period', 
        'max_score', 
        'date', 
        'is_published'
    )
    list_filter = (
        'teaching_assignment__classe__school',
        'grading_period', 
        'evaluation_type', 
        'is_published',
        'date'
    )
    search_fields = ('name', 'teaching_assignment__course__name', 'teaching_assignment__classe__name')
    autocomplete_fields = ['teaching_assignment', 'grading_period']
    inlines = [GradeInline]
    list_select_related = ('teaching_assignment__course', 'teaching_assignment__classe', 'grading_period')
    date_hierarchy = 'date'
    
    fieldsets = (
        (_('Contexte'), {
            'fields': ('teaching_assignment', 'grading_period')
        }),
        (_('Détails de l\'épreuve'), {
            'fields': ('name', 'description', 'evaluation_type', 'date')
        }),
        (_('Paramètres de notation'), {
            'fields': ('max_score', 'weight', 'is_published')
        }),
    )

    def get_course(self, obj):
        return obj.teaching_assignment.course.name
    get_course.short_description = "Cours"
    get_course.admin_order_field = 'teaching_assignment__course__name'

    def get_classe(self, obj):
        return obj.teaching_assignment.classe.name
    get_classe.short_description = "Classe"
    get_classe.admin_order_field = 'teaching_assignment__classe__name'


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'get_evaluation_name', 'score', 'get_max_score', 'percentage_view', 'graded_by')
    list_filter = (
        'evaluation__teaching_assignment__classe__school',
        'evaluation__grading_period', 
        'evaluation__teaching_assignment__course'
    )
    search_fields = (
        'enrollment__student__last_name', 
        'enrollment__student__first_name', 
        'evaluation__name'
    )
    autocomplete_fields = ['enrollment', 'evaluation', 'graded_by']
    readonly_fields = ('created_at',)
    list_select_related = ('enrollment__student', 'evaluation', 'graded_by')

    # --- Méthodes d'affichage ---

    def get_student_name(self, obj):
        return f"{obj.enrollment.student.last_name} {obj.enrollment.student.first_name}"
    get_student_name.short_description = "Élève"

    def get_evaluation_name(self, obj):
        return obj.evaluation.name
    get_evaluation_name.short_description = "Évaluation"

    def get_max_score(self, obj):
        return obj.evaluation.max_score
    get_max_score.short_description = "Sur"

    def percentage_view(self, obj):
        # 1. On extrait la valeur brute
        raw_value = obj.percentage
        
        # 2. Sécurité absolue : on force la conversion en float
        # Si c'est déjà un SafeString ou un texte, float() va extraire le nombre 
        # ou tomber dans le except.
        try:
            numeric_value = float(raw_value)
        except (TypeError, ValueError):
            numeric_value = 0.0

        # 3. couleur
        color = "#28a745" if numeric_value >= 50 else "#dc3545"

        # 4. On formate séparément pour éviter que format_html ne confonde les types
        percentage_text = "{:.1f}%".format(numeric_value)

        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            percentage_text # On passe le texte déjà formaté ici
        )
    percentage_view.short_description = "% Réussite"
