import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import SystemLog, CustomUser

def seed_logs():
    SystemLog.objects.all().delete()
    
    admin = CustomUser.objects.filter(role='admin').first()
    pm = CustomUser.objects.filter(role='project-manager').first()

    logs = [
        {"user": None, "action": "Automatic database backup completed successfully.", "type": "system"},
        {"user": admin, "action": "Updated global safety protocols for Q2.", "type": "security"},
        {"user": pm, "action": "Failed login attempt (Invalid Password).", "type": "alert"},
        {"user": admin, "action": "Created new project phase routing.", "type": "user"},
        {"user": None, "action": "Weekly performance report generated.", "type": "system"}
    ]
    
    for l in logs:
        SystemLog.objects.create(user=l['user'], action=l['action'], type=l['type'])
        
    print("Seed complete. Added mock SystemLogs.")

if __name__ == "__main__":
    seed_logs()
