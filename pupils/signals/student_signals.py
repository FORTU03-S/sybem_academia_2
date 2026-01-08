from django.db.models.signals import post_save
from django.dispatch import receiver
from django.apps import apps
from pupils.models import Student

@receiver(post_save, sender=Student)
def enroll_student_to_courses(sender, instance, created, **kwargs):

    if not created:
        return

    if not instance.current_classe or not instance.academic_period:
        return

    TeachingAssignment = apps.get_model("academia", "TeachingAssignment")
    Enrollment = apps.get_model("pupils", "Enrollment")

    assignments = TeachingAssignment.objects.filter(
        classe=instance.current_classe,
        academic_period=instance.academic_period
    )

    for assignment in assignments:
        Enrollment.objects.get_or_create(
            student=instance,
            course=assignment.course,
            classe=instance.current_classe,
            academic_period=instance.academic_period
        )
