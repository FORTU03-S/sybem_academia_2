from rest_framework import serializers
from pupils.models.parent import Parent

class ParentSerializer(serializers.ModelSerializer):
    # Pour afficher l'email ou le nom au lieu de l'ID
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Parent
        fields = ['id', 'user', 'user_email', 'school', 'is_approved']