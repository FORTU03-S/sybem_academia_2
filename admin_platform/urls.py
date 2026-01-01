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

#from .views.school_dashboard import direction_dashboard_view  
#from admin_platform.views import direction_dashboard_view


router = DefaultRouter()
router.register(r'users', SuperAdminUserViewSet, basename='superadmin-users')

app_name = 'admin_platform'

urlpatterns = [
    # 📊 Dashboard
    path('dashboard/', SuperAdminDashboardStatsAPIView.as_view(), name='dashboard_stats'),

    # 🏫 Écoles
    path('schools/', SchoolListCreateAPIView.as_view(), name='school_list_create'),
    path('schools/<int:pk>/', SchoolDetailAPIView.as_view(), name='school_detail'),
    

    # 💳 Plans d'abonnement
    #path('subscriptions/plans/', SubscriptionPlanListCreateAPIView.as_view(), name='plan_list_create'),
    path('subscriptions/plans/<int:pk>/', SubscriptionPlanDetailAPIView.as_view(), name='plan_detail'),
 #   path('direction/dashboard/', direction_dashboard_view, name='direction-dashboard'),
    

    # 👥 Users (ViewSet)
    path('', include(router.urls)),
]
