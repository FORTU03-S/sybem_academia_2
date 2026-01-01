# admin_platform/api/views/school_dashboard.py - VERSION AMÉLIORÉE
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from django.db import models

from users.models import User, CustomRole
from sybem.users.permissions_backend import (
    SchoolAdminPermission, 
    check_permission,
    get_user_permissions
)
from schools.models import School
from timeline.models import Timeline
from modules.models import Expense, Payment

class SchoolAdminDashboardAPIView(APIView):
    """
    Dashboard personnalisé selon les permissions de l'admin
    """
    permission_classes = [IsAuthenticated, SchoolAdminPermission]
    
    def get(self, request):
        user = request.user
        school = user.school
        
        if not school:
            return Response(
                {"error": "Utilisateur non associé à une école"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Récupérer les permissions de l'utilisateur
        user_permissions = get_user_permissions(user)
        
        # Modules disponibles selon les permissions
        available_modules = []
        
        if check_permission(user, 'academic.view'):
            available_modules.append({
                'name': 'Académique',
                'code': 'academic',
                'icon': 'book-open',
                'permissions': [p for p in user_permissions if p.startswith('academic.')]
            })
        
        if check_permission(user, 'finance.view'):
            available_modules.append({
                'name': 'Finance',
                'code': 'finance',
                'icon': 'dollar-sign',
                'permissions': [p for p in user_permissions if p.startswith('finance.')]
            })
        
        if check_permission(user, 'hr.view'):
            available_modules.append({
                'name': 'Ressources Humaines',
                'code': 'hr',
                'icon': 'users',
                'permissions': [p for p in user_permissions if p.startswith('hr.')]
            })
        
        if check_permission(user, 'reports.view'):
            available_modules.append({
                'name': 'Rapports',
                'code': 'reports',
                'icon': 'bar-chart',
                'permissions': [p for p in user_permissions if p.startswith('reports.')]
            })
        
        # Statistiques selon les permissions
        stats = {}
        
        # Statistiques utilisateurs (si permission)
        if check_permission(user, 'users.view'):
            stats['users'] = {
                'total': User.objects.filter(school=school).count(),
                'by_type': User.objects.filter(school=school).values('user_type').annotate(
                    count=Count('id')
                ),
                'active_today': User.objects.filter(
                    school=school,
                    last_login__date=timezone.now().date()
                ).count(),
            }
        
        # Statistiques académiques (si permission)
        if check_permission(user, 'academic.view'):
            stats['academic'] = {
                'classes': 0,  # À remplir avec tes modèles
                'courses': 0,
                'teachers': User.objects.filter(
                    school=school, 
                    user_type=User.TEACHER
                ).count(),
            }
        
        # Statistiques financières (si permission)
        if check_permission(user, 'finance.view'):
            stats['finance'] = {
                'total_expenses': Expense.objects.filter(school=school).aggregate(
                    total=models.Sum('amount')
                )['total'] or 0,
                'total_payments': Payment.objects.filter(school=school).aggregate(
                    total=models.Sum('amount')
                )['total'] or 0,
                'pending_invoices': 0,  # À remplir
            }
        
        # Activités récentes
        recent_activities = Timeline.objects.filter(
            school=school
        ).select_related('user').order_by('-created_at')[:10]
        
        activities_data = []
        for activity in recent_activities:
            activities_data.append({
                'id': activity.id,
                'action_type': activity.action_type,
                'action_label': activity.action_label,
                'module': activity.module,
                'user': activity.user.email if activity.user else None,
                'created_at': activity.created_at,
                'details': activity.details,
            })
        
        # Rôles disponibles pour attribution
        available_roles = CustomRole.objects.filter(
            school=school,
            is_active=True
        ).values('id', 'name', 'description')
        
        return Response({
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.get_full_name(),
                'user_type': user.user_type,
                'custom_role': user.custom_role.name if user.custom_role else None,
                'permissions': user_permissions,
            },
            'school': {
                'id': school.id,
                'name': school.name,
                'code': school.code,
            },
            'available_modules': available_modules,
            'stats': stats,
            'recent_activities': activities_data,
            'available_roles': available_roles,
            'quick_actions': self.get_quick_actions(user),
        }, status=status.HTTP_200_OK)
    
    def get_quick_actions(self, user):
        """Retourne les actions rapides selon les permissions"""
        actions = []
        
        if check_permission(user, 'users.create'):
            actions.append({
                'name': 'Créer un utilisateur',
                'code': 'create_user',
                'icon': 'user-plus',
                'url': '/admin/users/create/',
                'color': 'blue',
            })
        
        if check_permission(user, 'academic.create_class'):
            actions.append({
                'name': 'Créer une classe',
                'code': 'create_class',
                'icon': 'layers',
                'url': '/admin/classes/create/',
                'color': 'green',
            })
        
        if check_permission(user, 'finance.create_invoice'):
            actions.append({
                'name': 'Créer une facture',
                'code': 'create_invoice',
                'icon': 'file-text',
                'url': '/admin/finance/invoices/create/',
                'color': 'yellow',
            })
        
        if check_permission(user, 'reports.generate'):
            actions.append({
                'name': 'Générer un rapport',
                'code': 'generate_report',
                'icon': 'download',
                'url': '/admin/reports/generate/',
                'color': 'purple',
            })
        
        return actions