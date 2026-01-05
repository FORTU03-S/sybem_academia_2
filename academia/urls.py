from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import TeacherDashboardViewSet

# Création du routeur spécifique à l'application Academia
router = DefaultRouter()
router.register(r'courses', views.CourseViewSet)
router.register(r'classes', views.ClasseViewSet)
router.register(r'assignments', views.TeachingAssignmentViewSet)
router.register(
    r"teacher/dashboard",
    TeacherDashboardViewSet,
    basename="teacher-dashboard"
)


urlpatterns = [
    # Le routeur génère automatiquement :
    # /api/academia/courses/
    # /api/academia/classes/
    # /api/academia/assignments/
    path('', include(router.urls)),
]