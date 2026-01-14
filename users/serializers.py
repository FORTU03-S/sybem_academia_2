# users/serializers.py
from rest_framework import serializers
from .models import User, CustomRole # Votre modèle d'utilisateur personnalisé
from django.contrib.auth.models import Permission


class CustomRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomRole
        fields = [
            "id",
            "name",
            "description",
        ]

class CustomUserSerializer(serializers.ModelSerializer):
    user_role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'user_role', 'school')
        read_only_fields = ('email',)

    def get_user_role(self, obj):
        """Détermine le rôle réel pour la redirection frontend."""
        if obj.is_superadmin():
            return 'superadmin'
        
        # 🔥 NE PAS FORCER 'school_user'. Retourner le vrai type stocké en BDD
        # Si obj.user_type est 'teacher', auth.js saura où aller.
        return obj.user_type
    
class UserSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(
        choices=User.USER_TYPE_CHOICES,
        write_only=True
    )

    user_type = serializers.CharField(required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "role",        # frontend
            "user_type",   # backend (silencieux)
            "school",
            "password",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "password": {"write_only": True},
            "email": {"required": True},
        }

    def create(self, validated_data):
        role = validated_data.pop("role")
        password = validated_data.pop("password")

        user = User(
            user_type=role,   # 🔥 mapping FINAL
            **validated_data
        )
        user.set_password(password)
        user.save()
        return user

 

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename']
        
class CustomRoleSerializer(serializers.ModelSerializer):
    # Ceci est la vue en sortie (Lecture seule)
    permissions = PermissionSerializer(many=True, read_only=True) 
    
    # 🛑 AJOUTEZ CE CHAMP POUR GÉRER L'ENTRÉE DES PERMISSIONS (ÉCRITURE)
    # C'est un champ virtuel utilisé uniquement pour l'écriture.
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        many=True,
        source='permissions', # Mappe le champ 'permission_ids' de l'input vers le champ 'permissions' du modèle
        write_only=True      # N'est utilisé que pour l'écriture (PATCH/POST)
    )

    class Meta:
        model = CustomRole
        # Gardez 'permissions' pour l'affichage, ajoutez 'permission_ids' pour l'écriture
        fields = ['id', 'school', 'name', 'description', 'permissions', 'permission_ids'] 
        read_only_fields = ['id', 'school']
        
class SuperAdminUserSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source="school.name", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "user_type",
            "school",
            "school_name",
            "is_active",
        ]
 
    def get_full_name(self, obj):
        """
        Convention africaine :
        NOM (last_name) + POST-NOM (username ou champ dédié) + PRÉNOM (first_name)
        """
        parts = []

        if obj.last_name:
            parts.append(obj.last_name.upper())   # NOM en majuscules
        if obj.username:
            parts.append(obj.username)             # POST-NOM
        if obj.first_name:
            parts.append(obj.first_name)           # PRÉNOM

        return " ".join(parts)

# users/serializers.py

class SchoolUserCreateSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["create", "invite"])
    email = serializers.EmailField()
    last_name = serializers.CharField(required=False)
    # Remplacer post_name par middle_name si c'est ce que ton modèle utilise
    post_name = serializers.CharField(required=False, allow_blank=True) 
    first_name = serializers.CharField(required=False)
    
    # 🔥 AJOUTER CE CHAMP :
    user_type = serializers.ChoiceField(
        choices=User.USER_TYPE_CHOICES, 
        default=User.SCHOOL_USER
    )

    roles = serializers.ListField(child=serializers.IntegerField())
    profile_picture = serializers.ImageField(required=False)



class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    last_name = serializers.CharField()
    post_name = serializers.CharField(required=False)
    first_name = serializers.CharField()
    password = serializers.CharField(write_only=True)



# users/serializers.py
from rest_framework import serializers
from users.models import User, UserCustomRole

class UserListSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "status",
            "roles",
            "date_joined",
        ]

    def get_roles(self, obj):
        return [
            uc.role.name
            for uc in UserCustomRole.objects.select_related("role")
            .filter(user=obj)
        ]
