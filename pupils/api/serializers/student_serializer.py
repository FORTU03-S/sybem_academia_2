# C:\Users\user\sybem_academia2\sybem\pupils\api\serializers\student_serializer.py

from rest_framework import serializers
from pupils.models import Student
from academia.serializers import ClasseSerializer
from academia.models import Classe
from .parent_serializer import ParentSerializer 

class StudentSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=['%Y-%m-%d', 'iso-8601'])
    dropped_at = serializers.DateTimeField(format="%Y-%m-%d", required=False, allow_null=True)
    enrollment_date = serializers.DateField(required=False, allow_null=True, format="%Y-%m-%d")
    
    # Variable déclarée ici : "current_classe"
    current_classe = ClasseSerializer(read_only=True)
    
    parents = ParentSerializer(many=True, read_only=True)
    
    profile_picture = serializers.ImageField(required=False, allow_null=True, use_url=True)
    
    current_classe_id = serializers.PrimaryKeyRelatedField(
        queryset=Classe.objects.all(), 
        source='current_classe', 
        write_only=True,
        required=False
    )

    class Meta:
        model = Student
        fields = [
            'id', 'first_name', 'last_name', 'middle_name', 'gender', 
            'date_of_birth', 'student_id_code', 
            'current_classe',  
            'current_classe_id',
            'parents', 'status', 'enrollment_date', 'profile_picture', 'dropped_at'
        ]
        read_only_fields = ('school', 'academic_period')