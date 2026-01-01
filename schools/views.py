# schools/views.py
from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied
from .models import School
from .serializers import SchoolSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class SchoolViewSet(viewsets.ModelViewSet):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # 🔐 SuperAdmin : voit tout
        if user.is_superadmin():
            return School.objects.all().order_by("name")

        # 🔒 Autres : uniquement écoles actives
        return School.objects.filter(status=School.Status.ACTIVE).order_by("name")
    
class SchoolDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not hasattr(user, "school"):
            raise PermissionDenied("Aucune école associée à cet utilisateur")

        school = user.school

        # 🔐 Abonnement
        try:
            subscription = school.subscription
        except Exception:
            raise PermissionDenied("Aucun abonnement actif pour cette école")
 
        plan = subscription.plan  # 🔥 LE VRAI PLAN

        # 🔓 Modules autorisés par le plan
        allowed_modules_qs = plan.included_modules.all()

        allowed_modules_codes = list(
            allowed_modules_qs.values_list("code", flat=True)
        )

        available_modules = [
            {
                "code": m.code,
                "name": m.name,
                "permissions": list(m.permissions.values_list("codename", flat=True))
            }
            for m in allowed_modules_qs
        ]

        return Response({
            "user": {
                "id": user.id,
                "full_name": user.get_full_name(),
                "user_type": user.user_type,
                "custom_role": getattr(user, "custom_role", None),
            },
            "school": {
                "id": school.id,
                "name": school.name,
            },
            "subscription": {
                "plan": plan.name,
                "code": plan.code,
                "allowed_modules": allowed_modules_codes,
            },
            "stats": {
                "users": {"total": 0, "active_today": 0},
                "academic": {"teachers": 0, "classes": 0},
                "finance": {"total_payments": 0, "total_expenses": 0},
            },
            "available_modules": available_modules,
            "recent_activities": [],
            "quick_actions": [],
            "available_roles": [],
        })