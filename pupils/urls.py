
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from pupils.api.views.student_views import StudentViewSet 

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = [
    path('', include(router.urls)),
]