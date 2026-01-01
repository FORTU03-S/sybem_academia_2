# sybem/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# ViewSets
from schools.views import SchoolViewSet
from AcademicPeriod.views import AcademicPeriodViewSet
from modules.views import ModuleViewSet, SchoolModuleViewSet
from academia.views import CourseViewSet, ClasseViewSet, TeachingAssignmentViewSet

# ✅ IMPORTER VOTRE VUE PERSONNALISÉE
from users.api.views import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView 
from users.api.views import LoginAPIView
# --- Router DRF ---
router = DefaultRouter()
router.register(r'schools', SchoolViewSet, basename='school')
router.register(r'academic-periods', AcademicPeriodViewSet)
router.register(r'modules', ModuleViewSet)
router.register(r'school-modules', SchoolModuleViewSet)
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'classes', ClasseViewSet, basename='classe')
router.register(r'assignments', TeachingAssignmentViewSet, basename='assignment')

urlpatterns = [
    # Admin Django
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginAPIView.as_view(), name='login'),  # ✅ Utiliser .as_view()
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include(router.urls)),
    path('api/superadmin/', include('admin_platform.urls')),
    path('api/subscriptions/', include('subscriptions.api.urls')),
    path("api/school/", include("schools.urls")),
    path("api/", include("users.urls")),
    path("api/", include("users.api.urls")),
]