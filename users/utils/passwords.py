import secrets
import string

def generate_temp_password(length=10):
    """
    Génère un mot de passe temporaire sécurisé.
    - lettres majuscules / minuscules
    - chiffres
    - non prédictible
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
 