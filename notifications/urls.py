# C:\Users\user\sybem_academia2\sybem\notifications\urls.py
from django.urls import path
from .views import NotificationCountView, ProcessNotificationView, LatestNotificationsView

urlpatterns = [
    path('count/', NotificationCountView.as_view(), name='notif-count'),
    path('latest/', LatestNotificationsView.as_view(), name='notif-latest'),
    # Enlève le slash final ici pour tester si ton JS n'envoie pas de slash
    path('<int:pk>/process', ProcessNotificationView.as_view(), name='notif-process-alt'),
    # Ou garde celui-ci qui est le standard
    path('<int:pk>/process/', ProcessNotificationView.as_view(), name='notif-process'),
]