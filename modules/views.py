# modules/views.py

from rest_framework import viewsets, permissions
from .models import Module
from .serializers import ModuleSerializer
from .models import SchoolModule
from .serializers import SchoolModuleSerializer

class ModuleViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows Modules to be viewed or edited.
    """
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    # Note: Nous n'avons pas besoin de filtrage par école ici car les Modules sont globaux.
    # L'authentification par jeton est suffisante pour le Superadmin.
    
class SchoolModuleViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows SchoolModule links (activation of a module for a school) to be viewed or edited.
    """
    queryset = SchoolModule.objects.all()
    serializer_class = SchoolModuleSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    # NOTE: Pour le Superadmin, nous listons tous les liens.