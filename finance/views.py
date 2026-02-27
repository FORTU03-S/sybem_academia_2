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
    #filterset_fields = ['student', 'status', 'transaction_type']
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
    

import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, DecimalField, Q
from django.db.models.functions import Coalesce, TruncDay, TruncMonth
from django.http import HttpResponse

# Framework DRF
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authentication import SessionAuthentication, BasicAuthentication

# ReportLab (PDF)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

# Imports locaux
# Assurez-vous que ces modèles existent bien dans finance/models.py
from .models import (
    Transaction, 
    FinanceConfig, 
    FeeStructure, 
    FeeType, 
    CorrectionRequest
)
from .serializers import (
    FinanceConfigSerializer,
    FeeStructureSerializer,
    FeeTypeSerializer,
    TransactionSerializer,
    CorrectionRequestSerializer
)

logger = logging.getLogger(__name__)

# =====================================================
# SECTION 1 : VIEWSETS CRUD (Nécessaires pour urls.py)
# =====================================================

class FinanceConfigViewSet(viewsets.ModelViewSet):
    queryset = FinanceConfig.objects.all()
    serializer_class = FinanceConfigSerializer
    permission_classes = [IsAuthenticated]

# =====================================================
# SECTION 2 : DASHBOARD INTELLIGENT (JSON pour Frontend)
# =====================================================

class AccountingDashboardView(APIView):
    """
    Fournit une vue à 360° de la finance.
    Authentification : Session (Navigateur) + Basic (API)
    """
    # C'EST ICI QUE L'ERREUR 403 EST RÉSOLUE :
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get_date_range(self, range_param, request):
        """Utilitaire pour calculer les dates de début et fin"""
        now = timezone.now()
        
        # Par défaut : Mois en cours
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = now

        if range_param == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now.replace(hour=23, minute=59, second=59)
        elif range_param == 'weekly':
            # Début de semaine (Lundi)
            start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
        elif range_param == 'yearly':
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now.replace(month=12, day=31, hour=23, minute=59, second=59)

        # Override manuel si fourni dans l'URL (?start_date=...&end_date=...)
        s_str = request.query_params.get('start_date')
        e_str = request.query_params.get('end_date')
        
        if s_str and e_str:
            try:
                # Parsing des dates
                start_dt = datetime.strptime(s_str, '%Y-%m-%d')
                end_dt = datetime.strptime(e_str, '%Y-%m-%d')
                
                # Gestion Timezone (Aware vs Naive)
                if timezone.is_naive(start_dt):
                    start_date = timezone.make_aware(start_dt)
                else:
                    start_date = start_dt
                    
                if timezone.is_naive(end_dt):
                    end_date = timezone.make_aware(end_dt).replace(hour=23, minute=59, second=59)
                else:
                    end_date = end_dt.replace(hour=23, minute=59, second=59)
            except ValueError:
                pass # On garde les dates calculées par défaut si erreur de format

        return start_date, end_date

    def get(self, request):
        # Sécurité : Si l'utilisateur n'a pas d'école liée (SuperAdmin global), on gère
        if hasattr(request.user, 'school') and request.user.school:
            school = request.user.school
            transactions = Transaction.objects.filter(school=school)
        else:
            # Fallback pour superuser sans école spécifique
            school = None 
            transactions = Transaction.objects.all()

        range_param = request.query_params.get('range', 'monthly')
        start_date, end_date = self.get_date_range(range_param, request)

        # Filtre principal sur la période et le statut
        transactions = transactions.filter(
            created_at__range=[start_date, end_date],
            status__in=['AUDITED', 'APPROVED'] 
        )

        # 1. Calculs KPI
        # Utilisation de aggregate pour performance DB
        income_agg = transactions.filter(transaction_type='INCOME').aggregate(
            total=Coalesce(Sum('amount_in_base_currency'), 0.0, output_field=DecimalField())
        )
        income = float(income_agg['total'])

        expense_agg = transactions.filter(transaction_type='EXPENSE').aggregate(
            total=Coalesce(Sum('amount_in_base_currency'), 0.0, output_field=DecimalField())
        )
        expenses = float(expense_agg['total'])

        net_cash = income - expenses
        
        # 2. Stats de Paiement (Donut Chart)
        payment_stats_qs = transactions.filter(transaction_type='INCOME').values('payment_method').annotate(
            total=Sum('amount_in_base_currency')
        ).order_by('-total')
        
        payment_stats = []
        for item in payment_stats_qs:
            payment_stats.append({
                "payment_method": item['payment_method'],
                "total": float(item['total'])
            })
        
        # 3. Dernières Transactions (Tableau)
        recent_txns = transactions.order_by('-created_at')[:10]
        recent_data = [{
            "id": t.id,
            "date_payment": t.created_at.isoformat(),
            "description": t.description,
            "student_name": f"{t.student.last_name} {t.student.first_name}" if t.student else (t.description or "N/A"),
            "transaction_type": t.transaction_type,
            "amount": float(t.amount_in_base_currency),
            "payment_method": t.payment_method,
        } for t in recent_txns]

        # 4. Graphique Evolution (Area Chart)
        period_grouping = request.query_params.get('group_by', 'day')
        trunc_func = {
            'day': TruncDay('created_at'),
            'month': TruncMonth('created_at'),
        }.get(period_grouping, TruncDay('created_at'))

        chart_data_qs = transactions.annotate(period=trunc_func).values('period', 'transaction_type').annotate(
            total=Sum('amount_in_base_currency')
        ).order_by('period')

        chart_data = []
        for item in chart_data_qs:
            # Conversion robuste de la date
            p_date = item['period']
            if isinstance(p_date, datetime):
                p_str = p_date.strftime('%Y-%m-%d')
            else:
                p_str = str(p_date) # Fallback

            chart_data.append({
                'period': p_str,
                'transaction_type': item['transaction_type'],
                'total': float(item['total'])
            })

        # 5. Config Devise
        currency = "USD"
        if school:
            config = FinanceConfig.objects.filter(school=school).first()
            if config:
                currency = config.main_currency

        return Response({
            "kpi": {
                "income_real": income,
                "expense_real": expenses,
                "net_balance": net_cash,
                "exemptions_given": 0, # À implémenter si vous gérez les réductions
                "dropout_loss": 0,
                "currency": currency
            },
            "chart_data": chart_data,
            "payment_stats": payment_stats,
            "recent_transactions": recent_data,
            "period": f"{start_date.strftime('%d/%m')} au {end_date.strftime('%d/%m')}"
        })


