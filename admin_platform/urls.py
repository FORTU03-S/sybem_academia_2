from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SuperAdminDashboardStatsAPIView,
    SchoolListCreateAPIView,
    SchoolDetailAPIView,
    SubscriptionPlanListCreateAPIView,
    SubscriptionPlanDetailAPIView,
    SuperAdminUserViewSet
)
from rest_framework_simplejwt.authentication import JWTAuthentication   




router = DefaultRouter()
router.register(r'users', SuperAdminUserViewSet, basename='superadmin-users')

app_name = 'admin_platform'

urlpatterns = [
   
    path('dashboard/', SuperAdminDashboardStatsAPIView.as_view(), name='dashboard_stats'),

    path('schools/', SchoolListCreateAPIView.as_view(), name='school_list_create'),
    path('schools/<int:pk>/', SchoolDetailAPIView.as_view(), name='school_detail'),
    path('subscriptions/plans/<int:pk>/', SubscriptionPlanDetailAPIView.as_view(), name='plan_detail'),

    path('', include(router.urls)),
]
