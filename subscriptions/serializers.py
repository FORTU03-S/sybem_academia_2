# subscriptions/serializers.py
from rest_framework import serializers
from .models import (
    SystemModule, SubscriptionPlan, PlanModule,
    SchoolSubscription, SchoolModuleAccess, Payment, Invoice
)
from schools.serializers import SchoolSerializer
from users.serializers import CustomUserSerializer
from schools.models import School

class SystemModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemModule
        fields = '__all__'

class PlanModuleSerializer(serializers. ModelSerializer):
    module = SystemModuleSerializer(read_only=True)
    module_id = serializers.PrimaryKeyRelatedField(
        queryset=SystemModule.objects.all(),
        source='module',
        write_only=True
    ) 
    
    class Meta:
        model = PlanModule
        fields = '__all__'

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    included_modules = PlanModuleSerializer(many=True, read_only=True)
    module_ids = serializers.PrimaryKeyRelatedField(
        queryset=SystemModule.objects.all(),
        many=True,
        write_only=True,
        required=False
    )
    full_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    duration_display = serializers.CharField(read_only=True)
    
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        module_ids = validated_data.pop('module_ids', [])
        plan = SubscriptionPlan.objects.create(**validated_data)
        
        # Créer les liens avec les modules
        for order, module in enumerate(module_ids, start=1):
            PlanModule.objects.create(
                plan=plan,
                module=module,
                order=order
            )
        
        return plan
    
    def update(self, instance, validated_data):
        module_ids = validated_data.pop('module_ids', None)
        
        # Mettre à jour les champs de base
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Mettre à jour les modules si fournis
        if module_ids is not None:
            # Supprimer les anciens liens
            instance.included_modules.clear()
            # Créer les nouveaux liens
            for order, module in enumerate(module_ids, start=1):
                PlanModule.objects.create(
                    plan=instance,
                    module=module,
                    order=order
                )
        
        return instance

class SchoolModuleAccessSerializer(serializers.ModelSerializer):
    module = SystemModuleSerializer(read_only=True)
    
    class Meta:
        model = SchoolModuleAccess
        fields = '__all__'

class SchoolSubscriptionSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        source='school',
        write_only=True
    )
    plan = SubscriptionPlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.all(),
        source='plan',
        write_only=True
    )
    activated_modules = SchoolModuleAccessSerializer(many=True, read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = SchoolSubscription
        fields = '__all__'
        read_only_fields = [
            'reference', 'created_at', 'updated_at',
            'current_users', 'current_students', 'storage_used_gb'
        ]
    
    def validate(self, data):
        # Vérifier que l'école n'a pas déjà un abonnement actif
        school = data.get('school')
        if school and hasattr(school, 'subscription'):
            existing = school.subscription
            if existing.is_active and existing.status == 'ACTIVE':
                raise serializers.ValidationError(
                    "Cette école a déjà un abonnement actif."
                )
        
        # Vérifier les dates
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError(
                "La date de fin doit être postérieure à la date de début."
            )
        
        return data

class PaymentSerializer(serializers.ModelSerializer):
    school_subscription = SchoolSubscriptionSerializer(read_only=True)
    
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class InvoiceSerializer(serializers.ModelSerializer):
    school_subscription = SchoolSubscriptionSerializer(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'invoice_number']

class SubscriptionStatsSerializer(serializers.Serializer):
    """Sérialiseur pour les statistiques d'abonnements"""
    total_subscriptions = serializers.IntegerField()
    active_subscriptions = serializers.IntegerField()
    expired_subscriptions = serializers.IntegerField()
    pending_subscriptions = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    monthly_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    by_plan = serializers.DictField()
    by_status = serializers.DictField()