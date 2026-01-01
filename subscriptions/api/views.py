# subscriptions/api/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from subscriptions.models import (
    SystemModule, SubscriptionPlan, SchoolSubscription,
    Payment, Invoice
)
from subscriptions.serializers import (
    SystemModuleSerializer, SubscriptionPlanSerializer,
    SchoolSubscriptionSerializer, PaymentSerializer,
    InvoiceSerializer, SubscriptionStatsSerializer
)
from users.permissions_backend import IsSuperAdmin
from schools.models import School

class SystemModuleViewSet(viewsets.ModelViewSet):
    """Gestion des modules système"""
    queryset = SystemModule.objects.filter(is_active=True)
    serializer_class = SystemModuleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['module_type', 'is_active']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['order', 'name', 'created_at']

class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    """Gestion des plans d'abonnement"""
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'is_public', 'duration_unit']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['price_per_unit', 'created_at', 'name']
    
    @action(detail=False, methods=['get'])
    def public(self, request):
        """Liste des plans publics (pour les écoles)"""
        plans = SubscriptionPlan.objects.filter(
            is_active=True,
            is_public=True
        ).order_by('price_per_unit')
        serializer = self.get_serializer(plans, many=True)
        return Response(serializer.data)

class SchoolSubscriptionViewSet(viewsets.ModelViewSet):
    """Gestion des abonnements des écoles"""
    queryset = SchoolSubscription.objects.select_related(
        'school', 'plan'
    ).prefetch_related('activated_modules')
    serializer_class = SchoolSubscriptionSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'is_active', 'plan']
    search_fields = [
        'school__name', 'school__code',
        'plan__name', 'reference'
    ]
    ordering_fields = ['start_date', 'end_date', 'created_at']
    
    def perform_create(self, serializer):
        """Créer un abonnement et activer les modules par défaut"""
        subscription = serializer.save()
        
        # Activer les modules inclus dans le plan
        plan_modules = subscription.plan.included_modules.all()
        for module in plan_modules:
            subscription.activated_modules.add(module)
        
        return subscription
    
    @action(detail=True, methods=['post'])
    def activate_module(self, request, pk=None):
        """Activer un module pour une école"""
        subscription = self.get_object()
        module_id = request.data.get('module_id')
        
        if not module_id:
            return Response(
                {'error': 'module_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            module = SystemModule.objects.get(id=module_id, is_active=True)
        except SystemModule.DoesNotExist:
            return Response(
                {'error': 'Module non trouvé ou inactif'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Vérifier si le module est inclus dans le plan
        if not subscription.plan.included_modules.filter(id=module.id).exists():
            return Response(
                {'error': 'Module non inclus dans le plan actuel'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Activer le module
        subscription.activated_modules.add(module)
        
        return Response({
            'message': f'Module {module.name} activé avec succès',
            'module': SystemModuleSerializer(module).data
        })
    
    @action(detail=True, methods=['post'])
    def deactivate_module(self, request, pk=None):
        """Désactiver un module pour une école"""
        subscription = self.get_object()
        module_id = request.data.get('module_id')
        
        if not module_id:
            return Response(
                {'error': 'module_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Désactiver le module
        subscription.activated_modules.remove(module_id)
        
        return Response({
            'message': 'Module désactivé avec succès'
        })
    
    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        """Renouveler un abonnement"""
        subscription = self.get_object()
        
        # Calculer les nouvelles dates
        new_start_date = subscription.end_date + timedelta(days=1)
        
        if subscription.plan.duration_unit == 'MONTH':
            new_end_date = new_start_date + timedelta(
                days=30 * subscription.plan.duration_value
            )
        elif subscription.plan.duration_unit == 'YEAR':
            new_end_date = new_start_date + timedelta(
                days=365 * subscription.plan.duration_value
            )
        else:  # QUARTER
            new_end_date = new_start_date + timedelta(
                days=90 * subscription.plan.duration_value
            )
        
        # Mettre à jour l'abonnement
        subscription.start_date = new_start_date
        subscription.end_date = new_end_date
        subscription.status = 'ACTIVE'
        subscription.is_active = True
        subscription.is_notified_expiry = False
        subscription.save()
        
        return Response({
            'message': 'Abonnement renouvelé avec succès',
            'new_start_date': new_start_date,
            'new_end_date': new_end_date
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiques des abonnements"""
        total = self.queryset.count()
        active = self.queryset.filter(
            status='ACTIVE',
            is_active=True,
            end_date__gte=timezone.now().date()
        ).count()
        expired = self.queryset.filter(
            Q(status='EXPIRED') | 
            Q(end_date__lt=timezone.now().date())
        ).count()
        pending = self.queryset.filter(status='PENDING').count()
        
        # Revenus
        payments = Payment.objects.filter(status='COMPLETED')
        total_revenue = payments.aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Revenu mensuel
        one_month_ago = timezone.now() - timedelta(days=30)
        monthly_payments = payments.filter(
            payment_date__gte=one_month_ago
        )
        monthly_revenue = monthly_payments.aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Par plan
        by_plan = self.queryset.values('plan__name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Par statut
        by_status = self.queryset.values('status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        stats = {
            'total_subscriptions': total,
            'active_subscriptions': active,
            'expired_subscriptions': expired,
            'pending_subscriptions': pending,
            'total_revenue': total_revenue,
            'monthly_revenue': monthly_revenue,
            'by_plan': {item['plan__name']: item['count'] for item in by_plan},
            'by_status': {item['status']: item['count'] for item in by_status}
        }
        
        serializer = SubscriptionStatsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Abonnements expirant bientôt (30 jours)"""
        thirty_days_later = timezone.now().date() + timedelta(days=30)
        
        subscriptions = self.queryset.filter(
            status='ACTIVE',
            end_date__lte=thirty_days_later,
            end_date__gte=timezone.now().date(),
            is_notified_expiry=False
        ).order_by('end_date')
        
        serializer = self.get_serializer(subscriptions, many=True)
        return Response(serializer.data)

class PaymentViewSet(viewsets.ModelViewSet):
    """Gestion des paiements"""
    queryset = Payment.objects.select_related('school_subscription__school')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'payment_method', 'school_subscription']
    search_fields = [
        'transaction_id', 
        'school_subscription__school__name',
        'school_subscription__reference'
    ]
    ordering_fields = ['payment_date', 'amount', 'created_at']
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirmer un paiement"""
        payment = self.get_object()
        
        if payment.status == 'COMPLETED':
            return Response(
                {'error': 'Paiement déjà confirmé'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment.status = 'COMPLETED'
        payment.confirmed_date = timezone.now()
        payment.save()
        
        # Activer l'abonnement si c'était en attente
        subscription = payment.school_subscription
        if subscription.status == 'PENDING':
            subscription.status = 'ACTIVE'
            subscription.is_active = True
            subscription.save()
        
        return Response({
            'message': 'Paiement confirmé avec succès',
            'payment': PaymentSerializer(payment).data
        })

class InvoiceViewSet(viewsets.ModelViewSet):
    """Gestion des factures"""
    queryset = Invoice.objects.select_related('school_subscription__school')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'school_subscription']
    search_fields = ['invoice_number', 'school_subscription__school__name']
    ordering_fields = ['issue_date', 'due_date', 'total_amount']
    
    def perform_create(self, serializer):
        """Générer automatiquement le numéro de facture"""
        import random
        import string
        
        # Générer un numéro de facture unique
        year = timezone.now().year
        month = timezone.now().month
        
        while True:
            random_part = ''.join(random.choices(string.digits, k=6))
            invoice_number = f"INV-{year}-{month:02d}-{random_part}"
            
            if not Invoice.objects.filter(invoice_number=invoice_number).exists():
                break
        
        serializer.save(invoice_number=invoice_number)

class SchoolModuleAccessAPIView(viewsets.GenericViewSet):
    """API pour vérifier les accès aux modules pour une école"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='check-access')
    def check_access(self, request):
        """Vérifier l'accès aux modules pour l'école de l'utilisateur"""
        user = request.user
        
        if not hasattr(user, 'school'):
            return Response(
                {'error': 'Utilisateur non lié à une école'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        school = user.school
        
        if not hasattr(school, 'subscription'):
            return Response(
                {'error': 'École sans abonnement actif'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        subscription = school.subscription
        
        # Récupérer les modules activés
        modules = subscription.activated_modules.filter(is_active=True)
        
        return Response({
            'school': school.name,
            'subscription_status': subscription.status,
            'subscription_active': subscription.is_active,
            'plan': subscription.plan.name,
            'available_modules': SystemModuleSerializer(modules, many=True).data,
            'can_add_user': subscription.can_add_user(),
            'can_add_student': subscription.can_add_student(),
            'limits': {
                'max_users': subscription.plan.max_users,
                'current_users': subscription.current_users,
                'max_students': subscription.plan.max_students,
                'current_students': subscription.current_students,
                'max_storage_gb': subscription.plan.max_storage_gb,
                'storage_used_gb': subscription.storage_used_gb
            }
        })
        
class SubscriptionStatsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Statistiques globales
        total_subscriptions = SchoolSubscription.objects.count()
        active_subscriptions = SchoolSubscription.objects.filter(is_active=True).count()
        expired_subscriptions = SchoolSubscription.objects.filter(status='EXPIRED').count()
        
        # Revenus
        total_revenue = Payment.objects.filter(status='COMPLETED').aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        # Plans les plus populaires
        popular_plans = SubscriptionPlan.objects.annotate(
            subscription_count=Count('school_subscriptions')
        ).order_by('-subscription_count')[:5]
        
        data = {
            'total_subscriptions': total_subscriptions,
            'active_subscriptions': active_subscriptions,
            'expired_subscriptions': expired_subscriptions,
            'total_revenue': total_revenue,
            'popular_plans': [
                {
                    'name': plan.name,
                    'subscription_count': plan.subscription_count
                }
                for plan in popular_plans
            ]
        }
        
        return Response(data, status=status.HTTP_200_OK)