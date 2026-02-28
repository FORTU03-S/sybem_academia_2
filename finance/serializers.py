from rest_framework import serializers
from .models import (
    FinanceConfig, 
    FeeType, 
    FeeStructure, 
    StudentExemption, 
    Transaction, 
    CorrectionRequest
)


class FinanceConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceConfig
        fields = '__all__'

class FeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeType
        fields = '__all__'
        read_only_fields = ['school', 'status', 'created_by']

class FeeStructureSerializer(serializers.ModelSerializer):
    fee_type_name = serializers.CharField(source='fee_type.name', read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    
    class Meta:
        model = FeeStructure
        fields = '__all__'
        read_only_fields = ['school', 'academic_period']


class TransactionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_type_name = serializers.CharField(source='fee_structure.fee_type.name', read_only=True, default="N/A")
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    receipt_url = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'school', 'transaction_type', 'payment_method', 'amount', 'currency', 
            'exchange_rate_used', 'amount_in_base_currency', 'student', 
            'student_name', 'fee_structure', 'fee_type_name', 'description', 
            'status', 'receipt_number', 'receipt_url', 'created_by_name', 'created_at'
        ]
    
        read_only_fields = [
            'school',                   
            'exchange_rate_used',       
            'amount_in_base_currency',  
            'receipt_number',           
            'status',                   
            'created_by'                
        ]

    def get_student_name(self, obj):
        if obj.student:
            return f"{obj.student.last_name} {obj.student.first_name}"
        return "N/A"

    def get_receipt_url(self, obj):
        try:
            if obj.receipt_file:
                return obj.receipt_file.url
        except:
            return None
        return None



class TransactionReportSerializer(serializers.ModelSerializer):
    """
    Serializer aplati optimisé pour les tableaux de données (DataGrid) et l'export Excel.
    """
    date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")
    student_full_name = serializers.SerializerMethodField()
    student_class = serializers.SerializerMethodField() 
    category = serializers.SerializerMethodField()
    cashier = serializers.CharField(source='created_by.username', read_only=True)
    validator = serializers.CharField(source='validated_by.username', read_only=True, default="-")

    class Meta:
        model = Transaction
        fields = [
            'id', 'receipt_number', 'date',
            'transaction_type', 'status',
            'student_full_name', 'student_class',
            'category', 'description',
            'amount', 'currency', 'amount_in_base_currency',
            'payment_method', 'cashier', 'validator'
        ]

    def get_student_full_name(self, obj):
        if obj.student:
            return f"{obj.student.last_name} {obj.student.first_name}"
        return "N/A" 

    def get_student_class(self, obj):
        if obj.fee_structure:
            return obj.fee_structure.classe.name
        if obj.student:
             pass
        return "-"

    def get_category(self, obj):
        if obj.transaction_type == 'EXPENSE':
            return "Dépense / Sortie"
        if obj.fee_structure and obj.fee_structure.fee_type:
            return obj.fee_structure.fee_type.name
        return "Autre"


class StudentExemptionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_name = serializers.CharField(source='fee_structure.fee_type.name', read_only=True)
    
    class Meta:
        model = StudentExemption
        fields = '__all__'

    def get_student_name(self, obj):
        
        return f"{obj.student.last_name} {obj.student.first_name}"

class CorrectionRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True)
    transaction_receipt = serializers.CharField(source='transaction.receipt_number', read_only=True)

    class Meta:
        model = CorrectionRequest
        fields = '__all__'
        read_only_fields = ['requested_by', 'previous_amount', 'is_approved']