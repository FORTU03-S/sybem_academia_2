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

from datetime import date
from django.utils.dateparse import parse_date
from django.db.models import Sum
from rest_framework.exceptions import PermissionDenied
from users.models import User
from finance.models import Transaction
from academia.models import Classe
# Assure-toi que ces imports sont bien présents en haut de ton fichier
# from users.models import User
# from academia.models import Classe
# from finance.models import Transaction

class SchoolDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        print(f"--- DEBUG DASHBOARD ---")
        print(f"Utilisateur connecté : {user.email} (ID: {user.id})")
        print(f"Type utilisateur : {user.user_type}")

        # --- 1. GESTION DU FILTRE DATE ---
        date_str = request.query_params.get('date')
        filter_date = parse_date(date_str) if date_str else date.today()
        if not filter_date:
            filter_date = date.today()

        # --- 2. VÉRIFICATION ÉCOLE (LOGIQUE EXISTANTE) ---
        try:
            school = user.school
            print(f"École trouvée : {school.name} (ID: {school.id})")
        except Exception as e:
            print(f"ERREUR : Pas d'école liée à cet utilisateur ! Erreur: {e}")
            raise PermissionDenied("Aucune école associée à cet utilisateur.")

        # --- 3. VÉRIFICATION ABONNEMENT (LOGIQUE EXISTANTE) ---
        try:
            subscription = school.subscription
            print(f"Abonnement trouvé : {subscription.plan.name}")
        except Exception as e:
            print(f"ERREUR : L'école n'a pas d'abonnement ! Erreur: {e}")
            raise PermissionDenied(f"Aucun abonnement actif pour l'école {school.name}.")

        plan = subscription.plan 

        # --- 4. MODULES AUTORISÉS (LOGIQUE EXISTANTE) ---
        allowed_modules_codes = list(plan.included_modules.values_list("code", flat=True))
        allowed_modules_qs = plan.included_modules.all()

        available_modules = []
        for m in allowed_modules_qs:
            try:
                perms = list(m.permissions.values_list("codename", flat=True))
            except AttributeError:
                perms = []
            available_modules.append({
                "code": m.code,
                "name": m.name,
                "permissions": perms
            })

        # --- 5. CALCUL DES STATISTIQUES RÉELLES ---
        
        # Utilisateurs & Académique
        total_users = User.objects.filter(school=school).count()
        active_today = User.objects.filter(school=school, last_login__date=date.today()).count()
        teacher_count = User.objects.filter(school=school, user_type='TEACHER').count()
        class_count = Classe.objects.filter(school=school).count()

        # Finances (Filtrées par la date sélectionnée)
        # On ne prend que les transactions "APPROVED" pour le solde
        daily_tx = Transaction.objects.filter(
            school=school, 
            created_at__date=filter_date,
            status='APPROVED'
        )

        total_income = daily_tx.filter(transaction_type='INCOME').aggregate(total=Sum('amount_in_base_currency'))['total'] or 0
        total_expense = daily_tx.filter(transaction_type='EXPENSE').aggregate(total=Sum('amount_in_base_currency'))['total'] or 0

        # --- 6. RÉCUPÉRATION DES ACTIVITÉS RÉCENTES (10 dernières transactions) ---
        recent_transactions = Transaction.objects.filter(school=school).order_by('-created_at')[:10]
        activities = []

        for tx in recent_transactions:
            # Création d'un libellé dynamique
            if tx.transaction_type == 'INCOME':
                label = f"Paiement reçu : {tx.student.get_full_name() if tx.student else 'Inconnu'}"
                icon = "trending-up"
                color = "success"
            else:
                label = f"Dépense : {tx.description[:30] or 'Sans description'}"
                icon = "trending-down"
                color = "danger"

            activities.append({
                "id": tx.id,
                "type": tx.transaction_type,
                "label": label,
                "amount": f"{tx.amount} {tx.currency}",
                "date": tx.created_at.strftime("%H:%M"),
                "status": tx.status,
                "icon": icon,
                "color": color
            })

        # --- 7. RÉPONSE FINALE ---
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
                "users": {
                    "total": total_users, 
                    "active_today": active_today
                },
                "academic": {
                    "teachers": teacher_count, 
                    "classes": class_count
                },
                "finance": {
                    "daily_income": float(total_income), 
                    "daily_expense": float(total_expense),
                    "net_balance": float(total_income - total_expense)
                },
            },
            "selected_date": filter_date.strftime("%Y-%m-%d"),
            "available_modules": available_modules,
            "recent_activities": activities, # Liste remplie ici
            "quick_actions": [],
            "available_roles": [],
        })