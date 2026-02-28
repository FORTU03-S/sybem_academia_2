from django.urls import path
from django.views.generic import TemplateView

app_name = 'core'

urlpatterns = [
    path('', TemplateView.as_view(template_name='core/home.html'), name='home'),
    path('school-dashboard/', TemplateView.as_view(template_name='core/school_dashboard_placeholder.html'), name='home_school_dashboard'), 
]