# users/api/urls.py (Exemple)
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginAPIView, me, ForceChangePasswordAPIView, PasswordResetRequestAPIView,
    SchoolUsersView, SchoolUserDetailView, SchoolRolesListView,
    AcceptInvitationView, SuperAdminUserViewSet
)

router = DefaultRouter()
router.register(r'superadmin/users', SuperAdminUserViewSet, basename='superadmin-users')

urlpatterns = [
    path('auth/login/', LoginAPIView.as_view(), name='login'),
    path('auth/me/', me, name='me'),
    path('auth/change-password/', ForceChangePasswordAPIView.as_view(), name='change-password'),
    path('auth/reset-password/', PasswordResetRequestAPIView.as_view(), name='reset-password'),
    
    path('school/users/', SchoolUsersView.as_view(), name='school-users-list-create'),
    path('school/users/<int:pk>/', SchoolUserDetailView.as_view(), name='school-users-detail'), # Pour delete/toggle
    path('school/roles/', SchoolRolesListView.as_view(), name='school-roles'),
    
    path('invitation/accept/', AcceptInvitationView.as_view(), name='accept-invitation'),
    
    path('', include(router.urls)),
]