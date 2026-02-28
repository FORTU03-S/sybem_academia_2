
from django.contrib.auth.models import AbstractUser, Permission
from django.db import models
from django.utils.translation import gettext_lazy as _
from schools.models import School
from django.utils import timezone
from django.conf import settings
import uuid


class CustomRole(models.Model):
    """Rôle personnalisé avec permissions spécifiques"""
    name = models.CharField(max_length=100, unique=True, verbose_name="Nom du rôle")
    description = models.TextField(blank=True, verbose_name="Description")
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        verbose_name="Permissions",
        related_name="custom_roles"
    )
    school = models.ForeignKey(
        School, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='custom_roles'
    )
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Rôle Personnalisé"
        verbose_name_plural = "Rôles Personnalisés"
        ordering = ['name']


class User(AbstractUser):
  
    email = models.EmailField(_('email address'), unique=True, blank=False)
    
    USERNAME_FIELD = 'email'
    
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name'] 
    
    profile_picture = models.ImageField(
        upload_to="profiles/",
        blank=True,
        null=True
    )    
    SUPERADMIN = 'superadmin'
    SCHOOL_ADMIN = 'school_admin'
    SCHOOL_USER = 'school_user'
    STAFF = 'staff'
    TEACHER = 'teacher'
    PARENT = 'parent'
    STUDENT = 'student'

    USER_TYPE_CHOICES = [
        (SUPERADMIN, 'Super Admin'),
        (SCHOOL_ADMIN, 'Admin École'),
        (SCHOOL_USER, 'Utilisateur École'),
        (STAFF, 'Personnel'),
        (TEACHER, 'Enseignant'),
        (PARENT, 'Parent'),
        (STUDENT, 'Élève'),
    ]
    
    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_SUSPENDED = "suspended"

    STATUS_CHOICES = [
        (STATUS_PENDING, "En attente"),
        (STATUS_ACTIVE, "Actif"),
        (STATUS_SUSPENDED, "Suspendu"),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )

    approved_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_users"
    )

    approved_at = models.DateTimeField(null=True, blank=True)

    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    
    school = models.ForeignKey(
        School, 
        null=True, 
        blank=True, 
        on_delete=models.SET_NULL,
        related_name='users'
    )
    
    must_change_password = models.BooleanField(
        default=False,
        help_text="Forcer le changement de mot de passe au premier login"
    )

    phone_number = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    date_of_birth = models.DateField(null=True, blank=True, verbose_name="Date de naissance")
    profile_picture = models.ImageField(
        upload_to='profile_pictures/', 
        null=True, 
        blank=True,
        verbose_name="Photo de profil"
    )
    is_email_verified = models.BooleanField(default=False, verbose_name="Email vérifié")
    email_verified_at = models.DateTimeField(null=True, blank=True)
    
    def is_superadmin(self):
        return self.is_superuser or self.user_type == self.SUPERADMIN

    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
    
    def __str__(self):
        return f"{self.email} ({self.user_type})"
    
    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ['email']

class UserCustomRole(models.Model):
    """Table de liaison entre User et CustomRole (plusieurs rôles par utilisateur)"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='custom_roles'
    )
    role = models.ForeignKey(
        CustomRole,
        on_delete=models.CASCADE,
        related_name='user_assignments'
    )
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_roles'
    )

    class Meta:
        unique_together = ('user', 'role')
        verbose_name = "Attribution de Rôle"
        verbose_name_plural = "Attributions de Rôles"

    def __str__(self):
        return f"{self.user.email} → {self.role.name}"
    
class PermissionFeature(models.Model):
    """
    Permission métier affichable dans l'UI
    ex: view_students, manage_finance, approve_expense
    """
    code = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=150)
    module = models.CharField(max_length=100)

    description = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.module} | {self.label}"

from django.contrib.auth.models import Permission, Group

class PermissionCategory(models.Model):
    """Catégorie pour regrouper les permissions (ex: 'Académique', 'Finance', 'RH')"""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)
    order = models.IntegerField(default=0)
    
    class Meta:
        verbose_name = "Catégorie de Permissions"
        verbose_name_plural = "Catégories de Permissions"
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name

class CustomPermission(models.Model):
    """Permission personnalisée avec plus de métadonnées"""
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(PermissionCategory, on_delete=models.CASCADE, related_name='permissions')
    requires_approval = models.BooleanField(default=False)
    is_dangerous = models.BooleanField(default=False)
    default_groups = models.ManyToManyField(Group, blank=True)
    
    
    django_permission = models.ForeignKey(
        Permission, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    class Meta:
        verbose_name = "Permission Personnalisée"
        verbose_name_plural = "Permissions Personnalisées"
        ordering = ['category__order', 'name']
    
    def __str__(self):
        return f"{self.category.code}.{self.code}"

class RolePermission(models.Model):
    """Lien entre CustomRole et CustomPermission avec niveau d'accès"""
    role = models.ForeignKey('CustomRole', on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(CustomPermission, on_delete=models.CASCADE)
    
    ACCESS_LEVELS = [
        ('VIEW', 'Voir seulement'),
        ('CREATE', 'Créer'),
        ('UPDATE', 'Modifier'),
        ('DELETE', 'Supprimer'),
        ('APPROVE', 'Approuver'),
        ('MANAGE', 'Gérer complètement'),
        ('FULL', 'Accès complet'),
    ]
    access_level = models.CharField(max_length=20, choices=ACCESS_LEVELS, default='VIEW')
    
    
    scope = models.JSONField(default=dict, blank=True)  
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['role', 'permission']
        verbose_name = "Permission de Rôle"
        verbose_name_plural = "Permissions de Rôle"
    
    def __str__(self):
        return f"{self.role.name} - {self.permission.name} ({self.access_level})"
    
class UserInvitation(models.Model):
    email = models.EmailField()
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)

    invited_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True
    )

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    roles = models.ManyToManyField("users.CustomRole", blank=True)
    user_type = models.CharField(
        max_length=20, 
        choices=User.USER_TYPE_CHOICES, 
        default=User.TEACHER 
    )

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        return timezone.now() > self.expires_at
    
