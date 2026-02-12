from rest_framework import serializers
from pupils.models import Student, Enrollment
from academia.serializers import ClasseSerializer
from academia.models import Classe
from .parent_serializer import ParentSerializer 
from django.db import transaction

# ❌ SUPPRIME CES DEUX LIGNES (Elles sont inutiles et causent des bugs)
# from tabnanny import check 
# from urllib import request

class StudentSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=['%Y-%m-%d', 'iso-8601'])
    dropped_at = serializers.DateTimeField(format="%Y-%m-%d", required=False, allow_null=True)
    enrollment_date = serializers.DateField(required=False, allow_null=True, format="%Y-%m-%d")
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
            'current_classe', 'current_classe_id',
            'parents', 'status', 'enrollment_date', 'profile_picture', 'dropped_at'
        ]
        read_only_fields = ('school', 'academic_period')

    def validate(self, data):
        """Vérifie les doublons avant que la base de données ne bloque"""
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'school'):
            return data
            
        school = request.user.school

        # Nettoyage des données pour la comparaison
        f_name = data.get('first_name', '').strip()
        l_name = data.get('last_name', '').strip()
        m_name = data.get('middle_name', '').strip()
        dob = data.get('date_of_birth')

        # Recherche d'un élève identique dans la même école
        # On utilise __iexact pour ignorer les majuscules/minuscules
        duplicate_queryset = Student.objects.filter(
            school=school,
            first_name__iexact=f_name,
            last_name__iexact=l_name,
            middle_name__iexact=m_name,
            date_of_birth=dob
        )

        # Si on est en train de modifier (update), on ne compte pas l'élève lui-même comme doublon
        if self.instance:
            duplicate_queryset = duplicate_queryset.exclude(pk=self.instance.pk)

        if duplicate_queryset.exists():
            raise serializers.ValidationError({
                "error": "Un élève avec le même nom et date de naissance existe déjà dans votre établissement."
            })

        return data
    
    @transaction.atomic
    def create(self, validated_data):
        """Création de l'élève + inscription automatique"""
        classe = validated_data.get('current_classe')
        student = super().create(validated_data)

        if classe:
            Enrollment.objects.create(
                student=student,
                classe=classe,
                academic_period=classe.academic_period,
                status="active"
            )
        return student

    @transaction.atomic
    def update(self, instance, validated_data):
        """Mise à jour + gestion du changement de classe"""
        new_classe = validated_data.get('current_classe')
        old_classe = instance.current_classe
        
        student = super().update(instance, validated_data)

        if new_classe and new_classe != old_classe:
            Enrollment.objects.update_or_create(
                student=student,
                academic_period=new_classe.academic_period,
                defaults={
                    'classe': new_classe,
                    'status': 'active'
                }
            )
        return student