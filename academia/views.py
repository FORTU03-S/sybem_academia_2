# academia/views.py

import logging
from django.shortcuts import render, redirect
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import APIView, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.viewsets import ViewSet
from users.models import User
# --- Imports des Modèles ---
from .models import (
    Course, 
    Classe, 
    TeachingAssignment, 
    Evaluation, 
    Grade, 
    GradingPeriod,
    GradeChangeRequest
)
from pupils.models import Enrollment

# --- Imports des Permissions ---

from users.permissions_backend import CanManageSchoolResources

# --- Imports des Serializers ---
from .serializers import (
    CourseSerializer, 
    ClasseSerializer, 
    TeachingAssignmentSerializer, 
    TeacherClassDashboardSerializer,
    TeacherDashboardStatsSerializer,
    TeacherClassStatsSerializer,
    EvaluationSerializer, 
    GradeSerializer, 
    GradebookDataSerializer,
    GradingPeriodSerializer
)

# Configuration du logger (optionnel mais recommandé)
logger = logging.getLogger(__name__)

class AcademiaBaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet de base pour l'application Academia.
    Gère les permissions dynamiques :
    - Lecture seule (list, retrieve) : Utilisateur authentifié.
    - Écriture (create, update, delete) : Permission 'CanManageSchoolResources'.
    """
    permission_classes = [CanManageSchoolResources]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [CanManageSchoolResources()]


class CourseViewSet(AcademiaBaseViewSet):
    """
    Gestion des cours (Matières).
    Filtre les cours pour n'afficher que ceux de l'école de l'utilisateur connecté.
    """
    serializer_class = CourseSerializer

    def get_queryset(self):
        user = self.request.user

        # Sécurité absolue : pas d'école = pas de données
        if not user.is_authenticated or not user.school:
            return Course.objects.none()

        # 🔥 FILTRAGE PAR ÉCOLE
        return Course.objects.filter(
            school=user.school
        ).order_by("name")

    def perform_create(self, serializer):
        if not self.request.user.school:
            raise ValidationError({
                "detail": "Impossible de créer un cours : vous n'êtes rattaché à aucune école."
            })
        serializer.save(school=self.request.user.school)

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.school != self.request.user.school:
            raise PermissionDenied("Accès interdit à ce cours.")
        serializer.save()
        
    def perform_destroy(self, instance):
        if instance.school != self.request.user.school:
            raise PermissionDenied("Suppression interdite.")
        instance.delete()

# ... importations ...

class ClasseViewSet(viewsets.ModelViewSet):
    """
    Gestion des classes.
    """
    serializer_class = ClasseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return Classe.objects.none()

        # CORRECTION : On filtre UNIQUEMENT par école.
        # On enlève 'academic_period__is_current=True' pour voir toutes les classes (même futures).
        return Classe.objects.filter(
            school=user.school
        ).select_related(
            "academic_period",
            "school",
            "titulaire"
        )

    def perform_create(self, serializer):
        user = self.request.user
        if not user.school:
            raise ValidationError("Action impossible : vous n'êtes rattaché à aucune école.")
        
        # Sauvegarde avec l'école de l'utilisateur
        serializer.save(school=user.school)
        
class TeacherScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Vue en lecture seule pour l'emploi du temps du professeur.
    """
    serializer_class = TeachingAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        return TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        )


class TeacherDashboardViewSet(ViewSet):
    """
    Vue pour le tableau de bord enseignant.
    Fournit des statistiques globales et par classe pour l'année en cours.
    """

    def list(self, request):
        user = request.user

        # 🔐 Sécurité
        if user.user_type != getattr(user, 'TEACHER', 'TEACHER') or not user.school:
            # Note: getattr sécurise si la constante TEACHER n'est pas définie sur le modèle User
            return Response({"detail": "Accès interdit"}, status=403)

        # 1️⃣ ASSIGNATIONS DU PROF (Année active uniquement)
        assignments = TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        ).select_related("classe", "course")

        # 2️⃣ CLASSES CONCERNÉES
        classes = Classe.objects.filter(
            assignments__in=assignments
        ).distinct().select_related("academic_period")

        # 3️⃣ ÉVALUATIONS & NOTES (GLOBAL)
        evaluations = Evaluation.objects.filter(
            teaching_assignment__in=assignments
        )

        grades = Grade.objects.filter(
            evaluation__in=evaluations
        )

        # 4️⃣ KPI GLOBALS
        avg_score = grades.aggregate(avg=Avg("score"))["avg"] or 0
        avg_max = evaluations.aggregate(avg=Avg("max_score"))["avg"] or 20 

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

        # 5️⃣ PRÉPARATION DES DONNÉES PAR CLASSE
        for classe in classes:
            class_evals = evaluations.filter(teaching_assignment__classe=classe)
            class_grades = grades.filter(evaluation__in=class_evals)

            c_avg = class_grades.aggregate(avg=Avg("score"))["avg"] or 0
            classe.success_rate = round(c_avg, 2) 

            classe.students_without_grades = Enrollment.objects.filter(
                classe=classe,
                status="active"
            ).exclude(
                grades__evaluation__in=class_evals
            ).distinct().count()

        # 6️⃣ SÉRIALISATION FINALE
        class_serializer = TeacherClassStatsSerializer(
            classes, 
            many=True, 
            context={'request': request}
        )

        return Response({
            "stats": stats,
            "classes": class_serializer.data
        })


