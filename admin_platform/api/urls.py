from django.urls import path
from .views.school_dashboard import DirectionDashboardStatsAPIView
from .views.timeline import DirectionTimelineAPIView
from .views.users import (
    DirectionUsersListAPIView,
    ToggleUserStatusAPIView,
    AssignCustomRoleAPIView
)
from admin_platform.views import direction_dashboard_view

urlpatterns = [
    path('dashboard/stats/', DirectionDashboardStatsAPIView.as_view()),
    path('dashboard/timeline/', DirectionTimelineAPIView.as_view()),
    path('dashboard/users/', DirectionUsersListAPIView.as_view()),
    path('dashboard/users/<int:user_id>/toggle/', ToggleUserStatusAPIView.as_view()),
    path('dashboard/users/<int:user_id>/assign-role/', AssignCustomRoleAPIView.as_view()),
     path('direction/dashboard/', direction_dashboard_view, name='direction-dashboard'),
]
