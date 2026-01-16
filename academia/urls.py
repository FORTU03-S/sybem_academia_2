from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import TeacherDashboardViewSet, EvaluationViewSet, GradeViewSet, GradingPeriodViewSet

# --- CRÉATION DU ROUTEUR (UNE SEULE FOIS) ---
router = DefaultRouter()

# Enregistrement des ViewSets
router.register(r'courses', views.CourseViewSet, basename='course')
router.register(r'classes', views.ClasseViewSet, basename='classe')
router.register(r'assignments', views.TeachingAssignmentViewSet, basename='teaching-assignment')

# ✅ Utilisons "teacher-dashboard" (avec tiret) pour éviter les erreurs de slash
router.register(r"teacher-dashboard", TeacherDashboardViewSet, basename="teacher-dashboard")

# Suite des enregistrements (sans recréer le routeur !)
router.register(r'grading-periods', GradingPeriodViewSet, basename='grading-period')
router.register(r'evaluations', EvaluationViewSet)
router.register(r'grades', GradeViewSet)

urlpatterns = [
    # Le routeur génère maintenant correctement :
    # /api/academia/teacher-dashboard/
    path('', include(router.urls)),
]