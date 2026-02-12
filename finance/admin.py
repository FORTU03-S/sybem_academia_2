from django.contrib import admin
from .models import (
    FinanceConfig,
    FeeType,
    FeeStructure,
    StudentExemption,
    Transaction,
    CorrectionRequest
)


# =========================
# CONFIGURATION FINANCE
# =========================
@admin.register(FinanceConfig)
class FinanceConfigAdmin(admin.ModelAdmin):
    list_display = (
        "school",
        "main_currency",
        "exchange_rate",
        "expense_approval_threshold"
    )
    #readonly_fields = ("school",)

   # def has_add_permission(self, request):
        # Une seule config par école
     #   return not FinanceConfig.objects.filter(school=request.user.school).exists()


# =========================
# TYPES DE FRAIS
# =========================
@admin.register(FeeType)
class FeeTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "school")
    list_filter = ("school",)
    search_fields = ("name",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(school=request.user.school)


# =========================
# STRUCTURE DES FRAIS
# =========================
@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = (
        "fee_type",
        "classe",
        "amount",
        "frequency",
        "academic_period",
        "due_date"
    )
    list_filter = ("frequency", "academic_period", "classe")
    search_fields = ("fee_type__name", "classe__name")
    autocomplete_fields = ("fee_type", "classe", "academic_period")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(school=request.user.school)

    def save_model(self, request, obj, form, change):
        if not obj.school_id:
            obj.school = request.user.school
        super().save_model(request, obj, form, change)


# =========================
# EXONÉRATIONS / BOURSES
# =========================
@admin.register(StudentExemption)
class StudentExemptionAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "fee_structure",
        "discount_amount",
        "discount_percentage",
        "approved_by"
    )
    list_filter = ("fee_structure",)
    search_fields = ("student__first_name", "student__last_name")
    autocomplete_fields = ("student", "fee_structure", "approved_by")


# =========================
# TRANSACTIONS FINANCIÈRES
# =========================
@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "receipt_number",
        "transaction_type",
        "student",
        "amount",
        "currency",
        "amount_in_base_currency",
        "status",
        "created_at"
    )

    list_filter = (
        "transaction_type",
        "status",
        "payment_method",
        "currency",
        "created_at"
    )

    search_fields = (
        "receipt_number",
        "student__first_name",
        "student__last_name",
        "description"
    )

    readonly_fields = (
        "receipt_number",
        "amount_in_base_currency",
        "created_at",
        "audited_at"
    )

    autocomplete_fields = (
        "student",
        "fee_structure",
        "created_by",
        "audited_by",
        "validated_by"
    )

    fieldsets = (
        ("Transaction", {
            "fields": (
                "transaction_type",
                "status",
                "payment_method"
            )
        }),
        ("Montants", {
            "fields": (
                "amount",
                "currency",
                "exchange_rate_used",
                "amount_in_base_currency"
            )
        }),
        ("Liens", {
            "fields": (
                "student",
                "fee_structure"
            )
        }),
        ("Traçabilité", {
            "fields": (
                "receipt_number",
                "receipt_file",
                "description",
                "created_by",
                "audited_by",
                "validated_by",
                "created_at",
                "audited_at"
            )
        })
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(school=request.user.school)

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.school = request.user.school
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


# =========================
# DEMANDES DE CORRECTION
# =========================
@admin.register(CorrectionRequest)
class CorrectionRequestAdmin(admin.ModelAdmin):
    list_display = (
        "transaction",
        "requested_by",
        "previous_amount",
        "new_amount",
        "is_approved",
        "created_at"
    )

    list_filter = ("is_approved", "created_at")
    search_fields = ("transaction__receipt_number", "reason")
    autocomplete_fields = ("transaction", "requested_by", "reviewed_by")

    readonly_fields = ("created_at",)

    fieldsets = (
        ("Demande", {
            "fields": (
                "transaction",
                "requested_by",
                "reason"
            )
        }),
        ("Modification", {
            "fields": (
                "previous_amount",
                "new_amount"
            )
        }),
        ("Validation", {
            "fields": (
                "is_approved",
                "reviewed_by",
                "reviewed_at"
            )
        }),
    )
