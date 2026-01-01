# AcademicPeriod/serializers.py
from rest_framework import serializers
from .models import AcademicPeriod

class AcademicPeriodSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le modèle AcademicPeriod.
    """
    class Meta:
        model = AcademicPeriod
        fields = '__all__'
        # 🛑 CORRECTION : Ajouter 'school' aux champs en lecture seule
        read_only_fields = ('school', 'created_at', 'created_by')