
from rest_framework import serializers
from users.models import (
    PermissionCategory, 
    CustomPermission, 
    CustomRole,
    RolePermission
)

class PermissionCategorySerializer(serializers.ModelSerializer):
    permissions_count = serializers.IntegerField(source='permissions.count', read_only=True)
    
    class Meta:
        model = PermissionCategory
        fields = ['id', 'name', 'code', 'description', 'icon', 'order', 'permissions_count']

class CustomPermissionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source='category.code', read_only=True)
    
    class Meta:
        model = CustomPermission
        fields = [
            'id', 'name', 'code', 'description', 'category', 
            'category_name', 'category_code', 'requires_approval',
            'is_dangerous', 'django_permission'
        ]

class CustomRoleSerializer(serializers.ModelSerializer):
    permissions_count = serializers.IntegerField(source='role_permissions.count', read_only=True)
    users_count = serializers.IntegerField(source='users.count', read_only=True)
    
    class Meta:
        model = CustomRole
        fields = [
            'id', 'name', 'description', 'school', 'is_active',
            'permissions_count', 'users_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

class RolePermissionSerializer(serializers.ModelSerializer):
    permission_name = serializers.CharField(source='permission.name', read_only=True)
    permission_code = serializers.CharField(source='permission.code', read_only=True)
    category_name = serializers.CharField(source='permission.category.name', read_only=True)
    
    class Meta:
        model = RolePermission
        fields = [
            'id', 'role', 'permission', 'permission_name', 'permission_code',
            'category_name', 'access_level', 'scope', 'is_active'
        ]

class AssignRoleSerializer(serializers.Serializer):
    """Pour attribuer un rôle à un utilisateur"""
    user_id = serializers.IntegerField()
    role_id = serializers.IntegerField()
    effective_date = serializers.DateField(required=False)
    expiration_date = serializers.DateField(required=False)
    
    def validate(self, data):
        user_id = data['user_id']
        role_id = data['role_id']
        
        return data