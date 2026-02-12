from rest_framework import serializers
from .models import FinanceConfig, FeeType, FeeStructure, StudentExemption, Transaction, CorrectionRequest
from pupils.api.serializers.student_serializer import StudentSerializer # Suppose que tu l'as déjà

class FinanceConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceConfig
        fields = '__all__'

class FeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeType
        fields = '__all__'

class FeeStructureSerializer(serializers.ModelSerializer):
    fee_type_name = serializers.CharField(source='fee_type.name', read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)

    class Meta:
        model = FeeStructure
        fields = '__all__'

class StudentExemptionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    fee_structure_name = serializers.CharField(source='fee_structure.fee_type.name', read_only=True)

    class Meta:
        model = StudentExemption
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True, default="N/A")
    student_classe = serializers.CharField(source='student.current_classe.name', read_only=True, default="N/A")
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    # Pour afficher l'URL du reçu
    receipt_url = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ('receipt_number', 'amount_in_base_currency', 'created_by', 'audited_by', 'validated_by', 'status')

    def get_receipt_url(self, obj):
        if obj.receipt_file:
            return obj.receipt_file.url
        return None

class CorrectionRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    
    class Meta:
        model = CorrectionRequest
        fields = '__all__'
        read_only_fields = ('is_approved', 'reviewed_by', 'reviewed_at', 'requested_by')