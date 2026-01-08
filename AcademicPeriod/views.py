# AcademicPeriod/views.py
from rest_framework import viewsets
from rest_framework import permissions
from .models import AcademicPeriod
from .serializers import AcademicPeriodSerializer
from rest_framework.exceptions import NotFound
from users.models import User

class AcademicPeriodViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des Périodes Académiques (CRUD).
    Le Superadmin peut gérer toutes les périodes.
    Les Admins d'école peuvent gérer uniquement celles de leur école.
    """
    queryset = AcademicPeriod.objects.all()
    serializer_class = AcademicPeriodSerializer
    permission_classes = [permissions.IsAuthenticated]

    # Filtrage : Un utilisateur d'école ne voit que les périodes de son école.
    def get_queryset(self):
        user = self.request.user
        if user.is_superadmin():
            # Le Superadmin voit toutes les périodes
            return AcademicPeriod.objects.all().order_by('school__name', '-start_date')
        elif user.school:
            # L'Admin d'école ne voit que les périodes de son école
            return AcademicPeriod.objects.filter(school=user.school).order_by('-start_date')
        return AcademicPeriod.objects.none() # Les autres utilisateurs ne voient rien

    # Surcharge de la création pour attribuer 'created_by'
    def perform_create(self, serializer):
    # On utilise self.request.user pour avoir l'utilisateur connecté
        serializer.save(
        school=self.request.user.school, 
        created_by=self.request.user
    )