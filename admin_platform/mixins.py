from django.contrib.auth.mixins import AccessMixin
from django.shortcuts import redirect
from django.urls import reverse_lazy

class SuperAdminRequiredMixin(AccessMixin):
    """Vérifie si l'utilisateur est un Super Admin."""
    login_url = reverse_lazy('users:login')

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        
        # Vérification du user_type (utilisation de la méthode définie dans users/models.py)
        if not request.user.is_superadmin(): 
            # Redirection vers une page d'accès refusé ou une autre page d'accueil
            return redirect('admin_platform:dashboard') # Pour l'instant, on renvoie au dashboard (qui fera la vérification)
            
        return super().dispatch(request, *args, **kwargs)