from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver
from .models import SystemLog, CustomUser

@receiver(user_logged_in)
def log_user_login_signal(sender, request, user, **kwargs):
    if isinstance(user, CustomUser):
        from .audit import log_user_login
        log_user_login(user, request=request)

@receiver(user_login_failed)
def log_user_login_failed(sender, credentials, request, **kwargs):
    from .audit import log_failed_login

    username = credentials.get('username', 'Unknown')
    log_failed_login(username, request=request)
