import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from projects.models import Project, Task, BudgetCategory

User = get_user_model()
site_engineer = User.objects.filter(role='site-engineer').first()
if not site_engineer:
    site_engineer = User.objects.create_user(username='site_engineer_default', email='siteeng@test.com', password='password123', role='site-engineer')

if site_engineer:
    from projects.models import Location
    loc = Location.objects.first()
    project, _ = Project.objects.get_or_create(name='Riverside Mall Complex', location=loc, status='on-track')
    task1, _ = Task.objects.get_or_create(
        project=project,
        title='Inspect foundation reinforcement',
        location='Zone A',
        time_str='09:00 AM',
        priority='high',
        status='pending'
    )
    task2, _ = Task.objects.get_or_create(
        project=project,
        title='Verify concrete mix quality',
        location='Batching Plant',
        time_str='11:00 AM',
        priority='high',
        status='completed'
    )
    # Seed default budget categories
    categories = [
        {"name": "Labor", "description": "Wages and payroll expenses", "color": "#8b5cf6"},
        {"name": "Materials", "description": "Construction materials and supplies", "color": "#f97316"},
        {"name": "Equipment", "description": "Equipment rental and maintenance", "color": "#10b981"},
        {"name": "Overheads", "description": "Administrative and general expenses", "color": "#64748b"},
    ]
    for cat in categories:
        BudgetCategory.objects.get_or_create(name=cat["name"], defaults=cat)

    print("Data seeded")
else:
    print("No site engineer found to assign tasks to.")
