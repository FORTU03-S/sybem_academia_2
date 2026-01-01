# users/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.serializers import UserListSerializer
from users.models import User
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from users.serializers import UserListSerializer
from users.models import User
from users.serializers import UserSerializer
from users.models import CustomRole
from users.serializers import SchoolUserCreateSerializer



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        "id": user.id,
        "full_name": user.get_full_name(),
        "email": user.email,
        "user_type": user.user_type  # ou custom_role selon ton modèle
    })
    

class SchoolUsersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Accès refusé"}, status=403)

        users = User.objects.filter(
            school=user.school
        ).order_by("-date_joined")

        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Accès refusé"}, status=403)

        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        mode = data["mode"]

        # 🔹 Récupération des rôles personnalisés
        roles = CustomRole.objects.filter(
            id__in=data["roles"],
            school=user.school
        )

        if mode == "create":
            new_user = User.objects.create(
                email=data["email"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                username=data.get("post_name", ""),
                school=user.school,
                status="active",
            )

            new_user.set_unusable_password()
            new_user.save()

            new_user.custom_roles.set(roles)

        elif mode == "invite":
            new_user = User.objects.create(
                email=data["email"],
                school=user.school,
                status="pending",
            )
            new_user.custom_roles.set(roles)

            # 👉 ici plus tard : envoi email invitation

        else:
            return Response(
                {"detail": "Mode invalide"},
                status=400
            )

        return Response(
            UserListSerializer(new_user).data,
            status=status.HTTP_201_CREATED
        )

     
