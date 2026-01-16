# C:\Users\user\sybem_academia2\sybem\sybem\urls.py

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
# --- IMPORT DES VIEWSETS ---
from schools.views import SchoolViewSet
from AcademicPeriod.views import AcademicPeriodViewSet
from modules.views import ModuleViewSet, SchoolModuleViewSet
# Assurons-nous d'importer le UserViewSet. 
# Si tu ne l'as pas créé explicitement, il faudra vérifier où il est.
# Je suppose qu'il est dans users.api.views ou users.views
from users.api.views import LoginAPIView
from rest_framework_simplejwt.views import TokenRefreshView
from academia.views import teacher_gradebook_view
from academia import views
#from users.api.views import SchoolUsersView
# --- ROUTER PRINCIPAL ---
router = DefaultRouter()
router.register(r'schools', SchoolViewSet, basename='school')
router.register(r'academic-periods', AcademicPeriodViewSet) # Crée /api/academic-periods/
router.register(r'modules', ModuleViewSet)
router.register(r'school-modules', SchoolModuleViewSet)
#router.register(r'users', SchoolUsersView, basename='user')
# Si tu as un UserViewSet, décommentes la ligne ci-dessous et importes-le :
# router.register(r'users', UserViewSet, basename='user') 

def root_redirect(request):
    return redirect('/static/dist/html/login.html')

urlpatterns = [
    path('', root_redirect),
    path('admin/', admin.site.urls),
    
    # --- AUTHENTIFICATION ---
    path('api/auth/login/', LoginAPIView.as_view(), name='login'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # --- API PRINCIPALE (Via le Router) ---
    path('api/', include(router.urls)), 
    
    # --- INCLUSIONS DES APPS (C'est ici qu'il manquait des choses) ---
    
    # 1. Correction pour /api/pupils/students/
    # On dit à Django : "Tout ce qui commence par api/pupils/, va voir dans pupils.urls"
    path('api/pupils/', include('pupils.urls')), 

    # 2. Correction pour /api/academia/
    path('api/academia/', include('academia.urls')),

    # 3. Correction pour /api/users/
    # On garde une seule source de vérité pour les users
    # Si ton UserViewSet est géré dans users.api.urls, utilise cette ligne :
    path('api/users/', include('users.api.urls')),
    path("api/", include("users.urls")),
    path("api/", include("users.api.urls")),
    path("api/users/", include("users.api.urls")),
    path('teacher/class/<int:class_id>/gradebook/', teacher_gradebook_view, name='teacher-gradebook-html'),
    # Autres inclusions existantes
    path('teacher/assignment/<int:assignment_id>/gradebook/', views.teacher_gradebook_view, name='teacher-gradebook-html'),
    path('api/superadmin/', include('admin_platform.urls')),
    path('api/subscriptions/', include('subscriptions.api.urls')),
    path("api/school/", include("schools.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)