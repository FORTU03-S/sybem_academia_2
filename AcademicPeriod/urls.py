# AcademicPeriod/urls.py
from rest_framework.routers import DefaultRouter
from .views import AcademicPeriodViewSet

router = DefaultRouter()
# Enregistre les 5 routes CRUD sous le préfixe 'academic-periods'
router.register(r'academic-periods', AcademicPeriodViewSet)

urlpatterns = router.urls