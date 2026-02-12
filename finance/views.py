from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, F, Q
from django.db import transaction as db_transaction
from django.utils import timezone

from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from django.db.models.functions import TruncDay, TruncMonth, Coalesce
from django.db.models import Count, Sum
from rest_framework.views import APIView 
from .serializers import TransactionReportSerializer

from .models import (
    FinanceConfig, FeeType, FeeStructure, 
    StudentExemption, Transaction, CorrectionRequest
)
from .serializers import (
    FinanceConfigSerializer, FeeTypeSerializer, FeeStructureSerializer,
    StudentExemptionSerializer, TransactionSerializer, CorrectionRequestSerializer
)
from .permissions import IsCashier, IsAccountant, IsDirector
from pupils.models import Enrollment
from datetime import timedelta
# =====================================================
# CONFIG & FRAIS
# =====================================================

class FinanceConfigViewSet(viewsets.ModelViewSet):
    """
    Gère la config (Taux, Seuil).
    Seul le Directeur peut modifier, tout le monde peut lire.
    """
    serializer_class = FinanceConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Retourne uniquement la config de l'école de l'utilisateur
        # Suppose que user.school existe via middleware ou relation
        if hasattr(self.request.user, 'school'):
            return FinanceConfig.objects.filter(school=self.request.user.school)
        return FinanceConfig.objects.none()

