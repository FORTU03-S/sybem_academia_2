from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from django.utils import timezone
from .models import (
    SystemModule, SubscriptionPlan, PlanModule, 
    SchoolSubscription, SchoolModuleAccess, Payment, Invoice
)

# --- INLINES ---

class PlanModuleInline(admin.TabularInline):
    model = PlanModule
    extra = 1
    autocomplete_fields = ['module']

class SchoolModuleAccessInline(admin.TabularInline):
    model = SchoolModuleAccess
    extra = 0
    readonly_fields = ('last_used', 'usage_count')

class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ('amount', 'currency', 'payment_method', 'status', 'payment_date')
    readonly_fields = ('payment_date',)

# --- CONFIGURATIONS ADMIN ---

@admin.register(SystemModule)
class SystemModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'module_type', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    search_fields = ('name', 'code')
    list_filter = ('module_type', 'is_active')

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_per_unit', 'duration_display', 'max_users', 'is_active', 'is_public')
    list_filter = ('is_active', 'duration_unit', 'is_public')
    search_fields = ('name', 'code')
    inlines = [PlanModuleInline]
    
    def duration_display(self, obj):
        return obj.get_duration_display()
    duration_display.short_description = _("Durée")

@admin.register(SchoolSubscription)
class SchoolSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('school', 'plan', 'status_badge', 'days_left', 'current_usage')
    list_filter = ('status', 'is_active', 'plan')
    search_fields = ('school__name', 'reference')
    autocomplete_fields = ['school', 'plan']
    inlines = [SchoolModuleAccessInline, PaymentInline]
    readonly_fields = ('reference', 'current_users', 'current_students', 'storage_used_gb')

    def status_badge(self, obj):
        colors = {
            'ACTIVE': 'green',
            'PENDING': 'orange',
            'EXPIRED': 'red',
            'SUSPENDED': 'gray',
            'CANCELLED': 'black',
        }
        color = colors.get(obj.status, 'blue')
        return format_html(
            '<span style="background: {}; color: white; padding: 3px 8px; border-radius: 5px; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Statut"

    def days_left(self, obj):
        days = obj.days_remaining()
        color = "red" if days <= 7 else "inherit"
        return format_html('<span style="color: {};">{} jrs</span>', color, days)
    days_left.short_description = "Restant"

    def current_usage(self, obj):
        return format_html("👥 {}/{} | 🎓 {}/{}", 
            obj.current_users, obj.plan.max_users,
            obj.current_students, obj.plan.max_students
        )
    current_usage.short_description = "Utilisation (U/S)"

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_id', 'school_name', 'amount_display', 'status', 'payment_date')
    list_filter = ('status', 'payment_method', 'currency')
    search_fields = ('transaction_id', 'school_subscription__school__name')
    autocomplete_fields = ['school_subscription']

    def school_name(self, obj):
        return obj.school_subscription.school.name
    
    def amount_display(self, obj):
        return f"{obj.amount} {obj.currency}"
    amount_display.short_description = "Montant"

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'school_subscription', 'total_amount', 'status', 'due_date')
    list_filter = ('status', 'issue_date')
    search_fields = ('invoice_number', 'school_subscription__school__name')
    date_hierarchy = 'issue_date'