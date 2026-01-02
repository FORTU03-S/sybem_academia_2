# users/urls.py
from django.urls import path
from users.api.views import LoginAPIView
#from users.api.views import me
#from users.views import SchoolUsersListView
#from users.views import SchoolUsersView
from users.views import SchoolUsersListView
from . import views

urlpatterns = [
    path("login/", LoginAPIView.as_view(), name="login"),
    #path('auth/me/', me, name='me'),
    path("school/users/", SchoolUsersListView.as_view(), name="school-users-list"),
    #path("school/users/", SchoolUsersView.as_view()),
    path('users/<int:user_id>/approve/', views.approve_user, name='approve_user'),
    path('users/<int:user_id>/disable/', views.disable_user, name='disable_user'),
    path('users/<int:user_id>/', views.delete_user, name='delete_user'),
]
