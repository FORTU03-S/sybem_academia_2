
from django.urls import path
from .views import NotificationCountView, ProcessNotificationView, LatestNotificationsView

urlpatterns = [
    path('count/', NotificationCountView.as_view(), name='notif-count'),
    path('latest/', LatestNotificationsView.as_view(), name='notif-latest'),
    path('<int:pk>/process/', ProcessNotificationView.as_view(), name='notif-process'),
]