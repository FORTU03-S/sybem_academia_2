# users/urls.py
from django.urls import path
from users.api.views import LoginAPIView
#from users.api.views import me
#from users.views import SchoolUsersListView
#from users.views import SchoolUsersView
from users.views import SchoolUsersListView

urlpatterns = [
    path("login/", LoginAPIView.as_view(), name="login"),
    #path('auth/me/', me, name='me'),
    path("school/users/", SchoolUsersListView.as_view(), name="school-users-list"),
    #path("school/users/", SchoolUsersView.as_view()),
]
