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
    
import logging

class SchoolDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        print(f"--- DEBUG DASHBOARD ---")
        print(f"Utilisateur connecté : {user.email} (ID: {user.id})")
        print(f"Type utilisateur : {user.user_type}")

        # 1. Vérification École
        try:
            # Note: Si OneToOneField, l'accès inverse peut lever une exception si vide
            school = user.school
            print(f"École trouvée : {school.name} (ID: {school.id})")
        except Exception as e:
            print(f"ERREUR : Pas d'école liée à cet utilisateur ! Erreur: {e}")
            raise PermissionDenied("Aucune école associée à cet utilisateur. Vérifiez l'admin Django.")

        # 2. Vérification Abonnement
        try:
            subscription = school.subscription
            print(f"Abonnement trouvé : {subscription.plan.name} (Status: {subscription.status})")
        except Exception as e:
            print(f"ERREUR : L'école {school.name} n'a pas d'abonnement ! Erreur: {e}")
            raise PermissionDenied(f"Aucun abonnement actif pour l'école {school.name}. Créez un abonnement dans l'admin.")
 
        plan = subscription.plan 

        # 🔓 Modules autorisés par le plan
        allowed_modules_codes = list(plan.included_modules.values_list("code", flat=True))
        allowed_modules_qs = plan.included_modules.all()

        available_modules = []
        for m in allowed_modules_qs:
            # On vérifie comment récupérer les codenames des permissions
            # Si ton modèle SystemModule a un ManyToMany vers Permission :
            try:
                # On essaie de récupérer les permissions. Si le champ s'appelle autrement,
                # on utilise une liste vide pour ne pas faire planter tout le dashboard.
                perms = list(m.permissions.values_list("codename", flat=True))
            except AttributeError:
                # Si 'permissions' n'existe pas, on essaie 'module_permissions' 
                # ou on laisse vide pour l'instant
                perms = []

            available_modules.append({
                "code": m.code,
                "name": m.name,
                "permissions": perms
            })

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