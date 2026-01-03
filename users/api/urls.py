from django.urls import path
from .views import LoginAPIView, PasswordResetRequestAPIView
from .views import InviteUserAPIView
from .views import SchoolUsersAPIView
from users.api.views import SchoolUserDetailView, AcceptInvitationView

urlpatterns = [
    # Auth
    path("login/", LoginAPIView.as_view(), name="login"),
    path("password-reset/", PasswordResetRequestAPIView.as_view(), name="password-reset"),

    # Invitations et création d'utilisateur
    path('schools/<int:id>/invite-user/', InviteUserAPIView.as_view(), name='invite-user'),
    path('invitations/accept/', AcceptInvitationView.as_view(), name='accept-invitation'),

    # Création utilisateur depuis le frontend de l’école (option simple)
    #path('school/users/', school_create_user, name='school-create-user'),
   # path('school/users/', school_create_user, name='school-users'),
   path("school/users/", SchoolUsersAPIView.as_view(), name="school-users"),
   path(
        "school/users/<int:pk>/",
        SchoolUserDetailView.as_view(),
        name="school-user-detail"
    ),
    path(
        "school/users/<int:pk>/disable/",
        SchoolUserDetailView.as_view(),
        name="school-user-disable"
    ),
]
