# academia/views.py

from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from django.db import models # Nécessaire pour l'introspection
from users.permissions_backend import CanManageSchoolResources 
from AcademicPeriod.models import AcademicPeriod
from .models import Course, Classe
from .serializers import CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer
from .models import TeachingAssignment

class AcademiaBaseViewSet(viewsets.ModelViewSet):
    """
    Classe de base qui injecte automatiquement l'école de l'utilisateur.
    """
    permission_classes = [CanManageSchoolResources]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return self.queryset.none()
        
        # Filtre toutes les ressources académiques par l'école de l'utilisateur
        return self.queryset.filter(school=user.school)

    def perform_create(self, serializer):
        user = self.request.user
        
        if not user.school:
            raise PermissionDenied("L'utilisateur n'est pas associé à une école.")

        kwargs = {'school': user.school}
        
        # LOGIQUE D'INJECTION DE LA PÉRIODE ACADÉMIQUE
        # Seulement pour les modèles qui en ont besoin (comme Classe)
        if hasattr(serializer.Meta.model, 'academic_period'):
            try:
                active_period = AcademicPeriod.objects.get(school=user.school, is_current=True)
                kwargs['academic_period'] = active_period
            except AcademicPeriod.DoesNotExist:
                raise NotFound("Aucune période académique active trouvée pour cette école. Veuillez en créer une.")
        
        serializer.save(**kwargs)

# --- VUES SPÉCIFIQUES ---

from django.views import View
from django.http import JsonResponse
from django.forms.models import model_to_dict
from .models import Course, Classe, TeachingAssignment
from users.models import User
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import json

# -------------------------------
# Helper: convertir queryset en liste de dict
# -------------------------------
def serialize_queryset(qs, fields=None):
    return [model_to_dict(obj, fields=fields) for obj in qs]

# -------------------------------
# COURSE
# -------------------------------
@method_decorator(csrf_exempt, name='dispatch')
class CourseListCreateView(View):
    def get(self, request):
        courses = Course.objects.all()
        data = serialize_queryset(courses, fields=['id', 'name', 'code', 'description', 'school_id'])
        return JsonResponse(data, safe=False)

    def post(self, request):
        body = json.loads(request.body)
        course = Course.objects.create(
            name=body.get('name'),
            code=body.get('code'),
            description=body.get('description'),
            school_id=body.get('school_id')
        )
        return JsonResponse(model_to_dict(course), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class CourseRetrieveUpdateDeleteView(View):
    def get(self, request, pk):
        course = Course.objects.get(pk=pk)
        return JsonResponse(model_to_dict(course))

    def put(self, request, pk):
        course = Course.objects.get(pk=pk)
        body = json.loads(request.body)
        for field in ['name', 'code', 'description', 'school_id']:
            if field in body:
                setattr(course, field, body[field])
        course.save()
        return JsonResponse(model_to_dict(course))

    def delete(self, request, pk):
        course = Course.objects.get(pk=pk)
        course.delete()
        return JsonResponse({"message": "Course supprimé"})


# -------------------------------
# CLASSE
# -------------------------------
@method_decorator(csrf_exempt, name='dispatch')
class ClasseListCreateView(View):
    def get(self, request):
        classes = Classe.objects.all()
        data = []
        for c in classes:
            data.append({
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "education_level": c.education_level,
                "school_id": c.school_id,
                "academic_period_id": c.academic_period_id,
                "titulaire_id": c.titulaire_id,
                "courses": list(c.courses.values_list('id', flat=True))
            })
        return JsonResponse(data, safe=False)

    def post(self, request):
        body = json.loads(request.body)
        classe = Classe.objects.create(
            name=body.get('name'),
            description=body.get('description'),
            education_level=body.get('education_level'),
            school_id=body.get('school_id'),
            academic_period_id=body.get('academic_period_id'),
            titulaire_id=body.get('titulaire_id')
        )
        if "courses" in body:
            classe.courses.set(body["courses"])
        return JsonResponse({
            "id": classe.id,
            "name": classe.name,
            "courses": list(classe.courses.values_list('id', flat=True))
        }, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class ClasseRetrieveUpdateDeleteView(View):
    def get(self, request, pk):
        c = Classe.objects.get(pk=pk)
        return JsonResponse({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "education_level": c.education_level,
            "school_id": c.school_id,
            "academic_period_id": c.academic_period_id,
            "titulaire_id": c.titulaire_id,
            "courses": list(c.courses.values_list('id', flat=True))
        })

    def put(self, request, pk):
        c = Classe.objects.get(pk=pk)
        body = json.loads(request.body)
        for field in ['name', 'description', 'education_level', 'school_id', 'academic_period_id', 'titulaire_id']:
            if field in body:
                setattr(c, field, body[field])
        c.save()
        if "courses" in body:
            c.courses.set(body["courses"])
        return JsonResponse({
            "id": c.id,
            "name": c.name,
            "courses": list(c.courses.values_list('id', flat=True))
        })

    def delete(self, request, pk):
        c = Classe.objects.get(pk=pk)
        c.delete()
        return JsonResponse({"message": "Classe supprimée"})


# -------------------------------
# TEACHING ASSIGNMENT
# -------------------------------
@method_decorator(csrf_exempt, name='dispatch')
class TeachingAssignmentListCreateView(View):
    def get(self, request):
        assignments = TeachingAssignment.objects.all()
        data = []
        for a in assignments:
            data.append({
                "id": a.id,
                "classe_id": a.classe_id,
                "course_id": a.course_id,
                "teacher_id": a.teacher_id,
                "weight": a.weight,
                "is_evaluative": a.is_evaluative
            })
        return JsonResponse(data, safe=False)

    def post(self, request):
        body = json.loads(request.body)
        assignment = TeachingAssignment.objects.create(
            classe_id=body.get('classe_id'),
            course_id=body.get('course_id'),
            teacher_id=body.get('teacher_id'),
            weight=body.get('weight', 1),
            is_evaluative=body.get('is_evaluative', True)
        )
        return JsonResponse({
            "id": assignment.id,
            "classe_id": assignment.classe_id,
            "course_id": assignment.course_id,
            "teacher_id": assignment.teacher_id
        }, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class TeachingAssignmentRetrieveUpdateDeleteView(View):
    def get(self, request, pk):
        a = TeachingAssignment.objects.get(pk=pk)
        return JsonResponse({
            "id": a.id,
            "classe_id": a.classe_id,
            "course_id": a.course_id,
            "teacher_id": a.teacher_id,
            "weight": a.weight,
            "is_evaluative": a.is_evaluative
        })

    def put(self, request, pk):
        a = TeachingAssignment.objects.get(pk=pk)
        body = json.loads(request.body)
        for field in ['classe_id', 'course_id', 'teacher_id', 'weight', 'is_evaluative']:
            if field in body:
                setattr(a, field, body[field])
        a.save()
        return JsonResponse({
            "id": a.id,
            "classe_id": a.classe_id,
            "course_id": a.course_id,
            "teacher_id": a.teacher_id
        })

    def delete(self, request, pk):
        a = TeachingAssignment.objects.get(pk=pk)
        a.delete()
        return JsonResponse({"message": "Assignation supprimée"})
