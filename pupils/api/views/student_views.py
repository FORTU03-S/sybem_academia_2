from rest_framework.viewsets import ModelViewSet
from pupils.models import Student
from pupils.api.serializers.student_serializer import StudentSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import AllowAny

class StudentViewSet(ModelViewSet):
    # Utilise une seule définition propre
    queryset = Student.objects.select_related(
        "school", "current_classe", "academic_period"
    ).all()
    serializer_class = StudentSerializer
    
    # Ordre explicite
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # 1. Le Superadmin voit tout (pour la maintenance)
        if user.is_superuser:
            return Student.objects.all()
        
        # 2. L'admin d'école ne voit que SA propre école
        if hasattr(user, 'school') and user.school:
            return Student.objects.filter(school=user.school).select_related(
                "current_classe", "academic_period"
            )
        
        # 3. Si l'utilisateur n'a pas d'école rattachée, il ne voit rien (sécurité)
        return Student.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        
        # Vérification de sécurité supplémentaire
        if user.is_authenticated and hasattr(user, 'school'):
            serializer.save(school=user.school)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous devez être rattaché à une école pour créer un élève.")