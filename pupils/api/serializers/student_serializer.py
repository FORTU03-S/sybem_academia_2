from rest_framework import serializers
from pupils.models import Student
from academia.serializers import ClasseSerializer
from academia.models import Classe


class StudentSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=['%Y-%m-%d', 'iso-8601'])
    
    # Correction ici : Utilise DateTimeField pour accepter l'objet timezone.now
    # Mais on garde le format %Y-%m-%d pour l'affichage dans ton HTML
    
    dropped_at = serializers.DateTimeField(format="%Y-%m-%d", required=False, allow_null=True)
    enrollment_date = serializers.DateField(
        required=False, 
        allow_null=True,
        format="%Y-%m-%d"
    )
    
    current_classe = ClasseSerializer(read_only=True)
    
    profile_picture = serializers.ImageField(required=False, allow_null=True, use_url=True)
    
    # Si vous voulez pouvoir MODIFIER la classe via ce serializer, 
    # vous pouvez aussi ajouter un champ pour l'ID
    current_classe_id = serializers.PrimaryKeyRelatedField(
        queryset=Classe.objects.all(), 
        source='current_classe', 
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ('school', 'academic_period')
