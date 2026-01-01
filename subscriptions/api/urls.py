# subscriptions/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'modules', views.SystemModuleViewSet, basename='modules')
router.register(r'plans', views.SubscriptionPlanViewSet, basename='plans')
router.register(r'subscriptions', views.SchoolSubscriptionViewSet, basename='subscriptions')  # ⬅️ Changé de 'SubscriptionViewSet' à 'SchoolSubscriptionViewSet'
router.register(r'payments', views.PaymentViewSet, basename='payments')
router.register(r'invoices', views.InvoiceViewSet, basename='invoices')
router.register(r'school-modules', views.SchoolModuleAccessAPIView, basename='school-modules')

urlpatterns = [
    # Statistiques
    path('stats/', views.SubscriptionStatsView.as_view(), name='subscription-stats'),
    # Inclure les routes du router
    path('', include(router.urls)),
]