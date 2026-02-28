
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from datetime import date, timedelta
from schools.models import School, AcademicPeriod
from rest_framework import serializers
from AcademicPeriod.models import AcademicPeriodType
from users.models import User
from users.serializers import SuperAdminUserSerializer
# Models
from schools.models import School
from users.models import User
from subscriptions.models import SchoolSubscription, SubscriptionPlan
from AcademicPeriod.models import AcademicPeriod
from subscriptions.models import SubscriptionPlan, SchoolSubscription   
from rest_framework_simplejwt.authentication import JWTAuthentication 

from .serializers import (
    SchoolSerializer, 
    SubscriptionPlanSerializer, 
    #SchoolOnboardingSerializer
)
    
from users.permissions_backend import IsSuperAdmin

class SuperAdminDashboardStatsAPIView(APIView):
    """
    Renvoie les statistiques pour le tableau de bord
    """
    #permission_classes = [IsAuthenticated]
    #authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        print(f"👤 User making request: {request.user}")
        print(f"👤 User type: {request.user.user_type}")
        print(f"👤 Is superadmin: {request.user.is_superadmin()}"
        )
        if not request.user.is_superadmin():
            return Response(
                {"error": "Accès interdit - SuperAdmin requis"},
                status=status.HTTP_403_FORBIDDEN
            )
        total_schools = School.objects.count()
        active_schools = School.objects.filter(status=School.Status.ACTIVE).count()
        total_users = User.objects.exclude(user_type=User.SUPERADMIN).count()
        active_plans = SubscriptionPlan.objects.filter(is_active=True).count()
        
        from datetime import date, timedelta
        expiry_threshold = date.today() + timedelta(days=30)
        expiring_count = SchoolSubscription.objects.filter(
            end_date__lte=expiry_threshold, 
            is_active=True
        ).count()

        data = {
            "total_schools": total_schools,
            "active_schools": active_schools,
            "total_users": total_users,
            "active_plans": active_plans,
            "expiring_subscriptions_count": expiring_count,
        }
        return Response(data, status=status.HTTP_200_OK)


# CRUD API ---

class SchoolListCreateAPIView(APIView):
    """
    GET: Liste toutes les écoles
    POST: Crée une école + admin + période académique + abonnement
    (Transaction atomique)
    """
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        schools = School.objects.all().order_by("-created_at")
        serializer = SchoolSerializer(schools, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = SchoolOnboardingSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        try:
            with transaction.atomic():
                admin = User.objects.create_user(
                    email=data["admin_email"],
                    password=data["admin_password"],
                    username=data["admin_email"],
                    first_name=data["admin_first_name"],
                    last_name=data["admin_last_name"],
                    user_type=User.SCHOOL_ADMIN
                )

              
                school = School.objects.create(
                    name=data["school_name"],
                    code=data["school_code"],
                    school_type=data["school_type"],
                    email=data.get("school_email"),
                    phone_number=data.get("school_phone"),
                    address=data.get("school_address"),
                    school_admin=admin,
                    created_by=request.user,
                    status=School.Status.ACTIVE
                )

                admin.school = school
                admin.save()

                academic_period = AcademicPeriod.objects.create(
                    school=school,
                    name=data["academic_name"],
                    type=data["academic_type"],
                    start_date=data["academic_start_date"],
                    end_date=data["academic_end_date"],
                    is_current=True,
                    created_by=request.user
                )

                school.academic_period = academic_period
                school.save()

                plan_id = data.get("plan_id")
                if plan_id:
                    plan = get_object_or_404(SubscriptionPlan, pk=plan_id)
                else:
                    plan = SubscriptionPlan.objects.filter(is_active=True).first()
                
                if not plan:
                    return Response(
                        {"error": "Aucun plan d'abonnement actif disponible"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                from datetime import date, timedelta
                start_date = date.today()
                
                if plan.duration_unit == 'MONTH':
                    end_date = start_date + timedelta(days=30 * plan.duration_value)
                elif plan.duration_unit == 'YEAR':
                    end_date = start_date + timedelta(days=365 * plan.duration_value)
                elif plan.duration_unit == 'QUARTER':
                    end_date = start_date + timedelta(days=90 * plan.duration_value)
                else:
                    end_date = start_date + timedelta(days=30)  

                SchoolSubscription.objects.create(
                    school=school,
                    plan=plan,
                    start_date=start_date,
                    end_date=end_date,
                    is_active=True,
                    status='ACTIVE'
                )

            return Response(
                {
                    "message": "École, période académique et abonnement créés avec succès",
                    "school_id": school.id
                },
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class SchoolDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Voir détails d'une école
    PUT/PATCH: Modifier une école
    DELETE: Désactiver (Soft Delete) une école
    """
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.status = School.Status.SUSPENDED
        instance.save()




class SubscriptionPlanListCreateAPIView(generics.ListCreateAPIView):
    """
    GET: Liste des plans
    POST: Créer un plan
    """
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]


class SubscriptionPlanDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Voir un plan
    PUT: Modifier un plan
    DELETE: Désactiver un plan
    """
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
        



class SuperAdminUserViewSet(ModelViewSet):
    queryset = User.objects.select_related("school").all()
    serializer_class = SuperAdminUserSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["user_type", "school"]
    search_fields = ["email", "first_name", "last_name", "username"]



class SchoolOnboardingSerializer(serializers.Serializer):
  
    school_name = serializers.CharField()
    school_code = serializers.CharField()
    school_type = serializers.ChoiceField(
        choices=School.SCHOOL_TYPE_CHOICES
    )
    school_email = serializers.EmailField(required=False, allow_blank=True)
    school_phone = serializers.CharField(required=False, allow_blank=True)
    school_address = serializers.CharField(required=False, allow_blank=True)

  
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(write_only=True)
    admin_first_name = serializers.CharField()
    admin_last_name = serializers.CharField()

    
    plan_id = serializers.IntegerField()

   
    academic_name = serializers.CharField()
    academic_type = serializers.ChoiceField(
        choices=AcademicPeriodType.choices
    )
    academic_start_date = serializers.DateField()
    academic_end_date = serializers.DateField()