class TeachingAssignmentViewSet(AcademiaBaseViewSet):
    """
    Gestion des assignations (Cours donnés dans une classe).
    Contient la logique du Carnet de Notes (Gradebook).
    """
    serializer_class = TeachingAssignmentSerializer
    
    def get_permissions(self):
        # Le prof peut voir ses assignations et son carnet de notes
        if self.action in ['list', 'retrieve', 'gradebook']:
            return [IsAuthenticated()]
        # Admin nécessaire pour créer/supprimer une assignation
        return [CanManageSchoolResources()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return TeachingAssignment.objects.none()

        # Sécurité : le prof ne voit que SES assignations à lui
        return TeachingAssignment.objects.filter(
            classe__school=user.school,
            teacher=user  
        ).select_related('classe__school', 'course', 'teacher')

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['get'])
    def gradebook(self, request, pk=None):
        """
        Récupère toutes les données nécessaires pour le carnet de notes (JS Grid).
        """
        assignment = self.get_object()
        period_id = request.query_params.get('period')

        # 1. Récupérer les évaluations
        evaluations = Evaluation.objects.filter(teaching_assignment=assignment)
        if period_id:
            evaluations = evaluations.filter(grading_period_id=period_id)
        evaluations = evaluations.order_by('date')

        # 2. Récupérer les élèves actifs
        enrollments = Enrollment.objects.filter(
            classe=assignment.classe,
            status='active'
        ).select_related('student').order_by('student__last_name', 'student__first_name')

        # 3. Récupérer les notes
        grades = Grade.objects.filter(
            evaluation__in=evaluations,
            enrollment__in=enrollments
        )

        # 4. Format JSON optimisé pour le frontend
        return Response({
            "assignment_info": {
                "course_name": assignment.course.name,
                "classe_name": assignment.classe.name,
                "teacher_name": assignment.teacher.get_full_name() if assignment.teacher else "N/A"
            },
            "students": [
                {
                    "id": e.id,
                    "student_id": e.student.id,
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
    """
    CRUD pour créer/modifier/supprimer une épreuve (Devoir, Interro, Examen).
    """
    queryset = Evaluation.objects.all()
    serializer_class = EvaluationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Evaluation.objects.filter(
            teaching_assignment__classe__school=user.school
        )
        if user.user_type == getattr(user, 'TEACHER', 'TEACHER'):
            qs = qs.filter(teaching_assignment__teacher=user)
        return qs

    def perform_create(self, serializer):
        serializer.save()


class GradingPeriodViewSet(viewsets.ModelViewSet):
    """
    CRUD pour les périodes de notation (Trimestres, Semestres).
    """
    queryset = GradingPeriod.objects.all()
    serializer_class = GradingPeriodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # NOTE : J'ai gardé la version la plus restrictive de ton code original
        # qui semble correspondre à ce que le frontend attend (active & non clôturée)
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return GradingPeriod.objects.none()

        return GradingPeriod.objects.filter(
            academic_period__school=user.school,
            academic_period__is_current=True,
            is_closed=False
        ).order_by("sequence_order")


def teacher_gradebook_view(request, assignment_id=None, class_id=None):
    """
    Vue Django classique pour rediriger vers le fichier HTML statique du carnet.
    """
    return redirect(f'/static/dist/html/teacher/gradebook.html?assignment_id={assignment_id}')

# C:\Users\user\sybem_academia2\sybem\academia\views.py

class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer
    # On remet IsAuthenticated par défaut pour la sécurité
    permission_classes = [IsAuthenticated] 
    authentication_classes = [JWTAuthentication]

    @action(detail=False, methods=['post'], url_path='request-change')
    def request_change(self, request):
        data = request.data
        user = request.user
        
        # VERIFICATION CRUCIALE
        if not user.is_authenticated:
            return Response({"detail": "Vous devez être connecté pour effectuer cette action."}, status=401)

        try:
            enrollment = Enrollment.objects.get(pk=data.get('enrollment_id'))
            evaluation = Evaluation.objects.get(pk=data.get('evaluation_id'))

            GradeChangeRequest.objects.create(
                teacher=user,  # Maintenant 'user' est garanti d'être valide
                enrollment=enrollment,
                evaluation=evaluation,
                old_score=data.get('old_score'),
                new_score=data.get('new_score'),
                reason=data.get('reason'),
                status='PENDING'
            )

            return Response({"status": "success", "detail": "Demande envoyée"}, status=201)

        except Exception as e:
            print(f"ERREUR: {str(e)}")
            return Response({"detail": str(e)}, status=500)
        