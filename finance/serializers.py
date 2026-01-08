from rest_framework import serializers
from .models import FeeCategory, SchoolFeeConfig, Payment, Expense
#from pupils.models import Student

class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = '__all__'

class SchoolFeeConfigSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    
    class Meta:
        model = SchoolFeeConfig
        fields = ['id', 'category', 'category_name', 'classe', 'classe_name', 'amount', 'frequency', 'total_yearly_amount']

class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'uid', 'receipt_number', 'student', 'student_name', 
            'category', 'category_name', 'amount', 'method', 
            'status', 'date', 'recorded_by_name', 
            'mobile_operator', 'transaction_ref'
        ]
        read_only_fields = ['uid', 'receipt_number', 'status', 'date', 'recorded_by']

    def get_student_name(self, obj):
        # On gère le cas où student est un User ou un Student Profile selon ton modèle
        if hasattr(obj.student, 'student_profile'):
             return obj.student.student_profile.full_name
        return f"{obj.student.last_name} {obj.student.first_name}"

class ExpenseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['created_by', 'approved_by', 'status', 'created_at']

# --- SERIALIZER SPÉCIAL DASHBOARD ---
class StudentFinanceSummarySerializer(serializers.Serializer):
    """
    Ce serializer ne correspond pas à un modèle, mais à une vue calculée
    pour afficher le bilan financier d'un élève.
    """
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    student_status = serializers.CharField() # ACTIVE, DROPOUT
    total_expected = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2) # Positif = Dette, Négatif = Crédit
    details = serializers.ListField() # Liste des frais détaillés