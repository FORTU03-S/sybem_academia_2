# sybem/admin.py - VERSION PRO+

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from django.db.models import F, Q

# --- Importer toutes les apps ---
from academia.models import Course, Classe, TeachingAssignment
from AcademicPeriod.models import AcademicPeriod
from modules.models import Module, SchoolModule
from schools.models import School, SchoolMembership, SchoolRoleAssignment
from subscriptions.models import (
    SystemModule, SubscriptionPlan, PlanModule, SchoolSubscription,
    SchoolModuleAccess, Payment, Invoice
)
from timeline.models import Timeline
from users.models import (
    User, CustomRole, UserCustomRole, PermissionFeature, PermissionCategory,
    CustomPermission, RolePermission, UserInvitation
)

# -----------------------------
# 1. ADMIN POUR ACADEMIA
# -----------------------------
class TeachingAssignmentInline(admin.TabularInline):
    model = TeachingAssignment
    extra = 1
    autocomplete_fields = ['teacher', 'course']

@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    list_display = ('name', 'education_level', 'school', 'academic_period', 'titulaire')
    list_filter = ('school', 'academic_period', 'education_level')
    search_fields = ('name', 'description', 'titulaire__email')
    autocomplete_fields = ['school', 'academic_period', 'titulaire', 'courses']
    inlines = [TeachingAssignmentInline]

    actions = ['duplicate_classes', 'reassign_teacher']

    # --- Actions professionnelles ---
    def duplicate_classes(self, request, queryset):
        for obj in queryset:
            new_obj = Classe.objects.create(
                school=obj.school,
                education_level=obj.education_level,
                name=f"{obj.name} (Copie)",
                description=obj.description,
                academic_period=obj.academic_period,
                titulaire=obj.titulaire
            )
            new_obj.courses.set(obj.courses.all())
        self.message_user(request, f"{queryset.count()} classe(s) dupliquée(s) ✅")
    duplicate_classes.short_description = "Dupliquer les classes sélectionnées"

    def reassign_teacher(self, request, queryset):
        for obj in queryset:
            if obj.titulaire:
                obj.titulaire = None
                obj.save()
        self.message_user(request, "Enseignant réinitialisé pour les classes sélectionnées")
    reassign_teacher.short_description = "Réinitialiser l'enseignant titulaire"

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'school')
    list_filter = ('school',)
    search_fields = ('name', 'code',)
    autocomplete_fields = ['school']

# -----------------------------
# 2. ADMIN POUR ACADEMIC PERIOD
# -----------------------------
@admin.register(AcademicPeriod)
class AcademicPeriodAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'type', 'start_date', 'end_date', 'is_current', 'colored_current')
    list_filter = ('school', 'type', 'is_current')
    search_fields = ('name', 'school__name')
    autocomplete_fields = ['school']

    def colored_current(self, obj):
        color = "green" if obj.is_current else "red"
        label = "En cours" if obj.is_current else "Terminé"
        return format_html('<b><span style="color: {}">{}</span></b>', color, label)
    colored_current.short_description = "Statut"

# -----------------------------
# 3. ADMIN POUR MODULES
# -----------------------------
@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name', 'code')

@admin.register(SchoolModule)
class SchoolModuleAdmin(admin.ModelAdmin):
    list_display = ('school', 'module', 'is_active')
    list_filter = ('school', 'is_active')
    autocomplete_fields = ['school', 'module']

# -----------------------------
# 4. ADMIN POUR SCHOOLS
# -----------------------------
class SchoolMembershipInline(admin.TabularInline):
    model = SchoolMembership
    extra = 1
    autocomplete_fields = ['user']

class SchoolRoleAssignmentInline(admin.TabularInline):
    model = SchoolRoleAssignment
    extra = 1
    autocomplete_fields = ['role']

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'school_type', 'status_colored', 'max_students', 'max_teachers', 'current_academic_period')
    list_filter = ('school_type', 'status')
    search_fields = ('name', 'code')
    inlines = [SchoolMembershipInline, SchoolRoleAssignmentInline]

    def status_colored(self, obj):
        colors = {
            'DRAFT': 'gray',
            'ACTIVE': 'green',
            'SUSPENDED': 'orange',
            'EXPIRED': 'red'
        }
        return format_html('<b><span style="color:{}">{}</span></b>', colors.get(obj.status, 'black'), obj.status)
    status_colored.short_description = "Statut"

    def current_academic_period(self, obj):
        return obj.academic_period
    current_academic_period.short_description = "Année académique active"

# -----------------------------
# 5. ADMIN POUR SUBSCRIPTIONS
# -----------------------------
@admin.register(SystemModule)
class SystemModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'module_type', 'is_active', 'order')
    list_filter = ('module_type', 'is_active')
    search_fields = ('name', 'code')

class PlanModuleInline(admin.TabularInline):
    model = PlanModule
    extra = 1
    autocomplete_fields = ['module']

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_per_unit', 'duration_value', 'duration_unit', 'is_active')
    inlines = [PlanModuleInline]
    actions = ['activate_plans', 'deactivate_plans']

    def activate_plans(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f"{queryset.count()} plan(s) activé(s)")
    activate_plans.short_description = "Activer les plans sélectionnés"

    def deactivate_plans(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} plan(s) désactivé(s)")
    deactivate_plans.short_description = "Désactiver les plans sélectionnés"

class SchoolModuleAccessInline(admin.TabularInline):
    model = SchoolModuleAccess
    extra = 1
    autocomplete_fields = ['module']

