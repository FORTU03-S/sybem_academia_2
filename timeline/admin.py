from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from .models import Timeline

@admin.register(Timeline)
class TimelineAdmin(admin.ModelAdmin):
    """
    Journal d'audit du système (Logs). 
    Lecture seule par défaut pour garantir l'intégrité des traces.
    """
    
    # Configuration de la liste
    list_display = ('created_at', 'school', 'user_link', 'action_badge', 'module', 'action_label', 'ip_address')
    list_filter = ('action_type', 'module', 'school', 'created_at')
    search_fields = ('user__email', 'user__username', 'action_label', 'metadata', 'ip_address')
    date_hierarchy = 'created_at' # Barre de navigation temporelle en haut
    
    # Optimisation des performances
    autocomplete_fields = ['school', 'user']
    
    # Rendre l'admin en lecture seule (un log ne doit pas être modifié)
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False

    # --- Méthodes d'affichage personnalisées ---

    def action_badge(self, obj):
        """Affiche un badge coloré selon le type d'action."""
        colors = {
            'create': '#28a745', # Vert
            'update': '#ffc107', # Jaune
            'delete': '#dc3545', # Rouge
            'login': '#17a2b8',  # Bleu info
            'logout': '#6c757d', # Gris
        }
        color = colors.get(obj.action_type, '#000')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85em;">{}</span>',
            color, obj.get_action_type_display()
        )
    action_badge.short_description = _("Action")

    def user_link(self, obj):
        """Affiche l'utilisateur avec un lien vers sa fiche s'il existe."""
        if obj.user:
            return obj.user.email
        return format_html('<i style="color: #999;">{}</i>', _("Système/Inconnu"))
    user_link.short_description = _("Utilisateur")

    # --- Organisation du formulaire de détail ---
    
    fieldsets = (
        (_('Horodatage & Acteur'), {
            'fields': ('created_at', 'school', 'user', 'ip_address')
        }),
        (_('Détails de l\'action'), {
            'fields': ('action_type', 'module', 'action_label')
        }),
        (_('Données Techniques'), {
            'fields': ('metadata',),
            'classes': ('collapse',), # Caché par défaut car souvent long
        }),
    )
    
    readonly_fields = ('created_at', 'school', 'user', 'action_type', 'module', 'action_label', 'metadata', 'ip_address')