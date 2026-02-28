from django.contrib.auth.mixins import AccessMixin
from django.shortcuts import redirect
from django.urls import reverse_lazy

class SuperAdminRequiredMixin(AccessMixin):
    """Vérifie si l'utilisateur est un Super Admin."""
    login_url = reverse_lazy('users:login')

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        
        
        if not request.user.is_superadmin(): 
            return redirect('admin_platform:dashboard') 
            
        return super().dispatch(request, *args, **kwargs)