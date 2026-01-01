
from django.db import models
from users.models import User
from schools.models import School

class Timeline(models.Model):
    ACTION_TYPES = [
        ('create', 'Création'),
        ('update', 'Modification'),
        ('delete', 'Suppression'),
        ('login', 'Connexion'),
        ('logout', 'Déconnexion'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action_type = models.CharField(max_length=20, choices=ACTION_TYPES)
    action_label = models.CharField(max_length=255)
    module = models.CharField(max_length=100)
    metadata = models.JSONField(
        null=True,
        blank=True,
        help_text="Données contextuelles (IDs, montants, etc.)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField()
