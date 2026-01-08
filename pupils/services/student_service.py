from django.utils import timezone
from django.apps import apps
from pupils.models import Student

class StudentService:

    @staticmethod
    def create_student(data, school):
        student = Student.objects.create(
            school=school,
            **data
        )
        return student

    @staticmethod
    def drop_student(student):
        student.status = Student.STATUS_DROPPED
        student.dropped_at = timezone.now().date()
        student.save()
