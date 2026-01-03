from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import School, SchoolMembership, SchoolRoleAssignment

# --- Inlines pour une gestion centralisée ---

class SchoolRoleAssignmentInline(admin.TabularInline):
    model = SchoolRoleAssignment
    extra = 1
    autocomplete_fields = ['role']


class SchoolMembershipInline(admin.TabularInline):
    model = SchoolMembership
    extra = 0
    show_change_link = True


# --- Configurations Admin ---

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    """
    Gestion complète des écoles avec organisation par sections.
    """
    list_display = ('name', 'code', 'school_type', 'status', 'academic_period', 'created_at')
    list_filter = ('school_type', 'status', 'academic_period')
    search_fields = ('name', 'code', 'email', 'phone_number')
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ['school_admin', 'academic_period', 'created_by']
    
    inlines = [SchoolMembershipInline]

    fieldsets = (
        (_('Informations Générales'), {
            'fields': ('name', 'code', 'school_type', 'status', 'logo')
        }),
        (_('Administration & Période'), {
            'fields': ('school_admin', 'academic_period')
        }),
        (_('Contact'), {
            'fields': ('email', 'phone_number', 'address'),
            'classes': ('collapse',),
        }),
        (_('Quotas & Limites'), {
            'fields': ('max_students', 'max_staff', 'max_teachers'),
            'description': _("Limites définies par le Super Administrateur.")
        }),
        (_('Métadonnées'), {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def save_model(self, request, obj, form, change):
        """Assigne automatiquement le créateur lors de la première sauvegarde."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SchoolMembership)
class SchoolMembershipAdmin(admin.ModelAdmin):
    """
    Gère l'appartenance d'un utilisateur à une école.
    """
    list_display = ('user', 'school', 'is_active', 'joined_at')
    list_filter = ('is_active', 'school')
    search_fields = ('user__email', 'user__username', 'school__name')
    autocomplete_fields = ['user', 'school']
    inlines = [SchoolRoleAssignmentInline]


@admin.register(SchoolRoleAssignment)
class SchoolRoleAssignmentAdmin(admin.ModelAdmin):
    """
    Gère l'assignation des rôles spécifiques.
    """
    list_display = ('membership', 'role', 'is_active')
    list_filter = ('is_active', 'role')
    autocomplete_fields = ['membership', 'role']