class FeeStructureViewSet(viewsets.ModelViewSet):
    """
    CRUD des frais scolaires par classe.
    Filtres puissants pour le frontend.
    """
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated] # Ajouter IsAccountant pour write
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['classe', 'academic_period', 'fee_type']
    search_fields = ['fee_type__name', 'classe__name']

    def get_queryset(self):
        return FeeStructure.objects.filter(school=self.request.user.school).select_related('classe', 'fee_type')
    
    def get_permissions(self):
        """
        Modification temporaire pour le développement :
        On retire IsAccountant pour que vous puissiez tester sans être bloqué.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # return [IsAuthenticated(), IsAccountant()]  <-- LIGNE COMMENTÉE (Celle qui bloque)
            return [IsAuthenticated()] # <-- NOUVELLE LIGNE (Permissive)
        
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
    # 1. Récupérer l'école de l'utilisateur
        school = self.request.user.school
    
    # 2. Récupérer l'OBJET de la période académique de l'école
    # On prend l'instance directement, pas le .name ou .code
        period_instance = school.academic_period 
    
        if not period_instance:
        # Petite sécurité : si l'école n'a pas d'année configurée, on renvoie une erreur propre
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "Votre école n'a pas d'année académique active configurée."})

    # 3. Sauvegarder en passant l'OBJET (l'instance)
        serializer.save(
           school=school, 
           academic_period=period_instance  # <-- On envoie l'objet entier ici
        )
# =====================================================
# CŒUR DU SYSTÈME : TRANSACTIONS
# =====================================================


class FeeTypeViewSet(viewsets.ModelViewSet):
    serializer_class = FeeTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Le directeur et le comptable voient tout (même les en attente)
        # Mais pour le reste du système (ex: facturation), on filtrera sur APPROVED
        return FeeType.objects.filter(school=user.school)

    def perform_create(self, serializer):
        # Création automatique en mode "PENDING"
        serializer.save(
            school=self.request.user.school,
            created_by=self.request.user,
            status=FeeType.Status.PENDING
        )
        # TODO: Envoyer une notification réelle ici (Email, SMS ou Notification système)
        print(f"Notification : Un nouveau type de frais '{serializer.validated_data['name']}' attend validation.")

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Action réservée au Directeur"""
        # Ici on pourrait ajouter une permission : if not request.user.is_director: return 403
        fee_type = self.get_object()
        fee_type.status = FeeType.Status.APPROVED
        fee_type.save()
        return Response({'status': 'Type de frais approuvé avec succès.'})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Action pour rejeter la demande"""
        fee_type = self.get_object()
        fee_type.status = FeeType.Status.REJECTED
        fee_type.save()
        return Response({'status': 'Type de frais rejeté.'})

class TransactionViewSet(viewsets.ModelViewSet):
    """
    Gère tout le cycle de vie financier.
    """
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # Filtres pour le tableau Frontend
    filterset_fields = ['status', 'transaction_type', 'student', 'fee_structure', 'created_by']
    search_fields = ['receipt_number', 'student__first_name', 'student__last_name']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']

    def get_queryset(self):
        return Transaction.objects.filter(school=self.request.user.school).select_related('student', 'fee_structure', 'created_by')

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        
        # On utilise .filter().first() pour éviter de crasher si c'est vide
        config = FinanceConfig.objects.filter(school=school).first()
        
        if not config:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                "detail": "La configuration financière de l'école est manquante. "
                          "Veuillez la créer dans l'administration (FinanceConfig)."
            })
        
        # Logique de statut initial
        status_initial = "PENDING"
        amount = serializer.validated_data.get('amount')
        trans_type = serializer.validated_data.get('transaction_type')
        
        if trans_type == 'EXPENSE':
            if amount <= config.expense_approval_threshold:
                status_initial = "APPROVED"
        else:
            # Pour les frais scolaires, on peut valider automatiquement
            status_initial = "APPROVED" 

        serializer.save(
            school=school,
            created_by=user,
            exchange_rate_used=config.exchange_rate,
            status=status_initial
        )

    # --- ACTIONS WORKFLOW ---

    @action(detail=True, methods=['post'], permission_classes=[IsAccountant])
    def audit(self, request, pk=None):
        """Le Comptable valide que l'argent est bien dans la caisse/banque."""
        txn = self.get_object()
        if txn.status != 'PENDING':
            return Response({"error": "Transaction déjà traitée"}, status=400)
        
        txn.status = 'AUDITED'
        txn.audited_by = request.user
        txn.audited_at = timezone.now()
        txn.save()
        
        return Response({"status": "Transaction auditée avec succès"})

    @action(detail=True, methods=['post'], permission_classes=[IsDirector])
    def validate_expense(self, request, pk=None):
        """La Direction valide une grosse dépense."""
        txn = self.get_object()
        if txn.transaction_type != 'EXPENSE':
             return Response({"error": "Seules les dépenses sont validables par la direction"}, status=400)
        
        txn.status = 'APPROVED'
        txn.validated_by = request.user
        txn.save()
        return Response({"status": "Dépense approuvée"})

    @action(detail=True, methods=['post'], permission_classes=[IsDirector])
    def reject(self, request, pk=None):
        """Rejet d'une transaction."""
        txn = self.get_object()
        txn.status = 'REJECTED'
        txn.save()
        return Response({"status": "Transaction rejetée"})

    # --- DASHBOARD FINANCIER PAR CLASSE ---
    
    @action(detail=False, methods=['get'])
    def class_summary(self, request):
        """
        Calculs complexes pour le tableau de bord :
        Total Attendu vs Total Perçu (tenant compte des abandons et exemptions).
        URL: /api/finance/transactions/class_summary/?classe_id=1
        """
        classe_id = request.query_params.get('classe_id')
        if not classe_id:
            return Response({"error": "classe_id requis"}, status=400)

        # 1. Total Attendu Théorique
        # (Nb élèves actifs * Frais de la classe)
        active_students_count = Enrollment.objects.filter(classe_id=classe_id, status='active').count()
        
        total_fees_structure = FeeStructure.objects.filter(classe_id=classe_id).aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        gross_expected = active_students_count * total_fees_structure

        # 2. Gestion des Exemptions (À soustraire)
        exemptions_total = StudentExemption.objects.filter(
            student__enrollment__classe_id=classe_id
        ).aggregate(total=Sum('discount_amount'))['total'] or 0

        # 3. Gestion des Abandons (Logique simplifiée pour l'exemple)
        # Il faudrait ici une boucle complexe pour vérifier la date de départ vs date de paiement
        # Pour l'instant, on suppose que les abandons ne paient rien (ou ce qu'ils ont déjà payé)
        
        net_expected = float(gross_expected) - float(exemptions_total)

        # 4. Total Réellement Perçu (Validé ou Audité)
        total_collected = Transaction.objects.filter(
            student__enrollment__classe_id=classe_id,
            transaction_type='INCOME',
            status__in=['AUDITED', 'APPROVED'] # On ne compte pas les PENDING pour la sécurité
        ).aggregate(total=Sum('amount_in_base_currency'))['total'] or 0

        # 5. Reste à recouvrer
        remaining = net_expected - float(total_collected)

        return Response({
            "classe_id": classe_id,
            "active_students": active_students_count,
            "gross_expected": gross_expected,
            "total_exemptions": exemptions_total,
            "net_expected": net_expected,
            "total_collected": total_collected,
            "remaining_balance": remaining,
            "collection_rate": (float(total_collected) / net_expected * 100) if net_expected > 0 else 0
        })

# =====================================================
# GESTION DES CORRECTIONS
# =====================================================

