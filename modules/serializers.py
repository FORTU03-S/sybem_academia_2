

from rest_framework import serializers
from .models import Module
from .models import SchoolModule

class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['id', 'code', 'name', 'description']
        read_only_fields = ['id']
        
class SchoolModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolModule
        fields = ['id', 'school', 'module', 'is_active']
        read_only_fields = ['id']