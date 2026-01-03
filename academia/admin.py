from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import Course, Classe, TeachingAssignment

# --- Inlines ---

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
    
    # Utilisation d'autocomplete pour gérer les gros volumes de données
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