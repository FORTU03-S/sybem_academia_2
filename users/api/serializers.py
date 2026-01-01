from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    def validate(self, attrs):
        data = super().validate(attrs)

        data['user'] = {
            "id": self.user.id,
            "email": self.user.email,
            "user_type": self.user.user_type,
            "is_superadmin": self.user.is_superadmin(),
        }
        return data