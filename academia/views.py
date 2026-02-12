# C:\Users\user\sybem_academia2\sybem\academia\views.py

import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.viewsets import ViewSet
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

# --- Imports des Modèles ---
from users.models import User
from pupils.models import Enrollment
from users.permissions_backend import CanManageSchoolResources
from .models import (
    Course, 
    Classe, 
    TeachingAssignment, 
    Evaluation, 
    Grade, 
    GradingPeriod,
    GradeChangeRequest
)

# --- Imports des Serializers ---
from .serializers import (
    CourseSerializer, 
    ClasseSerializer, 
    TeachingAssignmentSerializer, 
    TeacherClassDashboardSerializer,
    TeacherClassStatsSerializer,
    EvaluationSerializer, 
    GradeSerializer, 
    GradingPeriodSerializer
)

# Configuration du logger
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# 1. BASE VIEWSET
# ----------------------------------------------------------------------

class AcademiaBaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet de base pour l'application Academia.
    Gère les permissions dynamiques.
    """
    permission_classes = [CanManageSchoolResources]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [CanManageSchoolResources()]

# ----------------------------------------------------------------------
# 2. COURSES & CLASSES
# ----------------------------------------------------------------------

class CourseViewSet(AcademiaBaseViewSet):
    """
    Gestion des cours (Matières).
    """
    serializer_class = CourseSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return Course.objects.none()
        return Course.objects.filter(school=user.school).order_by("name")

    def perform_create(self, serializer):
        if not self.request.user.school:
            raise ValidationError({"detail": "Impossible de créer : aucune école rattachée."})
        
        # On extrait l'ID de la période si présent
        period_id = self.request.data.get('academic_period')
        serializer.save(
            school=self.request.user.school,
            academic_period_id=period_id
        )

    def perform_update(self, serializer):
        if self.get_object().school != self.request.user.school:
            raise PermissionDenied("Accès interdit.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.school != self.request.user.school:
            raise PermissionDenied("Suppression interdite.")
        instance.delete()


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

        return Classe.objects.filter(school=user.school).select_related(
            "academic_period", "school", "titulaire"
        )

    def perform_create(self, serializer):
        if not self.request.user.school:
            raise ValidationError("Action impossible : vous n'êtes rattaché à aucune école.")
        serializer.save(school=self.request.user.school)

# ----------------------------------------------------------------------
# 3. TEACHER DASHBOARD & ASSIGNMENTS
# ----------------------------------------------------------------------

class TeacherDashboardViewSet(ViewSet):
    """
    Vue principale pour l'enseignant.
    Gère :
    1. Le Dashboard (statistiques) via list()
    2. Le Carnet de notes (Gradebook) via l'action @gradebook
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Affiche les statistiques du dashboard"""
        user = request.user

        # Sécurité
        if user.user_type != getattr(user, 'TEACHER', 'TEACHER') or not user.school:
            return Response({"detail": "Accès réservé aux enseignants."}, status=403)

        # 1. Récupération des données
        assignments = TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        ).select_related("classe", "course")

        classes = Classe.objects.filter(
            assignments__in=assignments
        ).distinct().select_related("academic_period")

        evaluations = Evaluation.objects.filter(teaching_assignment__in=assignments)
        grades = Grade.objects.filter(evaluation__in=evaluations)

        # 2. KPI Globaux
        avg_score = grades.aggregate(avg=Avg("score"))["avg"] or 0
        avg_max = evaluations.aggregate(avg=Avg("max_score"))["avg"] or 20 
        success_rate_global = round((avg_score / avg_max) * 100, 2) if avg_max > 0 else 0

        students_without_grades_global = Enrollment.objects.filter(
            classe__in=classes, status="active"
        ).exclude(grades__evaluation__in=evaluations).distinct().count()

        stats = {
            "total_classes": classes.count(),
            "total_assignments": assignments.count(),
            "total_evaluations": evaluations.count(),
            "planned_evaluations": evaluations.filter(date__gt=timezone.now()).count(),
            "completed_evaluations": evaluations.filter(date__lte=timezone.now()).count(),
            "students_without_grades": students_without_grades_global,
            "success_rate": success_rate_global
        }

        # 3. Calculs par classe
        for classe in classes:
            class_evals = evaluations.filter(teaching_assignment__classe=classe)
            class_grades = grades.filter(evaluation__in=class_evals)
            
            c_avg = class_grades.aggregate(avg=Avg("score"))["avg"] or 0
            c_max = class_evals.aggregate(avg=Avg("max_score"))["avg"] or 20
            
            classe.success_rate = round((c_avg / c_max) * 100, 2) if c_max > 0 else 0
            
            classe.students_without_grades = Enrollment.objects.filter(
                classe=classe, status="active"
            ).exclude(grades__evaluation__in=class_evals).distinct().count()

        class_serializer = TeacherClassStatsSerializer(
            classes, many=True, context={'request': request}
        )

        return Response({
            "stats": stats,
            "classes": class_serializer.data
        })

    @action(detail=True, methods=['get'])
    def gradebook(self, request, pk=None):
        """
        Récupère les données pour le carnet de notes (JS Grid).
        pk est l'ID du TeachingAssignment.
        """
        assignment = get_object_or_404(TeachingAssignment, pk=pk, teacher=request.user)
        period_id = request.query_params.get('period')

        # 1. Récupérer les évaluations
        evaluations = Evaluation.objects.filter(teaching_assignment=assignment)
        if period_id:
            evaluations = evaluations.filter(grading_period_id=period_id)
        evaluations = evaluations.order_by('date')

        # 2. Récupérer les élèves
        enrollments = Enrollment.objects.filter(
            classe=assignment.classe,
            status='active'
        ).select_related('student').order_by('student__last_name', 'student__first_name')

        # 3. Récupérer les notes
        grades = Grade.objects.filter(
            evaluation__in=evaluations,
            enrollment__in=enrollments
        )

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


class TeachingAssignmentViewSet(AcademiaBaseViewSet):
    """
    Gestion des assignations (Qui enseigne quoi).
    Fournit également les données pour le carnet de notes.
    """
    serializer_class = TeachingAssignmentSerializer
    queryset = TeachingAssignment.objects.all()

    def get_permissions(self):
        """
        Autorise les enseignants à consulter la liste et le carnet de notes.
        La modification des assignations reste réservée aux admins (CanManageSchoolResources).
        """
        if self.action in ['list', 'retrieve', 'gradebook']:
            return [IsAuthenticated()]
        return [CanManageSchoolResources()]

    def get_queryset(self):
        """
        Filtre les assignations par école et par enseignant.
        """
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return TeachingAssignment.objects.none()

        # Base : uniquement les assignations de l'école de l'utilisateur
        queryset = TeachingAssignment.objects.filter(classe__school=user.school)

        # Filtre optionnel par classe (via ?classe_id=X)
        classe_id = self.request.query_params.get('classe_id')
        if classe_id:
            queryset = queryset.filter(classe_id=classe_id)

        # Sécurité : un enseignant ne voit que ses propres cours
        # Un administrateur (is_staff) ou un superadmin voit tout
        if user.user_type == 'teacher' and not user.is_staff:
            queryset = queryset.filter(teacher=user)

        return queryset.select_related('classe', 'course', 'teacher').order_by('course__name')

    @action(detail=True, methods=['get'])
    def gradebook(self, request, pk=None):
        """
        Récupère les données du carnet de notes avec calcul automatique des totaux de cycles.
        """
        assignment = self.get_object()
        classe = assignment.classe
        period_id = request.query_params.get('period') 

        # 1. Identifier la période demandée et ses enfants
        requested_period = None
        target_period_ids = []
        
        if period_id:
            requested_period = get_object_or_404(GradingPeriod, pk=period_id)
            if requested_period.category == GradingPeriod.Category.ROOT:
                target_period_ids = list(requested_period.sub_periods.values_list('id', flat=True))
            else:
                target_period_ids = [requested_period.id]
        else:
            # === C'EST ICI QUE TU INSÈRES TA LOGIQUE ===
            
            # On récupère d'abord toutes les périodes de l'année
            periods_qs = GradingPeriod.objects.filter(academic_period=classe.academic_period)

            # --- TA LOGIQUE DE FILTRAGE ---
            # Si tu veux utiliser system_type (TRIMESTER/SEMESTER) :
            if classe.system_type == 'TRIMESTER':
                periods_qs = periods_qs.filter(name__icontains="Primaire")
            else:
                periods_qs = periods_qs.filter(name__icontains="Secondaire")
            
            # NOTE : Une méthode plus robuste serait d'utiliser education_level si disponible :
            # if classe.education_level == 'PRIMARY':
            #     periods_qs = periods_qs.filter(name__icontains="Primaire")
            # elif classe.education_level == 'SECONDARY':
            #     periods_qs = periods_qs.filter(name__icontains="Secondaire")
            # ------------------------------

            # On ne garde que les périodes "feuilles" (pas les racines comme Trimestre 1)
            target_period_ids = list(periods_qs.exclude(category=GradingPeriod.Category.ROOT).values_list('id', flat=True))

        # 2. Récupérer Evaluations, Elèves et Notes (Le reste ne change pas)
        evaluations = Evaluation.objects.filter(
            teaching_assignment=assignment, 
            grading_period_id__in=target_period_ids
        ).order_by('grading_period__sequence_order', 'date')

        enrollments = Enrollment.objects.filter(
            classe=classe, status='active'
        ).select_related('student').order_by('student__last_name')

        grades = Grade.objects.filter(
            evaluation__in=evaluations,
            enrollment__in=enrollments
        )

        # 3. CALCUL DES TOTAUX PAR CYCLE (Le cœur de ta demande)
        # On récupère les périodes ROOT (Trimestres/Semestres)
        roots = GradingPeriod.objects.filter(
            academic_period=classe.academic_period, 
            category=GradingPeriod.Category.ROOT
        ).prefetch_related('sub_periods')

        cycle_summaries = []
        for enroll in enrollments:
            student_totals = []
            for root in roots:
                # Utilise la méthode de calcul qu'on a ajoutée au modèle GradingPeriod
                total_points = root.get_total_for_assignment(enroll.id, assignment.id)
                student_totals.append({
                    "cycle_name": root.name,
                    "cycle_id": root.id,
                    "total_score": total_points
                })
            
            cycle_summaries.append({
                "enrollment_id": enroll.id,
                "totals": student_totals
            })

        return Response({
            "assignment_info": {
                "id": assignment.id,
                "course_name": assignment.course.name,
                "classe_name": classe.name,
                "system_type": classe.system_type, # TRIMESTER ou SEMESTER
                "education_level": classe.education_level
            },
            "evaluations": EvaluationSerializer(evaluations, many=True).data,
            "students": [
                {"id": e.id, "full_name": f"{e.student.last_name} {e.student.first_name}"} 
                for e in enrollments
            ],
            "grades": GradeSerializer(grades, many=True).data,
            "cycle_summaries": cycle_summaries  # <-- Les totaux calculés (P1+P2+Ex)
        })

class TeacherScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Vue lecture seule emploi du temps prof.
    """
    serializer_class = TeachingAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        return TeachingAssignment.objects.filter(
            teacher=user,
            classe__school=user.school,
            classe__academic_period__is_current=True
        ).select_related('classe', 'course')

