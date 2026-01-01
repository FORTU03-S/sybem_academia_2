# admin_platform/forms.py

from django import forms
from schools.models import School
from users.models import User
from AcademicPeriod.models import AcademicPeriod
from subscriptions.models import SubscriptionPlan, Subscription

# 1. Formulaire de base pour la création de l'École
class SchoolForm(forms.ModelForm):
    class Meta:
        model = School
        fields = [
            'name', 
            'code', 
            'address', 
            'phone_number', 
            'email',
            'max_students',
            'max_staff',
            'max_teachers'
        ]
        
    # Le Super Admin ne choisit que les AcademicPeriod de type 'YEAR'
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # S'assurer que les choix d'année académique sont pré-existants
        self.fields['academic_year'].queryset = AcademicPeriod.objects.filter(type='YEAR')

# 2. Formulaire pour la création de l'Administrateur d'École
class SchoolAdminCreationForm(forms.ModelForm):
    # Les champs nécessaires pour l'utilisateur
    password = forms.CharField(widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name']
        
    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        user.user_type = User.SCHOOL_ADMIN # Définir le type d'utilisateur
        user.is_active = True
        
        if commit:
            user.save()
        return user

# 3. Formulaire pour l'Abonnement (utilisé dans la création)
class SchoolSubscriptionForm(forms.ModelForm):
    class Meta:
        model = Subscription
        fields = ['plan', 'start_date', 'end_date', 'max_users', 'is_active']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Afficher uniquement les plans actifs pour la sélection
        self.fields['plan'].queryset = SubscriptionPlan.objects.filter(is_active=True)
        
# C:\Users\user\sybem_academia2\sybem\admin_platform\forms.py

# ... (Vos classes SchoolForm, SchoolAdminCreationForm, SchoolSubscriptionForm) ...

# 4. Formulaire pour la création/modification du Plan d'Abonnement MAÎTRE
class SubscriptionPlanForm(forms.ModelForm):
    class Meta:
        model = SubscriptionPlan
        fields = [
            'name', 
            'description', 
            'price_per_month', 
            'default_max_users', 
            'default_max_modules', 
            'is_active'
        ]