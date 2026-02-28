from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import Permission
from django.contrib.auth.password_validation import password_validators_help_text_html

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


class CustomUserCreationForm(UserCreationForm):
    """Formulaire pour la CRÉATION d'un utilisateur"""
    
    password = forms.CharField(
        label=_("Password"), 
        widget=forms.PasswordInput, 
        strip=False,
        help_text=password_validators_help_text_html()
    )
    password_2 = forms.CharField(
        label=_("Password confirmation"), 
        widget=forms.PasswordInput, 
        strip=False,
        help_text=_("Enter the same password as before, for verification.")
    )

    class Meta:
        model = User
        fields = ('email', 'first_name', 'last_name')

    def save(self, commit=True):
        user = super().save(commit=False)
        if not user.username:
            user.username = user.email
        if commit:
            user.save()
        return user

class CustomUserChangeForm(UserChangeForm):
    """Formulaire pour la MODIFICATION d'un utilisateur"""
    class Meta:
        model = User
        fields = '__all__'

class UserCustomRoleInline(admin.TabularInline):
    model = UserCustomRole
    extra = 1
    fk_name = 'user'
    autocomplete_fields = ['role'] 
    raw_id_fields = ['assigned_by']
    verbose_name = "Rôle attribué"
    verbose_name_plural = "Rôles attribués"


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1
    autocomplete_fields = ['permission']
    classes = ['collapse']


class CustomPermissionInline(admin.TabularInline):
    model = CustomPermission
    extra = 0
    can_delete = False
    readonly_fields = ['name', 'code']
    classes = ['collapse']

@admin.register(PermissionCategory)
class PermissionCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'order')
    ordering = ('order', 'name')
    search_fields = ['name', 'code']
    inlines = [CustomPermissionInline]

@admin.register(CustomPermission)
class CustomPermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'category', 'is_dangerous', 'requires_approval')
    list_filter = ('category', 'is_dangerous', 'requires_approval')
    search_fields = ('name', 'code', 'description')
    
    raw_id_fields = ['django_permission'] 
    autocomplete_fields = ['category'] 
    filter_horizontal = ('default_groups',)

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = User

    list_display = ('email', 'first_name', 'last_name', 'user_type', 'school', 'status', 'is_active')
    list_filter = ('user_type', 'status', 'is_active', 'school', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name', 'phone_number')
    ordering = ('email',)
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password', 'password_2'),
        }),
    )

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal Info'), {
            'fields': ('first_name', 'last_name', 'phone_number', 'date_of_birth', 'profile_picture')
        }),
        (_('School & Role Info'), {
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
    
    autocomplete_fields = ['approved_by']
    raw_id_fields = ['school'] 

@admin.register(CustomRole)
class CustomRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'is_active', 'created_at')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'description')
    filter_horizontal = ('permissions',)
    inlines = [RolePermissionInline]
    raw_id_fields = ['school']

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'access_level', 'is_active')
    list_filter = ('access_level', 'is_active')
    search_fields = ('role__name', 'permission__name')
    autocomplete_fields = ['role', 'permission']

@admin.register(UserCustomRole)
class UserCustomRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_active', 'assigned_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__email', 'role__name')
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
    raw_id_fields = ['school']
    autocomplete_fields = ['invited_by']

    @admin.display(boolean=True, description='Expirée')
    def is_expired_display(self, obj):
        return obj.is_expired()