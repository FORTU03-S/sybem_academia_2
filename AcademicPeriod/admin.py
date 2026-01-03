from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import AcademicPeriod

@admin.register(AcademicPeriod)
class AcademicPeriodAdmin(admin.ModelAdmin):
    """
    Configuration Admin pour les périodes académiques.
    Le champ 'search_fields' permet de résoudre l'erreur autocomplete_fields.
    """
    
    # Configuration pour permettre l'autocomplétion depuis l'admin School
    search_fields = ('name', 'school__name')
    
    list_display = (
        'name', 
        'school', 
        'type', 
        'start_date', 
        'end_date', 
        'is_current'
    )
    
    list_filter = ('type', 'is_current', 'school')
    
    # Permet de sélectionner l'école rapidement via une recherche
    autocomplete_fields = ['school', 'created_by']
    
    readonly_fields = ('created_at',)
    
    fieldsets = (
        (_('Identification'), {
            'fields': ('school', 'name', 'type')
        }),
        (_('Calendrier'), {
            'fields': (('start_date', 'end_date'), 'is_current'),
            'description': _("Définissez les dates de début et de fin de cette période.")
        }),
        (_('Métadonnées'), {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',),
        }),
    )

    def save_model(self, request, obj, form, change):
        """Assigne l'utilisateur connecté comme créateur."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    # Optionnel : Une action pour marquer plusieurs périodes comme 'en cours'
    @admin.action(description=_("Marquer comme période en cours"))
    def make_current(self, request, queryset):
        queryset.update(is_current=True)
    
    actions = [make_current]