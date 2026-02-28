
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FinanceConfigViewSet, 
    FeeStructureViewSet, 
    FeeTypeViewSet, 
    TransactionViewSet, 
    CorrectionRequestViewSet,
    StudentExemptionViewSet,
    AccountingDashboardView,
    AccountingPDFReport
)

router = DefaultRouter()
router.register(r'config', FinanceConfigViewSet, basename='finance-config')

router.register(r'fee-structures', FeeStructureViewSet, basename='fee-structure')

router.register(r'fee-types', FeeTypeViewSet, basename='fee-type')
router.register(r'transactions', TransactionViewSet, basename='transaction')

router.register(r'exemptions', StudentExemptionViewSet, basename='exemption')
router.register(r'payments', TransactionViewSet, basename='payment')
router.register(r'corrections', CorrectionRequestViewSet, basename='correction')

urlpatterns = [
    path('', include(router.urls)),
    
    
    path('dashboard/', AccountingDashboardView.as_view(), name='finance-dashboard'),
    path('report/pdf/', AccountingPDFReport.as_view(), name='finance-pdf'),
]