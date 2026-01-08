import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

# Imports via string pour éviter les conflits
from AcademicPeriod.models import AcademicPeriod

class FeeCategory(models.Model):
    """ Ex: Frais Scolaires, Bus, Cantine, Uniforme """
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, help_text="CODE unique (ex: SCO, BUS) pour reporting")
    
    def __str__(self):
        return f"{self.name} ({self.code})"

class SchoolFeeConfig(models.Model):
    """
    C'est ici que la direction définit la règle du jeu.
    Ex: Classe 6A, Année 2025-2026, 100$ par Trimestre.
    """
    FREQUENCY_CHOICES = [
        ('ANNUAL', 'Paiement Unique (Annuel)'),
        ('TRIMESTER', 'Par Trimestre (x3)'),
        ('MONTHLY', 'Mensuel (x10)'),
    ]

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)
    academic_period = models.ForeignKey(
        AcademicPeriod, 
        on_delete=models.CASCADE, 
        limit_choices_to={'type': 'YEAR'}, # On lie la config à l'ANNÉE GLOBALE
        verbose_name="Année Académique"
    )
    classe = models.ForeignKey("academia.Classe", on_delete=models.CASCADE, verbose_name="Classe concernée")
    category = models.ForeignKey(FeeCategory, on_delete=models.PROTECT)
    
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Montant unitaire (ex: 100$)")
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='ANNUAL')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('classe', 'category', 'academic_period')
        verbose_name = "Configuration des Frais"

    @property
    def total_yearly_amount(self):
        """ Calcule automatiquement le total annuel : 100$ * 3 trimestres = 300$ """
        if self.frequency == 'TRIMESTER':
            return self.amount * 3
        elif self.frequency == 'MONTHLY':
            return self.amount * 10
        return self.amount

    def __str__(self):
        return f"{self.category} - {self.classe} : {self.amount}$ ({self.get_frequency_display()})"


class StudentBalance(models.Model):
    """
    Cache du solde de l'élève pour éviter de recalculer tous les paiements à chaque fois.
    """
    student = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="finance_account") # Assure-toi de pointer vers le bon User ou Student Profile
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Compte de {self.student} : {self.balance}$"


class Payment(models.Model):
    PAYMENT_METHOD = [
        ('CASH', 'Espèces'),
        ('MOBILE_MONEY', 'Mobile Money'),
        ('BANK', 'Banque'),
    ]
    STATUS = [
        ('PENDING', 'En attente'),
        ('COMPLETED', 'Validé'),
        ('REJECTED', 'Rejeté'),
    ]

    uid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)
    
    # LIEN CRUCIAL AVEC L'ANNÉE SCOLAIRE
    academic_period = models.ForeignKey(
        AcademicPeriod, 
        on_delete=models.PROTECT,
        limit_choices_to={'type': 'YEAR'}, 
        verbose_name="Année Fiscale"
    )
    
    student = models.ForeignKey("users.User", on_delete=models.PROTECT, related_name="payments")
    category = models.ForeignKey(FeeCategory, on_delete=models.PROTECT, verbose_name="Motif")
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=PAYMENT_METHOD)
    status = models.CharField(max_length=20, choices=STATUS, default='PENDING')
    
    # Mobile Money info
    mobile_operator = models.CharField(max_length=50, blank=True, null=True, help_text="Orange, Airtel, Vodacom")
    transaction_ref = models.CharField(max_length=100, blank=True, null=True, verbose_name="ID Transaction Réseau")
    
    # Traçabilité
    date = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="recorded_payments")
    receipt_number = models.CharField(max_length=50, unique=True, blank=True, null=True)

    def clean(self):
        # Sécurité : Interdire le paiement sur une année clôturée (si tu ajoutes ce champ plus tard)
        # if self.academic_period.is_closed:
        #     raise ValidationError("Cette année académique est clôturée comptablement.")
        pass

    def save(self, *args, **kwargs):
        # Génération auto du reçu : RECU-[ANNEE]-[ID]
        if not self.receipt_number and self.status == 'COMPLETED':
            year_str = self.date.strftime('%Y')
            count = Payment.objects.filter(academic_period=self.academic_period).count() + 1
            self.receipt_number = f"PAY-{year_str}-{count:06d}"
        
        super().save(*args, **kwargs)
        # Mise à jour asynchrone du solde étudiant recommandée ici

class Expense(models.Model):
    """ Gestion des dépenses liées à l'année scolaire """
    STATUS = [('PENDING', 'En attente'), ('APPROVED', 'Approuvé'), ('PAID', 'Payé'), ('REJECTED', 'Rejeté')]

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)
    academic_period = models.ForeignKey(AcademicPeriod, on_delete=models.PROTECT, verbose_name="Année Fiscale")
    
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    proof_file = models.FileField(upload_to="expenses/", null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS, default='PENDING')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="expenses_created")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses_approved")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Dépense"

# ==========================================
# JOURNAL D'AUDIT (INDISPENSABLE POUR COMPTA)
# ==========================================
class AuditLog(models.Model):
    action_time = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE)
    action = models.CharField(max_length=50) # "PAYMENT_VALIDATED", "EXPENSE_REJECTED"
    details = models.JSONField() # Snapshot des données avant/après