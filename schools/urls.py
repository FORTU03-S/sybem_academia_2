from django.urls import path
from .views import SchoolDashboardAPIView

urlpatterns = [
    path("dashboard/", SchoolDashboardAPIView.as_view(), name="school-dashboard"),
]
