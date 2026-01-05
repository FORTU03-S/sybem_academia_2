# academia/serializers.py

from rest_framework import serializers
from .models import Course, Classe, TeachingAssignment
from django.conf import settings
from users.models import User
from django.contrib.auth import get_user_model

User = get_user_model()
# --- 1. SERIALIZER POUR COURSE ---
class CourseSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'school', 'school_name', 'name', 'code', 
            'description'
        ]
        read_only_fields = ['school'] # L'école est définie dans la vue

# --- 2. SERIALIZER POUR CLASSE ---
class ClasseSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    academic_period_name = serializers.CharField(source='academic_period.name', read_only=True)
    
    # Affichage du nom du titulaire
    titulaire_name = serializers.CharField(source='titulaire.get_full_name', read_only=True)
    
    # Champ d'entrée pour lier le titulaire (optionnel)
    titulaire_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(user_type=User.TEACHER), 
        source='titulaire', 
        write_only=True,
        required=False,
        allow_null=True
    )
    
    # Champ d'entrée pour lier les cours (liste d'IDs)
    course_ids = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), 
        source='courses', 
        many=True,
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Classe
        fields = [
            'id', 'school', 'school_name', 'academic_period', 'academic_period_name',
            'education_level', 'name', 'description', 'titulaire_id', 'titulaire_name',
            'courses', 'course_ids'
        ]
        # L'école et la période académique sont définies dans la vue
        read_only_fields = ['school', 'academic_period', 'courses']
        
class TeachingAssignmentSerializer(serializers.ModelSerializer):
    # Affichage pour le GET (Read Only)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    
    # Utilisation des noms de champs réels du modèle pour l'écriture
    # Cela évite de créer des alias comme classe_id qui embrouillent DRF
    classe = serializers.PrimaryKeyRelatedField(queryset=Classe.objects.all())
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(user_type=User.TEACHER), 
        required=False, 
        allow_null=True
    )

    class Meta:
        model = TeachingAssignment
        fields = [
            'id', 'classe', 'classe_name', 
            'course', 'course_name',
            'teacher', 'teacher_name',
            'weight', 'is_evaluative'
        ]

    def validate(self, data):
        # Validation de sécurité : l'école du cours doit être celle de la classe
        classe = data.get('classe')
        course = data.get('course')
        if classe and course and classe.school != course.school:
            raise serializers.ValidationError("Le cours et la classe doivent appartenir à la même école.")
        return data
    



class TeacherClassDashboardSerializer(serializers.ModelSerializer):
    """
    Une classe + les cours que CE prof enseigne dedans
    """
    my_courses = serializers.SerializerMethodField()
    academic_period = serializers.CharField(
        source="academic_period.name",
        read_only=True
    )

    class Meta:
        model = Classe
        fields = [
            "id",
            "name",
            "academic_period",
            "my_courses",
        ]

    def get_my_courses(self, obj):
        user = self.context["request"].user

        assignments = TeachingAssignment.objects.filter(
            classe=obj,
            teacher=user
        ).select_related("course")

        return [
            {
                "assignment_id": a.id,
                "course_id": a.course.id,
                "course_name": a.course.name,
                "weight": a.weight,
            }
            for a in assignments
        ]
