from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver
from .models import SystemLog, CustomUser

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    if isinstance(user, CustomUser):
        SystemLog.objects.create(
            user=user,
            action="Logged in successfully.",
            type="user"
        )

@receiver(user_login_failed)
def log_user_login_failed(sender, credentials, request, **kwargs):
    username = credentials.get('username', 'Unknown')
    action_msg = f"Failed login attempt for username: {username}"
    user = CustomUser.objects.filter(username=username).first()
    
    SystemLog.objects.create(
        user=user,
        action=action_msg,
        type="alert"
    )