class CorrectionRequestViewSet(viewsets.ModelViewSet):
    """
    Le comptable demande, la direction valide.
    """
    serializer_class = CorrectionRequestSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # On stocke le montant précédent automatiquement
        txn = serializer.validated_data['transaction']
        serializer.save(
            requested_by=self.request.user,
            previous_amount=txn.amount
        )

    @action(detail=True, methods=['post'], permission_classes=[IsDirector])
    def approve(self, request, pk=None):
        correction = self.get_object()
        if correction.is_approved is not None:
             return Response({"error": "Déjà traité"}, status=400)

        with db_transaction.atomic():
            # 1. Appliquer la correction
            txn = correction.transaction
            txn.amount = correction.new_amount
            # Recalculer la conversion si besoin
            if txn.currency == "USD":
                txn.amount_in_base_currency = correction.new_amount
            # ... (logique conversion)
            txn.save()

            # 2. Marquer la demande
            correction.is_approved = True
            correction.reviewed_by = request.user
            correction.reviewed_at = timezone.now()
            correction.save()

        return Response({"status": "Correction appliquée et solde mis à jour"})
    

# =====================================================
# DASHBOARD COMPTABLE & ANALYTICS
# =====================================================

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Q, Case, When, DecimalField
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek, TruncYear, Coalesce
from django.utils import timezone
from django.http import HttpResponse
from datetime import datetime

# Imports pour le PDF (ReportLab)
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from .models import Transaction, StudentExemption, FinanceConfig, FeeStructure
from pupils.models import Student
from .permissions import IsAccountant, IsDirector

# =====================================================
# VUE 1 : DASHBOARD INTELLIGENT (JSON pour Frontend)
# =====================================================

class AccountingDashboardView(APIView):
    """
    Fournit une vue à 360° de la finance.
    CORRECTIONS : Ajout de SessionAuthentication et gestion du paramètre 'range'.
    """
    # CRITIQUE : Permet au navigateur d'utiliser la session admin
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsAccountant | IsDirector]

    def get(self, request):
        school = request.user.school
        
        # --- 1. FILTRAGE TEMPOREL (Adapté au JS) ---
        range_param = request.query_params.get('range', 'monthly')
        now = timezone.now()
        
        if range_param == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now.replace(hour=23, minute=59, second=59)
        elif range_param == 'weekly':
            start_date = now - timedelta(days=now.weekday())
            end_date = now
        elif range_param == 'yearly':
            start_date = now.replace(month=1, day=1, hour=0, minute=0)
            end_date = now.replace(month=12, day=31, hour=23, minute=59)
        else: # monthly par défaut
            start_date = now.replace(day=1, hour=0, minute=0)
            end_date = now

        # On override si des dates précises sont fournies
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')

        # --- 2. CALCULS (QuerySet filtré) ---
        transactions = Transaction.objects.filter(
            school=school,
            created_at__range=[start_date, end_date],
            status__in=['AUDITED', 'APPROVED'] 
        )

        income = transactions.filter(transaction_type='INCOME').aggregate(
            total=Coalesce(Sum('amount_in_base_currency'), 0.0, output_field=DecimalField())
        )['total']

        expenses = transactions.filter(transaction_type='EXPENSE').aggregate(
            total=Coalesce(Sum('amount_in_base_currency'), 0.0, output_field=DecimalField())
        )['total']

        net_cash = float(income) - float(expenses)

        # --- 3. GRAPHIQUES ---
        period_grouping = request.query_params.get('group_by', 'day')
        trunc_func = {
            'day': TruncDay('created_at'),
            'month': TruncMonth('created_at'),
        }.get(period_grouping, TruncDay('created_at'))

        chart_data = transactions.annotate(period=trunc_func).values('period', 'transaction_type').annotate(
            total=Sum('amount_in_base_currency')
        ).order_by('period')

        # --- 4. CONFIGURATION (Pour la devise) ---
        config = FinanceConfig.objects.filter(school=school).first()
        currency = config.main_currency if config else "USD"

        return Response({
            "kpi": {
                "income_real": income,
                "expense_real": expenses,
                "net_balance": net_cash,
                "exemptions_given": 0, # Calcul à simplifier ou dynamiser selon besoin
                "dropout_loss": 0,
                "currency": currency
            },
            "chart_data": list(chart_data),
            "period": f"{start_date.date()} au {end_date.date()}"
        })

# =====================================================
# VUE 2 : RAPPORT PDF IMPRIMABLE (Comptabilité Pro)
# =====================================================

