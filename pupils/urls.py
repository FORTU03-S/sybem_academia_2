# pupils/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from pupils.api.views.student_views import StudentViewSet # Assure-toi que StudentViewSet existe

router = DefaultRouter()
# C'est ici que 'students' est défini
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = [
    path('', include(router.urls)),
]