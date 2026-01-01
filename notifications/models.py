from django.db import models
from users.models import User
from schools.models import School

class Notification(models.Model):
    title = models.CharField(max_length=255)
    message = models.TextField()
    school = models.ForeignKey(
        School, null=True, blank=True, on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

class NotificationRead(models.Model):
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    is_read = models.BooleanField(default=False)
