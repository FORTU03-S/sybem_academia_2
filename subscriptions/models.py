# subscriptions/models.py

from django.db import models
from django.conf import settings
from schools.models import School
from django.utils import timezone
from django.core.validators import MinValueValidator
import uuid

# MODÈLE : Module du système
class SystemModule(models.Model):
    MODULE_TYPES = [
        ('ACADEMIC', 'Académique'),
        ('FINANCE', 'Finance/Comptabilité'),
        ('HR', 'Ressources Humaines'),
        ('COMMUNICATION', 'Communication'),
        ('ADMIN', 'Administration'),
    ]
    
    code = models.CharField(max_length=50, unique=True, verbose_name="Code du module")
    name = models.CharField(max_length=100, verbose_name="Nom du module")
    description = models.TextField(blank=True)
    module_type = models.CharField(max_length=20, choices=MODULE_TYPES, default='ACADEMIC')
    is_active = models.BooleanField(default=True, verbose_name="Actif dans le système")
    icon = models.CharField(max_length=100, blank=True, help_text="Nom de l'icône Lucide")
    order = models.IntegerField(default=0, verbose_name="Ordre d'affichage")
    
    def __str__(self):
        return f"{self.name} ({self.code})"
    
    class Meta:
        verbose_name = "Module Système"
        verbose_name_plural = "Modules Système"
        ordering = ['order', 'name']

# MODÈLE : Plan d'Abonnement
class SubscriptionPlan(models.Model):
    DURATION_UNITS = [
        ('MONTH', 'Mois'),
        ('YEAR', 'An'),
        ('QUARTER', 'Trimestre'),
    ]
    
    name = models.CharField(max_length=100, unique=True, verbose_name="Nom du Plan")
    description = models.TextField(blank=True)
    code = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Code du plan", default='PLAN-001')
    
    # Tarification
    price_per_unit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        verbose_name="Prix par unité",
        default=0.00,
    )
    duration_unit = models.CharField(
        max_length=10, 
        choices=DURATION_UNITS, 
        default='MONTH'
    )
    duration_value = models.IntegerField(
        default=1, 
        verbose_name="Durée (nombre d'unités)"
    )
    
    # Quotas
    max_users = models.PositiveIntegerField(
        default=50, 
        verbose_name="Quota max. Utilisateurs"
    )
    max_students = models.PositiveIntegerField(
        default=200, 
        verbose_name="Quota max. Étudiants"
    )
    max_storage_gb = models.PositiveIntegerField(
        default=10, 
        verbose_name="Stockage (GB)"
    )
    
    # Caractéristiques
    is_active = models.BooleanField(default=True, verbose_name="Plan Actif")
    is_public = models.BooleanField(default=True, verbose_name="Visible publiquement")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Modules inclus dans ce plan
    included_modules = models.ManyToManyField(
        SystemModule,
        through='PlanModule',
        related_name='included_in_plans'
    )
    
    def __str__(self):
        return f"{self.name} - {self.price_per_unit} USD/{self.duration_unit}"
    
    def get_full_price(self):
        """Prix total pour la durée du plan"""
        return self.price_per_unit * self.duration_value
    
    def get_duration_display(self):
        """Affiche la durée en texte"""
        if self.duration_unit == 'MONTH':
            return f"{self.duration_value} mois"
        elif self.duration_unit == 'YEAR':
            return f"{self.duration_value} an(s)"
        elif self.duration_unit == 'QUARTER':
            return f"{self.duration_value} trimestre(s)"
        return f"{self.duration_value} {self.duration_unit}"
    
    class Meta:
        verbose_name = "Plan d'Abonnement"
        verbose_name_plural = "Plans d'Abonnement"

# MODÈLE : Lien entre Plan et Module avec niveau d'accès
class PlanModule(models.Model):
    ACCESS_LEVELS = [
        ('BASIC', 'Accès de base'),
        ('STANDARD', 'Accès standard'),
        ('PREMIUM', 'Accès premium'),
        ('FULL', 'Accès complet'),
    ]
    
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE)
    module = models.ForeignKey(SystemModule, on_delete=models.CASCADE)
    access_level = models.CharField(max_length=20, choices=ACCESS_LEVELS, default='STANDARD')
    is_included = models.BooleanField(default=True, verbose_name="Inclus dans le plan")
    features = models.JSONField(default=dict, blank=True, help_text="Fonctionnalités spécifiques")
    order = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['plan', 'module']
        verbose_name = "Module de Plan"
        verbose_name_plural = "Modules de Plan"
        ordering = ['order']
    
    def __str__(self):
        return f"{self.plan.name} - {self.module.name} ({self.access_level})"

