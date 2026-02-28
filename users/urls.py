from django.urls import path
from users.api.views import ForceChangePasswordAPIView, LoginAPIView
from users.views import (
    SchoolRolesListView,
    
)

from . import views

urlpatterns = [

    path("login/", LoginAPIView.as_view(), name="login"),


    path(
        "school/users/<int:user_id>/approve/",
        views.approve_user,
        name="approve-user"
    ),
    
    

    path(
        "school/users/<int:user_id>/disable/",
        views.disable_user,
        name="disable-user"
    ),

    path(
        "school/users/<int:user_id>/",
        views.delete_user,
        name="delete-user"
    ),

    
    path(
        "school/roles/",
        SchoolRolesListView.as_view(),
        name="school-roles"
    ),
]
