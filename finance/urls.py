# C:\Users\user\sybem_academia2\sybem\finance\urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FinanceConfigViewSet, 
    FeeStructureViewSet, 
    FeeTypeViewSet, # Assurez-vous qu'il est défini dans views.py
    TransactionViewSet, 
    CorrectionRequestViewSet,
    StudentExemptionViewSet,
    AccountingDashboardView,
    AccountingPDFReport
)

router = DefaultRouter()
router.register(r'config', FinanceConfigViewSet, basename='finance-config')
# On change 'fees' en 'fee-structures' pour matcher le JS
router.register(r'fee-structures', FeeStructureViewSet, basename='fee-structure')
# On ajoute le endpoint manquant pour les types de frais
router.register(r'fee-types', FeeTypeViewSet, basename='fee-type')
router.register(r'transactions', TransactionViewSet, basename='transaction')
#router.register(r'payments', TransactionViewSet, basename='payment')
router.register(r'exemptions', StudentExemptionViewSet, basename='exemption')
router.register(r'payments', TransactionViewSet, basename='payment')
router.register(r'corrections', CorrectionRequestViewSet, basename='correction')

urlpatterns = [
    path('', include(router.urls)),
    
    # Routes pour le Dashboard et les PDF (APIView ne vont pas dans le router)
    path('dashboard/', AccountingDashboardView.as_view(), name='finance-dashboard'),
    path('report/pdf/', AccountingPDFReport.as_view(), name='finance-pdf'),
]