import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import CustomUser

roles = [
    'admin', 'project-manager', 'site-engineer', 'subcontractor',
    'procurement-officer', 'safety-officer', 'client'
]

password = 'password123'

for role in roles:
    email = f'{role}@adroit.com'
    username = role
    if not CustomUser.objects.filter(email=email).exists():
        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            full_name=f'Default {role.replace("-", " ").title()}'
        )
        print(f"Created user: {username} ({email}) with role: {role}")
    else:
        print(f"User {email} already exists")
