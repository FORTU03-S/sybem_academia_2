# academia/urls.py
from django.urls import path
from . import views


urlpatterns = [
    # Courses
    path('courses/', views.CourseListCreateView.as_view(), name='courses_list_create'),
    path('courses/<int:pk>/', views.CourseRetrieveUpdateDeleteView.as_view(), name='course_detail'),

    # Classes
    path('classes/', views.ClasseListCreateView.as_view(), name='classes_list_create'),
    path('classes/<int:pk>/', views.ClasseRetrieveUpdateDeleteView.as_view(), name='classe_detail'),

    # Teaching Assignments
    path('assignments/', views.TeachingAssignmentListCreateView.as_view(), name='assignments_list_create'),
    path('assignments/<int:pk>/', views.TeachingAssignmentRetrieveUpdateDeleteView.as_view(), name='assignment_detail'),
]
