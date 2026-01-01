from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from users.models import User
from users.serializers import CustomUserSerializer
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.conf import settings
from users.permissions_backend import IsSuperAdmin
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from users.models import User
from users.serializers import SuperAdminUserSerializer, UserSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
#from .serializers import CustomTokenObtainPairSerializer
from schools.models import SchoolMembership, SchoolRoleAssignment
from users.models import UserInvitation
from users.serializers import AcceptInvitationSerializer
from django.utils import timezone
from django.shortcuts import get_object_or_404  
# users/api/views.py
from rest_framework_simplejwt.tokens import RefreshToken  # ← Ajouter
from users.serializers import SchoolUserCreateSerializer   
from django.db import transaction
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from users.models import UserInvitation, CustomRole
from users.serializers import SchoolUserCreateSerializer
from users.services.user_onboarding import invite_or_create_user
from users.emails import send_invitation_email
from schools.models import School
from rest_framework.decorators import api_view, permission_classes
from users.permissions_backend import IsSchoolAdminOrSuperAdmin
from users.serializers import UserListSerializer


@method_decorator(csrf_exempt, name='dispatch')
class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(
            request,
            username=email,
            password=password
        )

        if not user:
            return Response(
                {"error": "Identifiants incorrects"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)
        
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),  # ← Token JWT
            "user": {
                "id": user.id,
                "email": user.email,
                "user_type": user.user_type,
                "is_superadmin": user.is_superadmin(),
            }
        })
        
class PasswordResetRequestAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response(
                {"error": "Email requis"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(email=email).first()

        if not user:
            # 🔐 sécurité : ne pas révéler si email existe
            return Response(
                {"message": "Si cet email existe, un lien sera envoyé"},
                status=status.HTTP_200_OK
            )

        token = PasswordResetTokenGenerator().make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        reset_link = f"http://localhost:8000/static/src/html/reset-password.html?uid={uid}&token={token}"

        send_mail(
            subject="Réinitialisation de mot de passe - SYBEM",
            message=f"Cliquez sur ce lien pour réinitialiser votre mot de passe :\n{reset_link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {"message": "Email envoyé"},
            status=status.HTTP_200_OK
        )




class SuperAdminUserViewSet(ModelViewSet):
    queryset = User.objects.select_related("school").all()
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    def get_serializer_class(self):
        # 🔥 POST / PUT / PATCH
        if self.action in ["create", "update", "partial_update"]:
            return UserSerializer

        # 🔍 GET (list / retrieve)
        return SuperAdminUserSerializer
    

class SchoolUsersAPIView(APIView):
    permission_classes = [IsSchoolAdminOrSuperAdmin]

    def post(self, request):
        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        school = request.user.schoolmembership.school

        roles = CustomRole.objects.filter(
            id__in=data["roles"],
            school=school
        )

        result = invite_or_create_user(
            school=school,
            mode=data["mode"],
            data=data,
            roles=roles,
            invited_by=request.user
        )

        if result["type"] == "invitation":
            send_invitation_email(result["invitation"])
            return Response(
                {"message": "Invitation envoyée"},
                status=status.HTTP_201_CREATED
            )

        return Response(
            {
                "message": "Utilisateur créé",
                "user_id": result["user"].id
            },
            status=status.HTTP_201_CREATED
        )

        
class SchoolUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not user.is_superadmin() and user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Accès refusé"}, status=403)

        users = User.objects.filter(school=user.school).order_by("-date_joined")
        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user

        if user.user_type != User.SCHOOL_ADMIN:
            return Response({"detail": "Seul l'admin école peut créer des utilisateurs"}, status=403)

        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        mode = data["mode"]

        if mode == "create":
            return self._create_user(data, user)

        elif mode == "invite":
            return self._invite_user(data, user)

        return Response({"detail": "Mode invalide"}, status=400)

    def _create_user(self, data, admin_user):
        roles = CustomRole.objects.filter(
            id__in=data["roles"],
            school=admin_user.school
        )

        if not roles.exists():
            return Response({"detail": "Rôles invalides"}, status=400)

        user = User.objects.create_user(
            email=data["email"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            username=data.get("post_name", ""),
            school=admin_user.school,
            user_type=User.SCHOOL_USER,
            is_active=True
        )

        user.custom_role.set(roles)
        user.set_unusable_password()
        user.save()

        return Response(
            {"message": "Utilisateur créé avec succès"},
            status=status.HTTP_201_CREATED
        )

    def _invite_user(self, data, admin_user):
        # ici tu ajouteras la logique token + email
        return Response(
            {"message": "Invitation envoyée"},
            status=status.HTTP_201_CREATED
        )

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def validate(self, attrs):
        data = super().validate(attrs)

        data['user'] = {
            "id": self.user.id,
            "email": self.user.email,
            "user_type": self.user.user_type,
            "is_superadmin": self.user.is_superadmin(),
        }
        return data



class AcceptInvitationView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invitation = get_object_or_404(
            UserInvitation,
            token=serializer.validated_data["token"]
        )

        if invitation.is_expired():
            return Response(
                {"detail": "Invitation expirée"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            email=invitation.email,
            last_name=serializer.validated_data["last_name"],
            post_name=serializer.validated_data.get("post_name"),
            first_name=serializer.validated_data["first_name"],
            password=serializer.validated_data["password"]
        )

        membership = SchoolMembership.objects.create(
            user=user,
            school=invitation.school
        )

        for role in invitation.roles.all():
            SchoolRoleAssignment.objects.create(
                membership=membership,
                role=role
            )

        invitation.accepted_at = timezone.now()
        invitation.save()

        return Response(
            {"detail": "Compte créé avec succès"},
            status=status.HTTP_201_CREATED
        )
        
class InviteUserAPIView(APIView):
    permission_classes = [IsSchoolAdminOrSuperAdmin]  # Optionnel : ajouter permission admin école

    def post(self, request, id):
        serializer = SchoolUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        school = get_object_or_404(School, id=id)
        roles = CustomRole.objects.filter(id__in=serializer.validated_data["roles"])

        result = invite_or_create_user(
            school=school,
            mode=serializer.validated_data["mode"],
            data=serializer.validated_data,
            roles=roles,
            invited_by=request.user
        )

        if result["type"] == "invitation":
            send_invitation_email(result["invitation"])
            return Response({"message": "Invitation envoyée"}, status=status.HTTP_201_CREATED)

        # Création directe
        return Response({"message": "Utilisateur créé", "user_id": result["user"].id}, status=status.HTTP_201_CREATED)
    
class AcceptInvitationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        invitation = get_object_or_404(UserInvitation, token=token, accepted_at__isnull=True)

        if invitation.is_expired():
            return Response({"error": "Invitation expirée"}, status=status.HTTP_400_BAD_REQUEST)

        user_data = {
            "email": invitation.email,
            "first_name": serializer.validated_data["first_name"],
            "post_name": serializer.validated_data.get("post_name", ""),
            "last_name": serializer.validated_data["last_name"],
            "user_type": "school_user",  # tu peux adapter selon tes règles
            "password": serializer.validated_data["password"]
        }

        result = invite_or_create_user(
            school=invitation.school,
            mode="create",
            data=user_data,
            roles=invitation.roles.all(),
            invited_by=invitation.invited_by
        )

        invitation.accepted_at = timezone.now()
        invitation.save()

        return Response({"message": "Invitation acceptée", "user_id": result["user"].id}, status=status.HTTP_201_CREATED)



# users/api/views.py
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_school_roles(request):
    roles = CustomRole.objects.filter(school=request.user.schoolmembership.school)
    return Response([
        {"id": r.id, "name": r.name}
        for r in roles
    ])
