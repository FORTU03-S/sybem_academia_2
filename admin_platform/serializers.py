# admin_platform/serializers.py
from rest_framework import serializers
from schools.models import School
from subscriptions.models import SubscriptionPlan, SchoolSubscription
from users.models import User


class SchoolListSerializer(serializers.ModelSerializer):
    admin_name = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            "id",
            "name",
            "status",
            "created_at",
            "admin_name",
            "plan_name",
        ]

    def get_admin_name(self, obj):
        if obj.school_admin:
            return f"{obj.school_admin.first_name} {obj.school_admin.last_name}"
        return "Non assigné"

    def get_plan_name(self, obj):
        try:
            return obj.subscription.plan.name
        except SchoolSubscription.DoesNotExist:
            return "Aucun"

class SchoolDashboardSerializer(serializers.ModelSerializer):
    plan_name = serializers.SerializerMethodField()
    subscription_end = serializers.SerializerMethodField()
    subscription_active = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            "id",
            "name",
            "status",
            "created_at",
            "plan_name",
            "subscription_end",
            "subscription_active",
        ]

    def get_plan_name(self, obj):
        try:
            return obj.subscription.plan.name
        except SchoolSubscription.DoesNotExist:
            return None

    def get_subscription_end(self, obj):
        try:
            return obj.subscription.end_date
        except SchoolSubscription.DoesNotExist:
            return None

    def get_subscription_active(self, obj):
        try:
            return obj.subscription.is_active
        except SchoolSubscription.DoesNotExist:
            return False

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "description",
            "price_per_month",
            "default_max_users",
            "default_max_modules",
            "is_active",
        ]

class SchoolSerializer(serializers.ModelSerializer):
    plan_name = serializers.SerializerMethodField()
    subscription_end = serializers.SerializerMethodField()
    subscription_active = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            "id",
            "name",
            "status",
            "created_at",
            "plan_name",
            "subscription_end",
            "subscription_active",
        ]

    def get_plan_name(self, obj):
        try:
            return obj.subscription.plan.name
        except SchoolSubscription.DoesNotExist:
            return None

    def get_subscription_end(self, obj):
        try:
            return obj.subscription.end_date
        except SchoolSubscription.DoesNotExist:
            return None

    def get_subscription_active(self, obj):
        try:
            return obj.subscription.is_active
        except SchoolSubscription.DoesNotExist:
            return False 