from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Classe, GradingPeriod

@receiver(post_save, sender=Classe)
def create_default_grading_periods(sender, instance, created, **kwargs):
    if created:
       
        prefix = "Trimestre" if instance.system_type == Classe.SystemType.TRIMESTER else "Semestre"
        
        exists = GradingPeriod.objects.filter(
            academic_period=instance.academic_period,
            name__icontains=prefix
        ).exists()

        if not exists:
           
            print(f"Périodes par défaut créées pour {instance.academic_period}")