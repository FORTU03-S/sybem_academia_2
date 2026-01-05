from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from users.permissions_backend import CanManageSchoolResources 
from .models import Course, Classe, TeachingAssignment
from .serializers import CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer, TeacherClassDashboardSerializer
# je garde mes imports de modèles nécessaires

# --- CLASSE DE BASE (je l'avais déjà, elle est parfaite) ---
class AcademiaBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [CanManageSchoolResources]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return self.queryset.none()
        return self.queryset.filter(school=user.school)

    def perform_create(self, serializer):
        user = self.request.user
        if not user.school:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("L'utilisateur n'est pas associé à une école.")
        
        # Injection automatique de l'école
        kwargs = {'school': user.school}
        
        # Injection automatique de la période académique si le modèle le supporte
        if hasattr(serializer.Meta.model, 'academic_period'):
            from AcademicPeriod.models import AcademicPeriod
            from rest_framework.exceptions import NotFound
            try:
                active_period = AcademicPeriod.objects.get(school=user.school, is_current=True)
                kwargs['academic_period'] = active_period
            except AcademicPeriod.DoesNotExist:
                raise NotFound("Aucune période académique active trouvée.")
        
        serializer.save(**kwargs)

# --- VUES CORRIGÉES (Beaucoup plus court et sécurisé) ---

class CourseViewSet(AcademiaBaseViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

class ClasseViewSet(AcademiaBaseViewSet):
    queryset = Classe.objects.select_related('academic_period', 'titulaire').prefetch_related('courses')
    serializer_class = ClasseSerializer

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