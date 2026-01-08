from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from users.permissions_backend import CanManageSchoolResources 
from .models import Course, Classe, TeachingAssignment
from .serializers import CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer, TeacherClassDashboardSerializer
# je garde mes imports de modèles nécessaires

from rest_framework.permissions import IsAuthenticated

class AcademiaBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [CanManageSchoolResources]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [CanManageSchoolResources()]


class CourseViewSet(AcademiaBaseViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

class ClasseViewSet(viewsets.ModelViewSet):
    queryset = Classe.objects.all()
    serializer_class = ClasseSerializer

    def perform_create(self, serializer):
        # On extrait l'ID de la période depuis les données brutes de la requête
        period_id = self.request.data.get('academic_period')
        
        # On force l'enregistrement avec l'ID de la période et l'école de l'utilisateur
        serializer.save(
            school=self.request.user.school,
            academic_period_id=period_id
        )

    def perform_update(self, serializer):
        period_id = self.request.data.get('academic_period')
        if period_id:
            serializer.save(academic_period_id=period_id)
        else:
            serializer.save()

    # Cette méthode permet de récupérer les données formatées exactement comme mon frontend le veut
    # Si mon sérialiseur ne renvoie pas 'titulaire_name', on peut surcharger list()
    # Mais l'idéal est de mettre ces champs dans le ClasseSerializer (MethodField)



class TeachingAssignmentViewSet(AcademiaBaseViewSet):
    queryset = TeachingAssignment.objects.all().select_related('classe__school', 'course', 'teacher')
    serializer_class = TeachingAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return self.queryset.none()
        
        # Filtrage par l'école via la relation classe
        qs = self.queryset.filter(classe__school=user.school)

        # Filtrage par ID de classe (pour l'affichage dans le tableau)
        classe_id = self.request.query_params.get('classe_id')
        if classe_id:
            qs = qs.filter(classe_id=classe_id)
        return qs

    def perform_create(self, serializer):
        # On écrase la méthode de AcademiaBaseViewSet 
        # car TeachingAssignment n'a pas de champ 'school'
        serializer.save() 
        
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
        
class TeacherDashboardViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Tableau de bord de l’enseignant :
    classes + cours assignés
    """
    serializer_class = TeacherClassDashboardSerializer

    def get_queryset(self):
        user = self.request.user

        # Sécurité
        if not user.is_authenticated or user.user_type != user.TEACHER:
            return Classe.objects.none()

        return (
            Classe.objects
            .filter(
                assignments__teacher=user,
                academic_period__is_current=True
            )
            .select_related("academic_period")
            .distinct()
        )