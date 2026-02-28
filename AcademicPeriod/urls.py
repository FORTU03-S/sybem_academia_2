
from rest_framework.routers import DefaultRouter
from .views import AcademicPeriodViewSet

router = DefaultRouter()
router.register(r'academic-periods', AcademicPeriodViewSet)

urlpatterns = router.urls