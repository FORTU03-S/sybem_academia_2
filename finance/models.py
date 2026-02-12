from django.db import models
from django.conf import settings
from django.utils import timezone

from academia.models import Classe, AcademicPeriod
from pupils.models import Student
from django.utils.translation import gettext_lazy as _

import uuid


# =====================================================
# CONFIGURATION FINANCIÈRE GLOBALE
# =====================================================

class FinanceConfig(models.Model):
    """
    Configuration financière globale par école
    (devise principale, taux de change, seuil validation dépenses)
    """
    school = models.OneToOneField(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="finance_config"
    )

    main_currency = models.CharField(
        max_length=3,
        choices=[("USD", "USD"), ("CDF", "CDF")],
        default="USD"
    )

    exchange_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=2800,
        help_text="1 USD = ? CDF"
    )

    expense_approval_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=50.00,
        help_text="Montant max sans validation de la direction"
    )

    class Meta:
        verbose_name = "Configuration Financière"
        verbose_name_plural = "Configurations Financières"

    def __str__(self):
        return f"FinanceConfig • {self.school.name}"


# =====================================================
# TYPES DE FRAIS
# =====================================================

class FeeType(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('En attente')
        APPROVED = 'APPROVED', _('Approuvé')
        REJECTED = 'REJECTED', _('Rejeté')

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="fee_types")
    name = models.CharField(max_length=100)
    
    # Nouveaux champs pour le circuit de validation
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.PENDING
    )
    created_by = models.ForeignKey(
        "users.User", 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name="proposed_fee_types"
    )

    class Meta:
        unique_together = ("school", "name")
        verbose_name = "Type de Frais"
        verbose_name_plural = "Types de Frais"

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


# =====================================================
# STRUCTURE DES FRAIS PAR CLASSE
# =====================================================

class FeeStructure(models.Model):
    """
    Décrit combien une classe doit payer pour un type de frais donné
    """

    PAYMENT_FREQUENCY = [
        ("ONE_TIME", "Paiement Unique (Annuel)"),
        ("TRIMESTER", "Par Trimestre"),
        ("MONTHLY", "Mensuel"),
        ("OCCASIONAL", "Ponctuel"),
    ]

    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="fee_structures"
    )

    classe = models.ForeignKey(
        Classe,
        on_delete=models.CASCADE,
        related_name="fee_structures"
    )

    fee_type = models.ForeignKey(
        FeeType,
        on_delete=models.CASCADE,
        related_name="structures"
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Montant en devise principale"
    )

    frequency = models.CharField(
        max_length=20,
        choices=PAYMENT_FREQUENCY,
        default="TRIMESTER"
    )

    academic_period = models.ForeignKey(
        AcademicPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Optionnel : période spécifique"
    )

    due_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Structure de Frais"
        verbose_name_plural = "Structures de Frais"

    def __str__(self):
        return f"{self.fee_type.name} • {self.classe.name} • {self.amount}"


# =====================================================
# EXONÉRATIONS / RÉDUCTIONS
# =====================================================

class StudentExemption(models.Model):
    """
    Exonération ou réduction pour un élève (boursier, enfant du personnel)
    """
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="exemptions"
    )

    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name="exemptions"
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    reason = models.TextField()

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_exemptions"
    )

    class Meta:
        verbose_name = "Exonération Élève"
        verbose_name_plural = "Exonérations Élèves"

    def __str__(self):
        return f"Exonération • {self.student}"


# =====================================================
# TRANSACTIONS FINANCIÈRES
# =====================================================

class Transaction(models.Model):
    """
    Entrées et sorties financières avec workflow
    """

    TYPE_CHOICES = [
        ("INCOME", "Entrée (Paiement élève)"),
        ("EXPENSE", "Dépense"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "En attente"),
        ("AUDITED", "Audité"),
        ("APPROVED", "Validé"),
        ("REJECTED", "Rejeté"),
    ]

    PAYMENT_METHODS = [
        ("CASH", "Espèces"),
        ("BANK", "Virement Bancaire"),
        ("MOBILE", "Mobile Money"),
    ]

    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="transactions"
    )

    transaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES)

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        default="CASH"
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    currency = models.CharField(
        max_length=3,
        choices=[("USD", "USD"), ("CDF", "CDF")]
    )

    exchange_rate_used = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    amount_in_base_currency = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        editable=False
    )

    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions"
    )

    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions"
    )

    description = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="transactions_created"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    audited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions_audited"
    )

    audited_at = models.DateTimeField(null=True, blank=True)

    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions_validated"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True
    )

    receipt_file = models.FileField(
        upload_to="receipts/%Y/%m/",
        null=True,
        blank=True
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Transaction"
        verbose_name_plural = "Transactions"

    def save(self, *args, **kwargs):
        if self.transaction_type == "INCOME" and not self.receipt_number:
            self.receipt_number = f"REC-{uuid.uuid4().hex[:8].upper()}"

        if not self.amount_in_base_currency:
            if self.currency == "USD":
                self.amount_in_base_currency = self.amount
            else:
                self.amount_in_base_currency = (
                    self.amount / self.exchange_rate_used
                    if self.exchange_rate_used > 0 else 0
                )

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.transaction_type} • {self.amount} {self.currency}"


# =====================================================
# DEMANDE DE CORRECTION
# =====================================================

class CorrectionRequest(models.Model):
    """
    Demande de correction d'une transaction
    """

    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name="correction_requests"
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="correction_requests_created"
    )

    reason = models.TextField()

    previous_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True
    )

    new_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    is_approved = models.BooleanField(
        null=True,
        help_text="Null = En attente"
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="correction_requests_reviewed"
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Demande de Correction"
        verbose_name_plural = "Demandes de Correction"

    def __str__(self):
        return f"Correction • Transaction {self.transaction_id}"