# MODÈLE : Abonnement de l'École
class SchoolSubscription(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Actif'),
        ('PENDING', 'En attente'),
        ('SUSPENDED', 'Suspendu'),
        ('EXPIRED', 'Expiré'),
        ('CANCELLED', 'Annulé'),
    ]
    
    # Références
    school = models.OneToOneField(
        School, 
        on_delete=models.CASCADE, 
        related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan, 
        on_delete=models.PROTECT, 
        related_name='school_subscriptions'
    )
    
    # Période d'abonnement
    start_date = models.DateField(verbose_name="Date de Début")
    end_date = models.DateField(verbose_name="Date de Fin")
    auto_renew = models.BooleanField(default=True, verbose_name="Renouvellement automatique")
    
    # Statut et suivi
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='PENDING'
    )
    is_active = models.BooleanField(default=False, verbose_name="Actif")
    
    # Modules activés pour cette école
    activated_modules = models.ManyToManyField(
        SystemModule,
        through='SchoolModuleAccess',
        related_name='active_in_schools'
    )
    
    # Suivi des limites d'utilisation
    current_users = models.PositiveIntegerField(default=0, verbose_name="Utilisateurs actuels")
    current_students = models.PositiveIntegerField(default=0, verbose_name="Étudiants actuels")
    storage_used_gb = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0.0,
        verbose_name="Stockage utilisé (GB)"
    )
    
    # Notifications
    is_notified_expiry = models.BooleanField(default=False)
    last_notification_date = models.DateField(null=True, blank=True)
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reference = models.CharField(
        max_length=50, 
        unique=True, 
        default=uuid.uuid4,
        verbose_name="Référence"
    )
    
    def __str__(self):
        return f"{self.school.name} - {self.plan.name} ({self.status})"
    
    def is_expired(self):
        return timezone.now().date() > self.end_date
    
    def days_remaining(self):
        if self.end_date:
            remaining = self.end_date - timezone.now().date()
            return max(0, remaining.days)
        return 0
    
    def can_add_user(self):
        """Vérifie si l'école peut ajouter un nouvel utilisateur"""
        return self.current_users < self.plan.max_users
    
    def can_add_student(self):
        """Vérifie si l'école peut ajouter un nouvel étudiant"""
        return self.current_students < self.plan.max_students
    
    def get_available_modules(self):
        """Retourne les modules disponibles pour cette école"""
        if self.is_active and self.status == 'ACTIVE':
            return self.activated_modules.all()
        return SystemModule.objects.none()
    
    def has_module_access(self, module_code):
        """Vérifie si l'école a accès à un module spécifique"""
        return self.activated_modules.filter(code=module_code).exists()
    
    class Meta:
        verbose_name = "Abonnement d'École"
        verbose_name_plural = "Abonnements d'Écoles"

# MODÈLE : Accès d'une école à un module
class SchoolModuleAccess(models.Model):
    school_subscription = models.ForeignKey(SchoolSubscription, on_delete=models.CASCADE)
    module = models.ForeignKey(SystemModule, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True, verbose_name="Actif")
    activated_date = models.DateField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0, verbose_name="Nombre d'utilisations")
    
    class Meta:
        unique_together = ['school_subscription', 'module']
        verbose_name = "Accès Module École"
        verbose_name_plural = "Accès Modules Écoles"
    
    def __str__(self):
        return f"{self.school_subscription.school.name} - {self.module.name}"

# MODÈLE : Paiement
class Payment(models.Model):
    PAYMENT_METHODS = [
        ('MTN_MONEY', 'MTN Money'),
        ('AIRTM', 'Airtel Money'),
        ('ORANGE', 'Orange Money'),
        ('VISA', 'Carte Visa/Mastercard'),
        ('BANK', 'Virement Bancaire'),
        ('CASH', 'Espèces'),
    ]
    
    PAYMENT_STATUS = [
        ('PENDING', 'En attente'),
        ('COMPLETED', 'Complété'),
        ('FAILED', 'Échoué'),
        ('REFUNDED', 'Remboursé'),
        ('CANCELLED', 'Annulé'),
    ]
    
    school_subscription = models.ForeignKey(
        SchoolSubscription, 
        on_delete=models.CASCADE,
        related_name='payments'
    )
    
    # Informations de paiement
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Montant")
    currency = models.CharField(max_length=3, default='USD', verbose_name="Devise")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    transaction_id = models.CharField(max_length=100, unique=True, verbose_name="ID Transaction")
    
    # Statut
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='PENDING')
    payment_date = models.DateTimeField(null=True, blank=True, verbose_name="Date de paiement")
    confirmed_date = models.DateTimeField(null=True, blank=True, verbose_name="Date de confirmation")
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True, verbose_name="Notes")
    
    def __str__(self):
        return f"{self.school_subscription.school.name} - {self.amount} {self.currency}"
    
    def is_successful(self):
        return self.status == 'COMPLETED'
    
    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ['-payment_date']

# MODÈLE : Facture
class Invoice(models.Model):
    INVOICE_STATUS = [
        ('DRAFT', 'Brouillon'),
        ('SENT', 'Envoyée'),
        ('PAID', 'Payée'),
        ('OVERDUE', 'En retard'),
        ('CANCELLED', 'Annulée'),
    ]
    
    school_subscription = models.ForeignKey(
        SchoolSubscription,
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    
    # Informations de facturation
    invoice_number = models.CharField(max_length=50, unique=True, verbose_name="Numéro de facture")
    issue_date = models.DateField(verbose_name="Date d'émission")
    due_date = models.DateField(verbose_name="Date d'échéance")
    
    # Montants
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Sous-total")
    tax_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0.00,
        verbose_name="Montant TVA"
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Total")
    
    # Statut
    status = models.CharField(max_length=20, choices=INVOICE_STATUS, default='DRAFT')
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    pdf_file = models.FileField(
        upload_to='invoices/%Y/%m/', 
        null=True, 
        blank=True,
        verbose_name="Fichier PDF"
    )
    
    def __str__(self):
        return f"Facture {self.invoice_number} - {self.school_subscription.school.name}"
    
    def is_overdue(self):
        if self.status != 'PAID' and self.due_date < timezone.now().date():
            return True
        return False
    
    def mark_as_paid(self):
        self.status = 'PAID'
        self.save()
    
    class Meta:
        verbose_name = "Facture"
        verbose_name_plural = "Factures"
        ordering = ['-issue_date']