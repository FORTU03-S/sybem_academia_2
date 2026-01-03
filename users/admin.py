from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import Permission

# Import des modèles locaux
from .models import (
    User,
    CustomRole,
    UserCustomRole,
    PermissionFeature,
    PermissionCategory,
    CustomPermission,
    RolePermission,
    UserInvitation
)

# ----------------------------------------------------------------------
# 1. INLINES (Tableaux imbriqués)
# ----------------------------------------------------------------------

class UserCustomRoleInline(admin.TabularInline):
    model = UserCustomRole
    extra = 1
    fk_name = 'user'
    # Utilisation de raw_id_fields pour éviter les erreurs si CustomRoleAdmin
    # n'est pas encore totalement chargé ou si la liste est trop longue.
    autocomplete_fields = ['role'] 
    raw_id_fields = ['assigned_by'] # Sécurité pour éviter l'erreur de récursivité
    verbose_name = "Rôle attribué"
    verbose_name_plural = "Rôles attribués"


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1
    # On utilise raw_id_fields ici aussi pour éviter l'erreur E039 sur CustomPermission
    autocomplete_fields = ['permission']
    classes = ['collapse']


class CustomPermissionInline(admin.TabularInline):
    model = CustomPermission
    extra = 0
    can_delete = False
    readonly_fields = ['name', 'code']
    classes = ['collapse']

# ----------------------------------------------------------------------
# 2. ADMIN CONFIGURATION
# ----------------------------------------------------------------------

@admin.register(PermissionCategory)
class PermissionCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'order')
    ordering = ('order', 'name')
    # CORRECTION CRITIQUE (E040) : search_fields est OBLIGATOIRE pour être référencé 
    # par autocomplete_fields ailleurs (dans CustomPermissionAdmin)
    search_fields = ['name', 'code']
    inlines = [CustomPermissionInline]

@admin.register(CustomPermission)
class CustomPermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'category', 'is_dangerous', 'requires_approval')
    list_filter = ('category', 'is_dangerous', 'requires_approval')
    search_fields = ('name', 'code', 'description')
    
    # CORRECTION (E039) : 'django_permission' pointe vers le modèle Permission natif.
    # Pour éviter de devoir reconfigurer l'admin natif de Django, on utilise raw_id_fields.
    raw_id_fields = ['django_permission'] 
    
    # Ceci fonctionne maintenant car PermissionCategoryAdmin a search_fields
    autocomplete_fields = ['category'] 
    
    filter_horizontal = ('default_groups',)

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'user_type', 'school', 'status', 'is_active')
    list_filter = ('user_type', 'status', 'is_active', 'school', 'is_staff')
    # search_fields est nécessaire pour que autocomplete_fields=['user'] fonctionne ailleurs
    search_fields = ('email', 'first_name', 'last_name', 'phone_number')
    ordering = ('email',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal Info'), {
            'fields': ('first_name', 'last_name', 'phone_number', 'date_of_birth', 'profile_picture')
        }),
        (_('School & Role Info'), {
            # CORRECTION (E039) : School est externe. Utiliser raw_id_fields garantit 
            # qu'il n'y a pas d'erreur même si l'admin de School n'est pas chargé.
            'fields': ('school', 'user_type', 'status', 'approved_by', 'approved_at')
        }),
        (_('Security & Verification'), {
            'fields': ('must_change_password', 'is_email_verified', 'email_verified_at')
        }),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )

    inlines = [UserCustomRoleInline]
    
    # CORRECTION : On garde approved_by en autocomplete (car UserAdmin a search_fields),
    # mais on passe school en raw_id_fields pour éviter l'erreur.
    autocomplete_fields = ['approved_by']
    raw_id_fields = ['school'] 

@admin.register(CustomRole)
class CustomRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'is_active', 'created_at')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'description') # Requis pour UserCustomRoleInline
    filter_horizontal = ('permissions',)
    inlines = [RolePermissionInline]
    
    # CORRECTION (E039) : School en raw_id_fields
    raw_id_fields = ['school']

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'access_level', 'is_active')
    list_filter = ('access_level', 'is_active')
    search_fields = ('role__name', 'permission__name')
    
    # Fonctionne car CustomRoleAdmin et CustomPermissionAdmin ont search_fields
    autocomplete_fields = ['role', 'permission']

@admin.register(UserCustomRole)
class UserCustomRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_active', 'assigned_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__email', 'role__name')
    
    # CORRECTION : Assigned_by pointe vers User, qui a search_fields, donc OK.
    autocomplete_fields = ['user', 'role', 'assigned_by']

@admin.register(PermissionFeature)
class PermissionFeatureAdmin(admin.ModelAdmin):
    list_display = ('label', 'code', 'module', 'is_active')
    list_filter = ('module', 'is_active')
    search_fields = ('label', 'code')

@admin.register(UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = ('email', 'school', 'invited_by', 'is_expired_display', 'accepted_at')
    list_filter = ('school', 'created_at')
    search_fields = ('email', 'token')
    readonly_fields = ('token', 'created_at')
    filter_horizontal = ('roles',)
    
    # CORRECTION (E039) : School en raw_id_fields, invited_by en autocomplete
    raw_id_fields = ['school']
    autocomplete_fields = ['invited_by']

    @admin.display(boolean=True, description='Expirée')
    def is_expired_display(self, obj):
        return obj.is_expired()