from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from users.permissions_backend import CanManageSchoolResources 
from .models import Course, Classe, TeachingAssignment
from .serializers import CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer, TeacherClassDashboardSerializer
# je garde mes imports de modèles nécessaires
# academia/views.py

from django.db.models import Avg, Count, Q
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import TeachingAssignment, Classe, Evaluation, Grade
from .serializers import TeacherDashboardStatsSerializer
from rest_framework.permissions import IsAuthenticated

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
    """
    Vue réservée aux enseignants pour voir leur propre emploi du temps
    """
    serializer_class = TeachingAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        # On récupère uniquement les cours assignés à cet utilisateur
        # On filtre aussi sur la période académique active de son école
        return TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        ).select_related('classe', 'course')
        


from django.db.models import Avg, Count, Q
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

class TeacherDashboardViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        user = request.user

        if user.user_type != user.TEACHER:
            return Response({"detail": "Accès refusé"}, status=403)

        # Classes assignées au prof
        classes = Classe.objects.filter(
            assignments__teacher=user,
            academic_period__is_current=True
        ).distinct()

        assignments = TeachingAssignment.objects.filter(
            teacher=user,
            classe__in=classes
        )

        # =============================
        # 📊 TAUX DE RÉUSSITE PAR CLASSE
        # =============================
        success_by_class = []

        for classe in classes:
            grades = Grade.objects.filter(
                evaluation__teaching_assignment__teacher=user,
                enrollment__classe=classe
            )

            avg_score = grades.aggregate(avg=Avg("score"))["avg"]

            success_rate = 0
            if avg_score is not None:
                success_rate = round((avg_score / 20) * 100, 1)

            success_by_class.append({
                "class_id": classe.id,
                "class_name": classe.name,
                "success_rate": success_rate
            })

        # =============================
        # 📅 ÉVALUATIONS
        # =============================
        evaluations = Evaluation.objects.filter(
            teaching_assignment__teacher=user
        )

        evaluations_data = {
            "planned": evaluations.filter(is_published=False).count(),
            "completed": evaluations.filter(is_published=True).count()
        }

        data = {
            "total_classes": classes.count(),
            "total_assignments": assignments.count(),
            "charts": {
                "success_by_class": success_by_class,
                "evaluations": evaluations_data
            }
        }

        return Response(data)



        
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

    @action(detail=True, methods=['get'], url_path='gradebook-data')
    def get_gradebook_data(self, request, pk=None):
        """
        Endpoint ULTRA COMPLET pour le frontend JS.
        Renvoie : Infos du cours + Liste des élèves + Liste des évaluations + Toutes les notes.
        URL: /api/academia/assignments/{id}/gradebook-data/
        """
        assignment = self.get_object() # Vérifie automatiquement les permissions

        # 1. Récupérer les évaluations (Colonnes du tableau)
        evaluations = Evaluation.objects.filter(
            teaching_assignment=assignment
        ).order_by('date')

        # 2. Récupérer les élèves inscrits (Lignes du tableau)
        # On suppose que Enrollment a un status 'active'
        students_enrollments = Enrollment.objects.filter(
            classe=assignment.classe,
            status='active' # Adapte selon ton modèle Enrollment
        ).select_related('student').order_by('student__last_name')

        # 3. Récupérer les notes existantes (Cellules remplies)
        grades = Grade.objects.filter(
            evaluation__in=evaluations,
            enrollment__in=students_enrollments
        ).select_related('enrollment__student')

        # 4. Construire la réponse structurée
        serializer = GradebookDataSerializer({
            'assignment_info': assignment,
            'students': students_enrollments,
            'evaluations': evaluations,
            'grades': grades
        })

        return Response(serializer.data)


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

