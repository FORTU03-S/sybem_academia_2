from django.contrib import admin
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from pupils.models import Student, Parent, Enrollment


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):

    list_display = (
        "full_name",
        "gender",
        "school",
        "current_classe",
        "academic_period",
        "status_badge",
        "enrollment_date",
    )

    list_filter = (
        "school",
        "academic_period",
        "current_classe",
        "status",
        "gender",
    )

    search_fields = (
        "last_name",
        "middle_name",
        "first_name",
        "student_id_code",
    )

    ordering = ("last_name", "first_name")

    autocomplete_fields = (
        "school",
        "current_classe",
        "academic_period",
        "parents",
    )

    readonly_fields = (
        "enrollment_date",
        "dropped_at",
    )

    fieldsets = (
        (_("Identité de l'élève"), {
            "fields": (
                ("last_name", "middle_name", "first_name"),
                ("gender", "date_of_birth"),
                "profile_picture",
                "student_id_code",
            )
        }),
        (_("Scolarité"), {
            "fields": (
                "school",
                "academic_period",
                "current_classe",
                "status",
            )
        }),
        (_("Parents"), {
            "fields": ("parents",)
        }),
        (_("Suivi"), {
            "fields": (
                "enrollment_date",
                "dropped_at",
            )
        }),
    )

    actions = ["mark_as_dropped", "mark_as_active"]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            "school",
            "current_classe",
            "academic_period",
        ).prefetch_related("parents")

    @admin.display(description="Nom complet")
    def full_name(self, obj):
        return f"{obj.last_name} {obj.middle_name or ''} {obj.first_name}"

    @admin.display(description="Statut")
    def status_badge(self, obj):
        if obj.status == Student.STATUS_ACTIVE:
            color = "#28a745"
            label = "Actif"
        else:
            color = "#dc3545"
            label = "Abandonné"

        return format_html(
            '<span style="color:white; background:{}; padding:3px 8px; border-radius:6px;">{}</span>',
            color,
            label
        )

    @admin.action(description="Marquer comme abandonné")
    def mark_as_dropped(self, request, queryset):
        queryset.update(status=Student.STATUS_DROPPED)

    @admin.action(description="Marquer comme actif")
    def mark_as_active(self, request, queryset):
        queryset.update(status=Student.STATUS_ACTIVE)


@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):

    list_display = (
        "user",
        "school",
        "is_approved",
    )

    list_filter = (
        "school",
        "is_approved",
    )

    search_fields = (
        "user__email",
        "user__first_name",
        "user__last_name",
    )

    autocomplete_fields = (
        "user",
        "school",
    )


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):

    list_display = (
        "student",
        "course",
        "classe",
        "academic_period",
        "status",
    )

    list_filter = (
        "academic_period",
        "classe",
        "status",
    )

    search_fields = (
        "student__last_name",
        "student__first_name",
        "course__name",
    )

    autocomplete_fields = (
        "student",
        "course",
        "classe",
        "academic_period",
    )

    ordering = (
        "academic_period",
        "classe",
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            "student",
            "course",
            "classe",
            "academic_period",
        )
