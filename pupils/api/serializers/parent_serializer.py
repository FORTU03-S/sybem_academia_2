
from rest_framework import serializers
from pupils.models.parent import Parent

class ParentSerializer(serializers.ModelSerializer):
    
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Parent
        fields = ['id', 'user', 'full_name', 'first_name', 'last_name', 'user_email', 'school', 'is_approved']