class AccountingPDFReport(APIView):
    """
    Génère un PDF officiel type 'Grand Livre' ou 'Journal de Caisse'.
    """
    permission_classes = [IsAuthenticated, IsAccountant | IsDirector]
    
    def get_date_range(self, period):
        now = timezone.now()
        if period == 'today':
            start = now.replace(hour=0, minute=0, second=0)
            return start, now
        elif period == 'weekly':
            start = now - timedelta(days=now.weekday()) # Début de semaine (Lundi)
            return start, now
        elif period == 'monthly':
            start = now.replace(day=1, hour=0, minute=0) # 1er du mois
            return start, now
        elif period == 'yearly':
            start = now.replace(month=1, day=1, hour=0, minute=0) # 1er Janvier
            return start, now
        return None, None


    def get(self, request):
        school = request.user.school
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Configuration dates (similaire au dashboard)
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            date_label = f"Du {start_date_str} au {end_date_str}"
        else:
            date_label = "Historique complet"
            start_date = datetime(2000,1,1) # Loin dans le passé
            end_date = timezone.now()

        # Récupération des données brutes
        txns = Transaction.objects.filter(
            school=school,
            created_at__range=[start_date, end_date],
            status__in=['AUDITED', 'APPROVED']
        ).order_by('created_at')

        # --- CRÉATION DU PDF AVEC REPORTLAB ---
        response = HttpResponse(content_type='application/pdf')
        filename = f"Journal_Financier_{timezone.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        # Orientation Paysage pour avoir de la place
        p = canvas.Canvas(response, pagesize=landscape(A4))
        width, height = landscape(A4)

        # 1. En-tête PRO
        p.setFont("Helvetica-Bold", 18)
        p.drawString(30, height - 40, f"JOURNAL FINANCIER : {school.name.upper()}")
        
        p.setFont("Helvetica", 10)
        p.drawString(30, height - 60, f"Période : {date_label}")
        p.drawString(30, height - 75, f"Édité par : {request.user.username} | Date d'impression : {timezone.now().strftime('%d/%m/%Y %H:%M')}")
        
        # Ligne de séparation
        p.line(30, height - 85, width - 30, height - 85)

        # 2. Préparation du Tableau
        # En-têtes des colonnes
        data = [['Date', 'Réf.', 'Type', 'Libellé / Tiers', 'Mode', 'Entrée', 'Sortie']]
        
        total_in = 0
        total_out = 0

        # Remplissage
        for txn in txns:
            d = txn.created_at.strftime("%d/%m/%y")
            ref = txn.receipt_number if txn.receipt_number else "-"
            # Libellé intelligent
            if txn.transaction_type == 'INCOME' and txn.student:
                libelle = f"{txn.student.last_name} {txn.student.first_name}"
            else:
                libelle = txn.description[:25] # On tronque si trop long

            m_in = txn.amount_in_base_currency if txn.transaction_type == 'INCOME' else 0
            m_out = txn.amount_in_base_currency if txn.transaction_type == 'EXPENSE' else 0
            
            total_in += m_in
            total_out += m_out

            row = [
                d,
                ref,
                txn.transaction_type[:3], # INC ou EXP
                libelle,
                txn.payment_method,
                f"{m_in:,.2f}".replace(",", " "),
                f"{m_out:,.2f}".replace(",", " ")
            ]
            data.append(row)

        # Ligne de TOTAUX
        data.append(['', '', '', 'TOTAUX PÉRIODE', '', f"{total_in:,.2f}", f"{total_out:,.2f}"])
        # Ligne de SOLDE
        solde = total_in - total_out
        data.append(['', '', '', 'SOLDE NET EN CAISSE', '', f"{solde:,.2f}", ''])

        # 3. Style du Tableau (Le look "Comptable")
        table = Table(data, colWidths=[60, 80, 40, 220, 80, 70, 70])
        
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.2, 0.6)), # En-tête bleu foncé
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (3, 1), (3, -1), 'LEFT'), # Libellé aligné gauche
            ('ALIGN', (5, 1), (-1, -1), 'RIGHT'), # Chiffres alignés droite
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            # Couleur des montants
            ('TEXTCOLOR', (5, 1), (5, -2), colors.green), # Entrées
            ('TEXTCOLOR', (6, 1), (6, -2), colors.red),   # Sorties
            # Style Totaux
            ('BACKGROUND', (0, -2), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
        ])
        table.setStyle(style)

        # Dessiner le tableau
        # Note : Dans une vraie app prod, il faut gérer le saut de page (Multi-page).
        # Ici on fait simple pour une page.
        table.wrapOn(p, width, height)
        table.drawOn(p, 30, height - 120 - (len(data)*20))

        p.showPage()
        p.save()
        return response