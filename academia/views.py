from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from users.permissions_backend import CanManageSchoolResources 
from .models import Course, Classe, TeachingAssignment
from .serializers import CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer, TeacherClassDashboardSerializer
# je garde mes imports de modèles nécessaires
# academia/views.py
from django.shortcuts import render
from django.db.models import Avg, Count, Q
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import TeachingAssignment, Classe, Evaluation, Grade
from .serializers import TeacherDashboardStatsSerializer
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import redirect
class AcademiaBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [CanManageSchoolResources]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [CanManageSchoolResources()]


class CourseViewSet(AcademiaBaseViewSet):
    serializer_class = CourseSerializer

    def get_queryset(self):
        user = self.request.user

        # Sécurité absolue
        if not user.is_authenticated or not user.school:
            return Course.objects.none()

        # 🔥 FILTRAGE PAR ÉCOLE
        return Course.objects.filter(
            school=user.school
        ).order_by("name")

    def perform_create(self, serializer):
        if not self.request.user.school:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                "detail": "Impossible de créer un cours : vous n'êtes rattaché à aucune école."
            })

        serializer.save(school=self.request.user.school)

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.school != self.request.user.school:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Accès interdit à ce cours.")

        serializer.save()
        
    def perform_destroy(self, instance):
        if instance.school != self.request.user.school:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Suppression interdite.")

        instance.delete()


class ClasseViewSet(viewsets.ModelViewSet):
    serializer_class = ClasseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return Classe.objects.none()

        return Classe.objects.filter(
            school=user.school,
            academic_period__is_current=True
        ).select_related(
            "academic_period",
            "school",
            "titulaire"
        )

    def perform_create(self, serializer):
        user = self.request.user

        if not user.school:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Utilisateur sans école.")

    # 🔒 UNE SEULE SOURCE DE VÉRITÉ
        active_period = user.school.academic_periods.filter(is_current=True).first()

        if not active_period:
            raise ValidationError("Aucune période académique active définie.")

        serializer.save(
            school=user.school,
            academic_period=active_period
        )
    
    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.school != self.request.user.school:
           from rest_framework.exceptions import PermissionDenied
           raise PermissionDenied("Modification interdite.")

        serializer.save()

    # Cette méthode permet de récupérer les données formatées exactement comme mon frontend le veut
    # Si mon sérialiseur ne renvoie pas 'titulaire_name', on peut surcharger list()
    # Mais l'idéal est de mettre ces champs dans le ClasseSerializer (MethodField)
        
class TeacherScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TeachingAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        return TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        )

        


from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from django.db.models import Avg
from django.utils import timezone
from .serializers import TeacherClassStatsSerializer

