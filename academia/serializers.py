# academia/serializers.py

from rest_framework import serializers
from .models import Course, Classe, TeachingAssignment
from django.conf import settings
from users.models import User
from django.contrib.auth import get_user_model

from .models import Evaluation, Grade, GradingPeriod
from pupils.models import Enrollment


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
        
# C:\Users\user\sybem_academia2\sybem\academia\serializers.py

class TeachingAssignmentSerializer(serializers.ModelSerializer):
    # --- Champs lecture seule pour l'affichage ---
    education_level = serializers.CharField(source='classe.education_level', read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    school_name = serializers.CharField(source='classe.school.name', read_only=True)
    course_weight_default = serializers.IntegerField(source='course.weight', read_only=True, default=0)

    # ✅ CORRECTION DU BUG 500 : On définit explicitement où trouver la période
    academic_period = serializers.PrimaryKeyRelatedField(source='classe.academic_period', read_only=True)

    # --- Champs d'écriture (IDs) ---
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
            'id', 
            'classe', 'classe_name', 
            'course', 'course_name', 'course_weight_default',
            'academic_period', # Maintenant valide grâce à la ligne ci-dessus
            'teacher', 'teacher_name',
            'school_name',
            'weight', 'is_evaluative',
            "education_level",
        ]

    def validate(self, data):
        classe = data.get('classe')
        course = data.get('course')
        if classe and course: 
            if classe.school != course.school:
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



class EvaluationSerializer(serializers.ModelSerializer):
    """Pour créer/modifier une épreuve (Interro, Examen) via API"""
    class Meta:
        model = Evaluation
        fields = ['id', 'teaching_assignment', 'grading_period', 'name', 'description', 
                  'evaluation_type', 'date', 'max_score', 'weight', 'is_published']

class GradeSerializer(serializers.ModelSerializer):
    """Pour sauvegarder une note individuelle"""
    student_name = serializers.CharField(source='enrollment.student.get_full_name', read_only=True)
    
    class Meta:
        model = Grade
        fields = ['id', 'enrollment', 'evaluation', 'score', 'observation', 'student_name']
        read_only_fields = ['graded_by']

    def validate(self, data):
        """Validation métier : la note ne doit pas dépasser le max"""
        score = data.get('score')
        evaluation = data.get('evaluation')

        # Cas de l'update : on récupère l'éval depuis l'instance existante
        if not evaluation and self.instance:
            evaluation = self.instance.evaluation
            
        if score is not None and evaluation:
            if score < 0:
                raise serializers.ValidationError("La note ne peut pas être négative.")
            if score > evaluation.max_score:
                raise serializers.ValidationError(
                    f"La note ({score}) dépasse le maximum autorisé ({evaluation.max_score}) pour cette épreuve."
                )
        return data

class StudentGradebookSerializer(serializers.ModelSerializer):
    """Format simplifié de l'élève pour le tableau de notes"""
    full_name = serializers.CharField(source='student.get_full_name')
    student_id = serializers.IntegerField(source='student.id')
    
    class Meta:
        model = Enrollment
        fields = ['id', 'student_id', 'full_name'] # id ici est l'enrollment_id

class GradebookDataSerializer(serializers.Serializer):
    """
    Serializer NON-MODEL.
    Sert juste à structurer la réponse JSON complexe du Gradebook.
    """
    assignment_info = TeachingAssignmentSerializer(read_only=True)
    students = StudentGradebookSerializer(many=True, read_only=True)
    evaluations = EvaluationSerializer(many=True, read_only=True)
    grades = GradeSerializer(many=True, read_only=True)
    
# academia/serializers.py

class TeacherDashboardStatsSerializer(serializers.Serializer):
    total_classes = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_evaluations = serializers.IntegerField()
    planned_evaluations = serializers.IntegerField()
    completed_evaluations = serializers.IntegerField()
    students_without_grades = serializers.IntegerField()
    success_rate = serializers.FloatField()



class TeacherClassStatsSerializer(serializers.ModelSerializer):
    courses = serializers.SerializerMethodField()
    success_rate = serializers.FloatField()
    students_without_grades = serializers.IntegerField()

    class Meta:
        model = Classe
        fields = [
            "id",
            "name",
            "success_rate",
            "students_without_grades",
            "courses",
        ]

    def get_courses(self, obj):
        user = self.context["request"].user

        assignments = TeachingAssignment.objects.filter(
            classe=obj,
            teacher=user
        ).select_related("course")

        return [
            {
                "assignment_id": a.id,
                "course_name": a.course.name,
                "weight": a.weight,
            }
            for a in assignments
        ]



class GradingPeriodSerializer(serializers.ModelSerializer):
    academic_period_name = serializers.CharField(source='academic_period.name', read_only=True)
    
    class Meta:
        model = GradingPeriod
        fields = ['id', 'academic_period', 'academic_period_name', 'name', 
                 'sequence_order', 'start_date', 'end_date', 'is_exam', 'is_closed']