from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import TeacherDashboardViewSet, EvaluationViewSet, GradeViewSet

# Création du routeur spécifique à l'application Academia
router = DefaultRouter()
router.register(r'courses', views.CourseViewSet, basename='course')
router.register(r'classes', views.ClasseViewSet, basename='classe')
router.register(r'assignments', views.TeachingAssignmentViewSet, basename='teaching-assignment')
router.register(
    r"teacher/dashboard",
    TeacherDashboardViewSet,
    basename="teacher-dashboard"
)
router.register(r'evaluations', EvaluationViewSet) # <-- Nouveau
router.register(r'grades', GradeViewSet)


urlpatterns = [
    # Le routeur génère automatiquement :
    # /api/academia/courses/
    # /api/academia/classes/
    # /api/academia/assignments/
    path('', include(router.urls)),
]