import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from projects.models import Project, Task

User = get_user_model()
site_engineer = User.objects.filter(role='site-engineer').first()
if not site_engineer:
    site_engineer = User.objects.create_user(username='site_engineer_default', email='siteeng@test.com', password='password123', role='site-engineer')

if site_engineer:
    project, _ = Project.objects.get_or_create(name='Riverside Mall Complex', location='Zone A', status='active')
    Task.objects.get_or_create(
        project=project,
        assigned_to=site_engineer,
        title='Inspect foundation reinforcement',
        location='Zone A',
        time_str='09:00 AM',
        priority='high',
        status='pending'
    )
    Task.objects.get_or_create(
        project=project,
        assigned_to=site_engineer,
        title='Verify concrete mix quality',
        location='Batching Plant',
        time_str='11:00 AM',
        priority='high',
        status='completed'
    )
    print("Data seeded")
else:
    print("No site engineer found to assign tasks to.")
