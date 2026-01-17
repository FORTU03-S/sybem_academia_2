from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'courses', views.CourseViewSet, basename='course')
router.register(r'classes', views.ClasseViewSet, basename='classe')
router.register(r'assignments', views.TeachingAssignmentViewSet, basename='teaching-assignment')
router.register(r"teacher-dashboard", views.TeacherDashboardViewSet, basename="teacher-dashboard")
router.register(r'grading-periods', views.GradingPeriodViewSet, basename='grading-period')
router.register(r'evaluations', views.EvaluationViewSet, basename='evaluation')
router.register(r'grades', views.GradeViewSet, basename='grade') # Gère request-change

urlpatterns = [
    path('', include(router.urls)),
]