class TeacherDashboardViewSet(ViewSet):
    
    """Vue pour le tableau de bord enseignant
    Fournit des statistiques globales et par classe
    """

    def list(self, request):
        user = request.user

        # 🔐 Sécurité
        if user.user_type != user.TEACHER or not user.school:
            return Response({"detail": "Accès interdit"}, status=403)

        # =============================
        # 1️⃣ ASSIGNATIONS DU PROF
        # =============================
        assignments = TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        ).select_related("classe", "course")

        # =============================
        # 2️⃣ CLASSES CONCERNÉES
        # =============================
        classes = Classe.objects.filter(
            assignments__in=assignments
        ).distinct().select_related("academic_period")

        # =============================
        # 3️⃣ ÉVALUATIONS & NOTES (GLOBAL)
        # =============================
        evaluations = Evaluation.objects.filter(
            teaching_assignment__in=assignments
        )

        grades = Grade.objects.filter(
            evaluation__in=evaluations
        )

        # =============================
        # 4️⃣ KPI GLOBALS
        # =============================
        avg_score = grades.aggregate(avg=Avg("score"))["avg"] or 0
        avg_max = evaluations.aggregate(avg=Avg("max_score"))["avg"] or 20 # Par défaut 20 pour éviter div/0

        # Calcul du pourcentage de réussite global
        success_rate = round((avg_score / avg_max) * 100, 2) if avg_max > 0 else 0

        students_without_grades_global = Enrollment.objects.filter(
            classe__in=classes,
            status="active"
        ).exclude(
            grades__evaluation__in=evaluations
        ).distinct().count()

        stats = {
            "total_classes": classes.count(),
            "total_assignments": assignments.count(),
            "total_evaluations": evaluations.count(),
            "planned_evaluations": evaluations.filter(date__gt=timezone.now()).count(),
            "completed_evaluations": evaluations.filter(date__lte=timezone.now()).count(),
            "students_without_grades": students_without_grades_global,
            "success_rate": success_rate
        }

        # =============================
        # 5️⃣ PRÉPARATION DES DONNÉES PAR CLASSE
        # =============================
        # On calcule les stats spécifiques et on les attache aux objets
        # Le serializer les lira comme si c'étaient des champs de la base de données
        
        for classe in classes:
            # Filtres locaux pour cette classe
            class_evals = evaluations.filter(teaching_assignment__classe=classe)
            class_grades = grades.filter(evaluation__in=class_evals)

            # Calcul moyenne locale
            c_avg = class_grades.aggregate(avg=Avg("score"))["avg"] or 0
            # Note: Pour être précis, il faudrait aussi la moyenne des max_score de cette classe
            # Ici je simplifie en prenant la note brute, adapte selon ta logique de notation (ex: sur 20)
            classe.success_rate = round(c_avg, 2) 

            # Calcul élèves sans notes local
            classe.students_without_grades = Enrollment.objects.filter(
                classe=classe,
                status="active"
            ).exclude(
                grades__evaluation__in=class_evals
            ).distinct().count()

        # =============================
        # 6️⃣ SÉRIALISATION FINALE
        # =============================
        # C'est ICI qu'on utilise le serializer une seule fois pour tout formater
        # Il va inclure automatiquement 'courses' grâce à sa méthode get_courses
        
        class_serializer = TeacherClassStatsSerializer(
            classes, 
            many=True, 
            context={'request': request}
        )

        return Response({
            "stats": stats,
            "classes": class_serializer.data
        })


        
# ... (Tes imports existants) ...
from django.db import transaction
from rest_framework import status
from .models import Evaluation, Grade, GradingPeriod
from pupils.models import Enrollment
from .serializers import (
    CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer, 
    TeacherClassDashboardSerializer, EvaluationSerializer, GradeSerializer, 
    GradebookDataSerializer
)

# ... (CourseViewSet et ClasseViewSet restent inchangés) ...

class TeachingAssignmentViewSet(AcademiaBaseViewSet):
    serializer_class = TeachingAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return TeachingAssignment.objects.none()

        return TeachingAssignment.objects.filter(
            classe__school=user.school
        ).select_related('classe__school', 'course', 'teacher')


    def perform_create(self, serializer):
        # On écrase la méthode de AcademiaBaseViewSet 
        # car TeachingAssignment n'a pas de champ 'school'
        serializer.save()

    @action(detail=True, methods=['get'])
    def gradebook(self, request, pk=None):
        assignment = self.get_object()
        # On récupère l'ID de la période depuis l'URL (?period=ID)
        period_id = request.query_params.get('period')

        # 1. Récupérer les évaluations filtrées
        evaluations = Evaluation.objects.filter(teaching_assignment=assignment)
        if period_id:
            evaluations = evaluations.filter(grading_period_id=period_id)
        
        evaluations = evaluations.order_by('date')

        # 2. Récupérer les élèves (Enrollments)
        # On s'assure d'avoir le nom complet pour le JS
        enrollments = Enrollment.objects.filter(
            classe=assignment.classe,
            status='active'
        ).select_related('student').order_by('student__last_name', 'student__first_name')

        # 3. Récupérer les notes
        grades = Grade.objects.filter(
            evaluation__in=evaluations,
            enrollment__in=enrollments
        )

        # 4. Formater les données pour le JS (sans passer par un Serializer complexe)
        return Response({
            "assignment_info": {
                "course_name": assignment.course.name,
                "classe_name": assignment.classe.name,
                "teacher_name": assignment.teacher.get_full_name() if assignment.teacher else "N/A"
            },
            "students": [
                {
                    "id": e.id, # C'est l'ID de l'inscription (Enrollment)
                    "student_id": e.student.id, # ID réel de l'élève
                    "full_name": f"{e.student.last_name} {e.student.first_name}"
                } for e in enrollments
            ],
            "evaluations": [
                {
                    "id": ev.id,
                    "name": ev.name,
                    "max_score": ev.max_score,
                    "weight": ev.weight,
                    "is_published": ev.is_published,
                    "date": ev.date
                } for ev in evaluations
            ],
            "grades": [
                {
                    "id": g.id,
                    "enrollment": g.enrollment_id,
                    "evaluation": g.evaluation_id,
                    "score": g.score
                } for g in grades
            ]
        })

