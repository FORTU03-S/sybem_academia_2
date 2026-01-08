from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum
from .models import FeeCategory, SchoolFeeConfig, Payment, Expense, StudentBalance

class AcademicPeriodFilter(admin.SimpleListFilter):
    title = 'Année Académique'
    parameter_name = 'academic_period'

    def lookups(self, request, model_admin):
        # On suppose que le modèle AcademicPeriod est importé
        from AcademicPeriod.models import AcademicPeriod
        periods = AcademicPeriod.objects.filter(type='YEAR')
        return [(p.id, str(p)) for p in periods]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(academic_period__id=self.value())
        return queryset

@admin.register(FeeCategory)
class FeeCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'school')
    search_fields = ('name', 'code')

@admin.register(SchoolFeeConfig)
class SchoolFeeConfigAdmin(admin.ModelAdmin):
    list_display = ('category', 'classe', 'amount', 'frequency', 'total_yearly_amount')
    list_filter = ('school', 'classe', 'frequency')
    search_fields = ('category__name', 'classe__name')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'student_link', 'amount_display', 'category', 'status_badge', 'date')
    list_filter = ('status', 'method', AcademicPeriodFilter, 'school')
    search_fields = ('receipt_number', 'student__last_name', 'student__first_name', 'student__student_id_code')
    readonly_fields = ('uid', 'receipt_number', 'date', 'recorded_by')
    date_hierarchy = 'date'

    def student_link(self, obj):
        return format_html('<a href="/admin/pupils/student/{}/change/">{} {}</a>', 
                           obj.student.id, obj.student.last_name, obj.student.first_name)
    student_link.short_description = "Élève"

    def amount_display(self, obj):
        return f"{obj.amount} $"
    amount_display.short_description = "Montant"

    def status_badge(self, obj):
        colors = {'COMPLETED': 'green', 'PENDING': 'orange', 'REJECTED': 'red'}
        return format_html('<span style="color:{}; font-weight:bold;">{}</span>', colors.get(obj.status, 'black'), obj.get_status_display())
    status_badge.short_description = "Statut"

    def get_readonly_fields(self, request, obj=None):
        # Si le paiement est validé, on verrouille tout
        if obj and obj.status == 'COMPLETED':
            return [f.name for f in self.model._meta.fields]
        return self.readonly_fields

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('description', 'amount', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'school')
    
    actions = ['approve_expenses', 'reject_expenses']

    def approve_expenses(self, request, queryset):
        queryset.update(status='APPROVED', approved_by=request.user)
    approve_expenses.short_description = "Approuver les dépenses sélectionnées"

    def reject_expenses(self, request, queryset):
        queryset.update(status='REJECTED', approved_by=request.user)
    reject_expenses.short_description = "Rejeter les dépenses sélectionnées"