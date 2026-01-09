from rest_framework import serializers
from pupils.models import Student

class StudentSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=['%Y-%m-%d', 'iso-8601'])
    
    # Correction ici : Utilise DateTimeField pour accepter l'objet timezone.now
    # Mais on garde le format %Y-%m-%d pour l'affichage dans ton HTML
    dropped_at = serializers.DateTimeField(format="%Y-%m-%d", required=False, allow_null=True)
    enrollment_date = serializers.DateTimeField(format="%Y-%m-%d", read_only=True)

    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ('school', 'academic_period')