class EvaluationViewSet(viewsets.ModelViewSet):
    """CRUD pour créer/modifier/supprimer une épreuve"""
    queryset = Evaluation.objects.all()
    
    serializer_class = EvaluationSerializer
    permission_classes = [IsAuthenticated] # À affiner selon tes règles

    def get_queryset(self):
        user = self.request.user

        qs = Evaluation.objects.filter(
            teaching_assignment__classe__school=user.school
        )
        if user.user_type == user.TEACHER:
            qs = qs.filter(teaching_assignment__teacher=user)

        return qs

    def perform_create(self, serializer):
        # On peut ajouter des vérifs ici si nécessaire
        serializer.save()


class GradeViewSet(viewsets.ModelViewSet):
    """
    CRUD pour les notes.
    Supporte la mise à jour massive (bulk) pour le tableau JS.
    """
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(graded_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(graded_by=self.request.user)
        
    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return Grade.objects.none()

        return Grade.objects.filter(
            enrollment__classe__school=user.school
        )

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        """
        Action spéciale pour sauvegarder plusieurs notes d'un coup depuis le tableau JS.
        Attend une liste JSON : [{enrollment: 1, evaluation: 2, score: 15}, ...]
        """
        data = request.data
        if not isinstance(data, list):
            return Response({"error": "Une liste de notes est attendue."}, status=status.HTTP_400_BAD_REQUEST)

        created_or_updated = []
        errors = []

        with transaction.atomic():
            for item in data:
                # Validation manuelle ou via Serializer
                serializer = self.get_serializer(data=item)
                if serializer.is_valid():
                    # Logique update_or_create manuelle pour DRF
                    enrollment_id = item.get('enrollment')
                    evaluation_id = item.get('evaluation')
                    score = item.get('score')

                    obj, created = Grade.objects.update_or_create(
                        enrollment_id=enrollment_id,
                        evaluation_id=evaluation_id,
                        defaults={
                            'score': score,
                            'graded_by': request.user
                        }
                    )
                    created_or_updated.append(obj.id)
                else:
                    errors.append(serializer.errors)
        
        if errors:
            return Response({"status": "partial_error", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({"status": "success", "count": len(created_or_updated)})

# academia/views.py
from .models import GradingPeriod
from .serializers import GradingPeriodSerializer

class GradingPeriodViewSet(viewsets.ModelViewSet):
    """
    CRUD pour les périodes de notation
    """
    queryset = GradingPeriod.objects.all()
    serializer_class = GradingPeriodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return GradingPeriod.objects.none()
        
        # Filtrer par l'école de l'utilisateur
        return GradingPeriod.objects.filter(
            academic_period__school=user.school
        ).order_by('academic_period', 'sequence_order')
        
    def get_queryset(self):
        user = self.request.user
        return GradingPeriod.objects.filter(
            academic_period__school=user.school,
            academic_period__is_current=True,
            is_closed=False
        ).order_by("sequence_order")

    

def teacher_gradebook_view(request, assignment_id=None, class_id=None):
    # On redirige vers le fichier physique présent dans ton dossier static
    # Le JS à l'intérieur de gradebook.html devra lire l'ID depuis l'URL
    return redirect(f'/static/dist/html/teacher/gradebook.html?assignment_id={assignment_id}')