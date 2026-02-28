from rest_framework.viewsets import ModelViewSet
from pupils.models import Student
from pupils.api.serializers.student_serializer import StudentSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend 
from rest_framework import filters
from django.db.models import Q, Sum 

class StudentViewSet(ModelViewSet):
    queryset = Student.objects.select_related(
        "school", "current_classe", "academic_period"
    ).all()
    serializer_class = StudentSerializer
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'current_classe']
    search_fields = ['first_name', 'last_name', 'student_id_code']
    
    def get_queryset(self):
        return Student.objects.filter(school=self.request.user.school).annotate(
            computed_balance=Sum('transaction__amount_in_base_currency', 
                filter=Q(transaction__status='APPROVED', transaction__transaction_type='INCOME'))
        )
    
    def get_queryset(self):
        user = self.request.user
        
        if user.is_superuser:
            return Student.objects.all()
        
        if hasattr(user, 'school') and user.school:
            return Student.objects.filter(school=user.school).select_related(
                "current_classe", "academic_period"
            )
        
        return Student.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        
        if user.is_authenticated and hasattr(user, 'school'):
            serializer.save(school=user.school)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous devez être rattaché à une école pour créer un élève.")