@admin.register(SchoolSubscription)
class SchoolSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('school', 'plan', 'status_colored', 'is_active_colored', 'days_remaining_colored')
    list_filter = ('status', 'is_active')
    search_fields = ('school__name',)
    inlines = [SchoolModuleAccessInline]
    actions = ['activate_subscription', 'deactivate_subscription']

    def status_colored(self, obj):
        colors = {
            'ACTIVE': 'green',
            'PENDING': 'orange',
            'SUSPENDED': 'red',
            'EXPIRED': 'darkred',
            'CANCELLED': 'gray'
        }
        return format_html('<b><span style="color:{}">{}</span></b>', colors.get(obj.status, 'black'), obj.status)
    status_colored.short_description = "Statut"

    def is_active_colored(self, obj):
        color = "green" if obj.is_active else "red"
        label = "Actif" if obj.is_active else "Inactif"
        return format_html('<b><span style="color:{}">{}</span></b>', color, label)
    is_active_colored.short_description = "Actif"

    def days_remaining_colored(self, obj):
        days = obj.days_remaining()
        color = "green" if days > 10 else "orange" if days > 0 else "red"
        return format_html('<span style="color:{};">{} jour(s)</span>', color, days)
    days_remaining_colored.short_description = "Jours restants"

    def activate_subscription(self, request, queryset):
        queryset.update(is_active=True, status='ACTIVE')
        self.message_user(request, f"{queryset.count()} abonnement(s) activé(s)")
    activate_subscription.short_description = "Activer abonnement(s)"

    def deactivate_subscription(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} abonnement(s) désactivé(s)")
    deactivate_subscription.short_description = "Désactiver abonnement(s)"

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('school_subscription', 'amount', 'currency', 'status_colored', 'payment_method', 'payment_date')
    list_filter = ('status', 'payment_method')
    search_fields = ('school_subscription__school__name', 'transaction_id')

    def status_colored(self, obj):
        colors = {
            'PENDING': 'orange',
            'COMPLETED': 'green',
            'FAILED': 'red',
            'REFUNDED': 'blue',
            'CANCELLED': 'gray'
        }
        return format_html('<b><span style="color:{}">{}</span></b>', colors.get(obj.status, 'black'), obj.status)
    status_colored.short_description = "Statut"

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'school_subscription', 'status_colored', 'issue_date', 'due_date')
    list_filter = ('status',)
    search_fields = ('invoice_number', 'school_subscription__school__name')

    def status_colored(self, obj):
        colors = {
            'DRAFT': 'gray',
            'SENT': 'orange',
            'PAID': 'green',
            'OVERDUE': 'red',
            'CANCELLED': 'black'
        }
        return format_html('<b><span style="color:{}">{}</span></b>', colors.get(obj.status, 'black'), obj.status)
    status_colored.short_description = "Statut"

# -----------------------------
# 6. ADMIN POUR TIMELINE
# -----------------------------
@admin.register(Timeline)
class TimelineAdmin(admin.ModelAdmin):
    list_display = ('school', 'user', 'action_type', 'action_label', 'module', 'created_at')
    list_filter = ('school', 'action_type')
    search_fields = ('user__email', 'action_label', 'module')

# -----------------------------
# 7. ADMIN POUR USERS
# -----------------------------
class UserCustomRoleInline(admin.TabularInline):
    model = UserCustomRole
    extra = 1
    autocomplete_fields = ['role', 'assigned_by']
    readonly_fields = ['assigned_at']

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'get_full_name', 'user_type', 'school', 'status_colored', 'is_email_verified_colored')
    list_filter = ('user_type', 'status', 'school', 'is_email_verified')
    search_fields = ('email', 'first_name', 'last_name')
    autocomplete_fields = ['school', 'custom_role', 'approved_by']
    inlines = [UserCustomRoleInline]

    def status_colored(self, obj):
        colors = {'pending': 'orange', 'active': 'green', 'suspended': 'red'}
        return format_html('<b><span style="color:{}">{}</span></b>', colors.get(obj.status, 'black'), obj.status)
    status_colored.short_description = "Statut"

    def is_email_verified_colored(self, obj):
        color = 'green' if obj.is_email_verified else 'red'
        return format_html('<b><span style="color:{}">{}</span></b>', color, obj.is_email_verified)
    is_email_verified_colored.short_description = "Email vérifié"

@admin.register(CustomRole)
class CustomRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'is_active_colored')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'school__name')

    def is_active_colored(self, obj):
        color = "green" if obj.is_active else "red"
        return format_html('<b><span style="color:{}">{}</span></b>', color, obj.is_active)
    is_active_colored.short_description = "Actif"

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'access_level', 'is_active_colored')
    list_filter = ('role', 'permission', 'access_level', 'is_active')
    autocomplete_fields = ['permission', 'role']

    def is_active_colored(self, obj):
        color = "green" if obj.is_active else "red"
        return format_html('<b><span style="color:{}">{}</span></b>', color, obj.is_active)
    is_active_colored.short_description = "Actif"

@admin.register(CustomPermission)
class CustomPermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'category', 'requires_approval', 'is_dangerous')
    list_filter = ('category', 'requires_approval', 'is_dangerous')
    autocomplete_fields = ['category', 'default_groups']

@admin.register(PermissionCategory)
class PermissionCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'order')
    search_fields = ('name', 'code')

@admin.register(UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = ('email', 'school', 'invited_by', 'token', 'expires_at', 'accepted_at', 'expired_colored')
    autocomplete_fields = ['school', 'invited_by', 'roles']

    def expired_colored(self, obj):
        color = 'red' if obj.is_expired() else 'green'
        return format_html('<b><span style="color:{}">{}</span></b>', color, obj.is_expired())
    expired_colored.short_description = "Expiré"