# =====================================================
# SECTION 3 : RAPPORT PDF IMPRIMABLE
# =====================================================

class AccountingPDFReport(APIView):
    """
    Génère un PDF officiel type 'Grand Livre' ou 'Journal de Caisse'.
    """
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if hasattr(request.user, 'school'):
            school = request.user.school
        else:
            school = None # Gérer le cas admin global

        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Configuration dates
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                date_label = f"Du {start_date_str} au {end_date_str}"
            except ValueError:
                start_date = timezone.now().replace(day=1)
                end_date = timezone.now()
                date_label = "Période par défaut (Mois en cours)"
        else:
            # Par défaut : Historique complet (limitée aux 1000 dernières pour éviter crash PDF)
            date_label = "Dernières transactions (Max 500)"
            start_date = datetime(2000,1,1)
            end_date = timezone.now()

        # Récupération des données
        qs = Transaction.objects.filter(
            created_at__range=[start_date, end_date],
            status__in=['AUDITED', 'APPROVED']
        )
        if school:
            qs = qs.filter(school=school)
            
        # Limite de sécurité pour le PDF généré à la volée
        txns = qs.order_by('created_at')[:500] 

        # --- CRÉATION DU PDF AVEC REPORTLAB ---
        response = HttpResponse(content_type='application/pdf')
        filename = f"Journal_Financier_{timezone.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        # Orientation Paysage (A4 Landscape : ~842 x 595 points)
        p = canvas.Canvas(response, pagesize=landscape(A4))
        width, height = landscape(A4)

        # 1. En-tête
        p.setFont("Helvetica-Bold", 18)
        school_name = school.name.upper() if school else "ADMINISTRATION GLOBALE"
        p.drawString(30, height - 40, f"JOURNAL FINANCIER : {school_name}")
        
        p.setFont("Helvetica", 10)
        p.drawString(30, height - 60, f"Période : {date_label}")
        p.drawString(30, height - 75, f"Édité par : {request.user.username} | Date : {timezone.now().strftime('%d/%m/%Y %H:%M')}")
        
        p.line(30, height - 85, width - 30, height - 85)

        # 2. Données du Tableau
        headers = ['Date', 'Réf.', 'Type', 'Libellé / Tiers', 'Mode', 'Entrée', 'Sortie']
        data = [headers]
        
        total_in = 0.0
        total_out = 0.0

        for txn in txns:
            d = txn.created_at.strftime("%d/%m/%y")
            ref = txn.receipt_number if txn.receipt_number else "-"
            
            # Libellé
            if txn.transaction_type == 'INCOME' and txn.student:
                libelle = f"{txn.student.last_name} {txn.student.first_name}"
            else:
                libelle = txn.description[:30] if txn.description else "N/A"

            m_in = float(txn.amount_in_base_currency) if txn.transaction_type == 'INCOME' else 0.0
            m_out = float(txn.amount_in_base_currency) if txn.transaction_type == 'EXPENSE' else 0.0
            
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

        # Totaux
        data.append(['', '', '', 'TOTAUX PÉRIODE', '', f"{total_in:,.2f}", f"{total_out:,.2f}"])
        solde = total_in - total_out
        data.append(['', '', '', 'SOLDE NET', '', f"{solde:,.2f}", ''])

        # 3. Création et Style du Tableau
        # Largeur colonnes : Total 740px (Reste ~100px marge)
        col_widths = [60, 80, 40, 280, 80, 100, 100]
        table = Table(data, colWidths=col_widths)
        
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.2, 0.6)), # Entête bleu foncé
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'), # Centré par défaut
            ('ALIGN', (3, 1), (3, -1), 'LEFT'),    # Libellé à gauche
            ('ALIGN', (5, 1), (-1, -1), 'RIGHT'),  # Montants à droite
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TEXTCOLOR', (5, 1), (5, -2), colors.green), # Entrées en Vert
            ('TEXTCOLOR', (6, 1), (6, -2), colors.red),   # Sorties en Rouge
            ('BACKGROUND', (0, -2), (-1, -1), colors.lightgrey), # Fond gris pour les totaux
            ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
        ])
        table.setStyle(style)

        # 4. Positionnement dynamique
        # On calcule la hauteur réelle du tableau
        w, h = table.wrap(width, height)
        
        # Point de départ Y (Haut de page - En-tête - Hauteur tableau)
        # Attention : drawOn utilise le coin INFÉRIEUR GAUCHE du tableau
        top_margin = 100
        y_position = height - top_margin - h

        # Gestion de page simple : si le tableau est trop grand pour une page
        if y_position < 50:
            # Cas simple : on prévient (Pour une gestion multi-page, il faudrait SimpleDocTemplate)
            p.setFont("Helvetica-Oblique", 10)
            p.setFillColor(colors.red)
            p.drawString(30, height - 100, "Attention : Trop de transactions pour une seule page. Veuillez réduire la période.")
            table.drawOn(p, 30, 50) # On dessine ce qu'on peut
        else:
            table.drawOn(p, 30, y_position)

        p.showPage()
        p.save()
        return response
    
# --- AJOUTER CECI DANS views.py ---

class StudentExemptionViewSet(viewsets.ModelViewSet):
    """
    Gère les demandes d'exonération.
    """
    serializer_class = StudentExemptionSerializer
    permission_classes = [IsAuthenticated]
    # On ajoute des filtres pour retrouver facilement les exemptions d'un élève
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['student', 'fee_structure', 'is_approved']

    def get_queryset(self):
        # On filtre pour ne voir que les exemptions de l'école courante via l'élève
        return StudentExemption.objects.filter(
            student__enrollment__school=self.request.user.school
        ).select_related('student', 'fee_structure')

    def perform_create(self, serializer):
        # On n'envoie que ce qui existe dans le modèle
        # Si tu veux dire que l'exonération n'est pas encore approuvée, 
        # on laisse 'approved_by' à None (ce qui est le cas par défaut)
        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsDirector])
    def approve(self, request, pk=None):
        """Le directeur valide l'exonération"""
        exemption = self.get_object()
        exemption.is_approved = True
        exemption.approved_by = request.user
        exemption.approved_at = timezone.now()
        exemption.save()
        return Response({"status": "Exonération validée"})