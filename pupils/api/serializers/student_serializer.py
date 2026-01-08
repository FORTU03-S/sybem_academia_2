from rest_framework import serializers
from pupils.models import Student

class StudentSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=['%Y-%m-%d', 'iso-8601'])
    # Si tu as un champ dropped_at, fais la même chose :
    dropped_at = serializers.DateField(format="%Y-%m-%d", input_formats=['%Y-%m-%d', 'iso-8601'], required=False, allow_null=True)
    enrollment_date = serializers.DateField(format="%Y-%m-%d", read_only=True)
    class Meta:
        model = Student
        fields = "__all__"
        
        read_only_fields = ('school', 'academic_period')
