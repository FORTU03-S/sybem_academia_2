from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.models import User
from sybem.users.permissions_backend import IsDirectionOrSchoolAdmin

class DirectionUsersListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDirectionOrSchoolAdmin]

    def get(self, request):
        school = request.user.school

        users = User.objects.filter(
            school=school
        ).exclude(
            user_type=User.PARENT
        )

        data = [
            {
                "id": u.id,
                "email": u.email,
                "name": f"{u.first_name} {u.last_name}",
                "user_type": u.user_type,
                "custom_role": u.custom_role.name if u.custom_role else None,
                "is_active": u.is_active,
            }
            for u in users
        ]

        return Response(data)


class ToggleUserStatusAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDirectionOrSchoolAdmin]

    def post(self, request, user_id):
        school = request.user.school

        user = User.objects.filter(
            id=user_id,
            school=school
        ).first()

        if not user:
            return Response({"error": "Utilisateur introuvable"}, status=404)

        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])

        return Response({
            "message": "Statut mis à jour",
            "is_active": user.is_active
        })

from users.models import CustomRole

class AssignCustomRoleAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDirectionOrSchoolAdmin]

    def post(self, request, user_id):
        role_id = request.data.get("role_id")
        school = request.user.school

        user = User.objects.filter(id=user_id, school=school).first()
        role = CustomRole.objects.filter(id=role_id, school=school).first()

        if not user or not role:
            return Response({"error": "Utilisateur ou rôle invalide"}, status=400)

        user.custom_role = role
        user.save(update_fields=['custom_role'])

        return Response({"message": "Rôle attribué avec succès"})