# ----------------------------------------------------------------------
# 4. EVALUATIONS & GRADES
# ----------------------------------------------------------------------

class EvaluationViewSet(viewsets.ModelViewSet):
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


class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return Grade.objects.none()
        return Grade.objects.filter(enrollment__classe__school=user.school)

    def perform_create(self, serializer):
        serializer.save(graded_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(graded_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        """Sauvegarde massive des notes."""
        data = request.data
        if not isinstance(data, list):
            return Response({"error": "Une liste de notes est attendue."}, status=status.HTTP_400_BAD_REQUEST)

        created_or_updated = []
        errors = []

        with transaction.atomic():
            for item in data:
                serializer = self.get_serializer(data=item)
                # Note: GradeSerializer might need 'enrollment' object, handled here via raw IDs
                enrollment_id = item.get('enrollment')
                evaluation_id = item.get('evaluation')
                score = item.get('score')

                if enrollment_id and evaluation_id and score is not None:
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
                    errors.append({"detail": "Données incomplètes pour une ligne", "data": item})

        if errors:
            return Response({"status": "partial_error", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": "success", "count": len(created_or_updated)})

    @action(detail=False, methods=['post'], url_path='request-change')
    def request_change(self, request):
        """Demande de modification de note."""
        data = request.data
        user = request.user
        
        if not user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=401)

        try:
            enrollment = Enrollment.objects.get(pk=data.get('enrollment_id'))
            evaluation = Evaluation.objects.get(pk=data.get('evaluation_id'))

            GradeChangeRequest.objects.create(
                teacher=user,
                enrollment=enrollment,
                evaluation=evaluation,
                old_score=data.get('old_score'),
                new_score=data.get('new_score'),
                reason=data.get('reason'),
                status='PENDING'
            )
            return Response({"status": "success", "detail": "Demande envoyée"}, status=201)

        except Exception as e:
            logger.error(f"Erreur demande modif note: {e}")
            return Response({"detail": str(e)}, status=500)


class GradingPeriodViewSet(viewsets.ModelViewSet):
    queryset = GradingPeriod.objects.all()
    serializer_class = GradingPeriodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return GradingPeriod.objects.none()

        qs = GradingPeriod.objects.filter(academic_period__school=user.school)
        
        # --- FILTRE SYSTÈME (Primaire vs Secondaire) ---
        classe_id = self.request.query_params.get('classe_id')
        if classe_id:
            try:
                classe = Classe.objects.get(id=classe_id)
                if classe.system_type == 'TRIMESTER':
                    # On ne garde que les périodes marquées "(Primaire)"
                    qs = qs.filter(name__icontains="Primaire")
                else:
                    # On ne garde que les périodes marquées "(Secondaire)"
                    qs = qs.filter(name__icontains="Secondaire")
            except Classe.DoesNotExist:
                pass

        # Filtre optionnel : pour créer une évaluation, on ne veut que les "feuilles" (P1, P2, etc.)
        only_leafs = self.request.query_params.get('only_leafs')
        if only_leafs:
            qs = qs.exclude(category=GradingPeriod.Category.ROOT)
            
        return qs.order_by("sequence_order")

# ----------------------------------------------------------------------
# 5. VUES CLASSIQUES (NON-API)
# ----------------------------------------------------------------------

def teacher_gradebook_view(request, assignment_id=None, class_id=None):
    """
    Redirection vers le fichier HTML statique.
    """
    return redirect(f'/static/dist/html/teacher/gradebook.html?assignment_id={assignment_id}')

# ----------------------------------------------------------------------
# 6. GESTION DES BULLETINS (DIRECTION)
# ----------------------------------------------------------------------

class BulletinGeneratorViewSet(ViewSet):
    """
    Génération des bulletins scolaires (Direction).
    - Moyennes par cours
    - Moyenne générale
    - Classement
    - Compatible Trimestre / Semestre
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def generate(self, request):
        class_id = request.query_params.get('class_id')
        period_id = request.query_params.get('period_id')

        if not class_id or not period_id:
            return Response(
                {"error": "class_id et period_id sont requis"},
                status=400
            )

        # 🔐 Sécurité : contexte école
        school = request.user.school

        # 1️⃣ Contexte principal
        classe = get_object_or_404(
            Classe,
            id=class_id,
            school=school
        )

        period = get_object_or_404(
            GradingPeriod,
            id=period_id,
            academic_period__school=school
        )


        # 2️⃣ Détermination des périodes à inclure
        if period.category == GradingPeriod.Category.ROOT:
            target_period_ids = list(
                period.sub_periods.values_list('id', flat=True)
            )
        else:
            target_period_ids = [period.id]

        # 3️⃣ Élèves actifs
        enrollments = Enrollment.objects.filter(
            classe=classe,
            status='active'
        ).select_related('student')

        # 4️⃣ Cours réels de la classe (CORRECTION CLÉ)
        courses = Course.objects.filter(
            assignments__classe=classe
        ).distinct()

        # 5️⃣ Notes (optimisé)
        grades = Grade.objects.filter(
            enrollment__classe=classe,
            evaluation__grading_period_id__in=target_period_ids
        ).select_related(
            'evaluation',
            'evaluation__teaching_assignment',
            'enrollment',
            'enrollment__student'
        )

        # 6️⃣ Indexation mémoire
        grade_map = {}

        for grade in grades:
            student_id = grade.enrollment.student.id
            course_id = grade.evaluation.teaching_assignment.course.id

            grade_map.setdefault(student_id, {})
            grade_map[student_id].setdefault(course_id, {"score": 0, "max": 0})

            grade_map[student_id][course_id]["score"] += grade.score
            grade_map[student_id][course_id]["max"] += grade.evaluation.max_score

        # 7️⃣ Construction des bulletins
        bulletins = []

        for enrollment in enrollments:
            student = enrollment.student

            total_score = 0
            total_max = 0
            course_results = []

            for course in courses:
                data = grade_map.get(student.id, {}).get(
                    course.id, {"score": 0, "max": 0}
                )

                percentage = (
                    (data["score"] / data["max"]) * 100
                    if data["max"] > 0 else 0
                )

                course_results.append({
                    "course_id": course.id,
                    "course_name": course.name,
                    "score": round(data["score"], 2),
                    "max_score": round(data["max"], 2),
                    "percentage": round(percentage, 1)
                })

                total_score += data["score"]
                total_max += data["max"]

            average = (total_score / total_max) * 100 if total_max > 0 else 0

            bulletins.append({
                "student_id": student.id,
                "name": f"{student.last_name} {student.first_name}",
                "courses": course_results,
                "total_obtained": round(total_score, 2),
                "total_max": round(total_max, 2),
                "average": round(average, 2),
                "rank": 0
            })

        # 8️⃣ Classement
        bulletins.sort(key=lambda x: x["average"], reverse=True)

        for index, bulletin in enumerate(bulletins):
            bulletin["rank"] = index + 1
            bulletin["class_size"] = len(bulletins)

        # 9️⃣ Réponse API propre
        return Response({
    "school": {
        "name": classe.school.name,
        "province": getattr(classe.school, "province", "")
    },
    "academic_year": classe.academic_year.name if hasattr(classe, "academic_year") else "",
    "class_info": {
        "id": classe.id,
        "name": classe.name,
        "system": classe.system_type,
        "period": period.name
    },
    "bulletins": bulletins
})
