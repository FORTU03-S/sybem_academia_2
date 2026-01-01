# academia/views.py

from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from django.db import models # Nécessaire pour l'introspection
from users.permissions_backend import CanManageSchoolResources 
from AcademicPeriod.models import AcademicPeriod
from .models import Course, Classe
from .serializers import CourseSerializer, ClasseSerializer, TeachingAssignmentSerializer
from .models import TeachingAssignment

class AcademiaBaseViewSet(viewsets.ModelViewSet):
    """
    Classe de base qui injecte automatiquement l'école de l'utilisateur.
    """
    permission_classes = [CanManageSchoolResources]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return self.queryset.none()
        
        # Filtre toutes les ressources académiques par l'école de l'utilisateur
        return self.queryset.filter(school=user.school)

    def perform_create(self, serializer):
        user = self.request.user
        
        if not user.school:
            raise PermissionDenied("L'utilisateur n'est pas associé à une école.")

        kwargs = {'school': user.school}
        
        # LOGIQUE D'INJECTION DE LA PÉRIODE ACADÉMIQUE
        # Seulement pour les modèles qui en ont besoin (comme Classe)
        if hasattr(serializer.Meta.model, 'academic_period'):
            try:
                active_period = AcademicPeriod.objects.get(school=user.school, is_current=True)
                kwargs['academic_period'] = active_period
            except AcademicPeriod.DoesNotExist:
                raise NotFound("Aucune période académique active trouvée pour cette école. Veuillez en créer une.")
        
        serializer.save(**kwargs)

# --- VUES SPÉCIFIQUES ---

class CourseViewSet(AcademiaBaseViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

class ClasseViewSet(AcademiaBaseViewSet):
    queryset = Classe.objects.all()
    serializer_class = ClasseSerializer
    
class TeachingAssignmentViewSet(AcademiaBaseViewSet):
    """
    Gère l'assignation des Cours aux Classes, y compris le coefficient (weight).
    """
    queryset = TeachingAssignment.objects.all()
    serializer_class = TeachingAssignmentSerializer
    
    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or not user.school:
            return self.queryset.none()
        
        # Filtre les assignations par l'école de la classe (qui doit être l'école de l'utilisateur)
        return self.queryset.filter(classe__school=user.school).order_by('classe__name', 'course__name')
    
    # Note: perform_create n'a pas besoin d'être modifié ici car l'école est déjà liée 
    # via les objets Classe et Course qui sont filtrés par école.