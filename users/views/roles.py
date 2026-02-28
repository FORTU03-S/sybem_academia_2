
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users.models import CustomRole
from users.serializers import CustomRoleSerializer

class SchoolRolesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != user.SCHOOL_ADMIN:
            return Response({"detail": "Accès refusé"}, status=403)

        roles = CustomRole.objects.filter(
            school=user.school,
            is_active=True
        ).order_by("name")

        serializer = CustomRoleSerializer(roles, many=True)
        return Response(serializer.data)
