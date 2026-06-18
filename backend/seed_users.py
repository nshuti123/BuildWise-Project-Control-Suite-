import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import CustomUser

password = 'password123'

ORG_TREE = [
    ('managing-director', 'managing-director@adroit.com', 'Managing Director', 'executive', None),
    ('director-finance', 'director-finance@adroit.com', 'Director of Finance', 'finance', 'managing-director'),
    ('technical-director', 'technical-director@adroit.com', 'Technical Director', 'technical', 'managing-director'),
    ('accountant', 'accountant@adroit.com', 'HQ Accountant', 'finance', 'director-finance'),
    ('project-manager', 'project-manager@adroit.com', 'Project Manager', 'technical', 'technical-director'),
    ('procurement-officer', 'procurement@adroit.com', 'Procurement Officer', 'site', 'project-manager'),
    ('site-engineer', 'site-engineer@adroit.com', 'Site Engineer', 'site', 'project-manager'),
    ('site-foreman', 'site-foreman@adroit.com', 'Site Foreman', 'site', 'site-engineer'),
    ('admin', 'admin@adroit.com', 'System Admin', 'executive', None),
    ('safety-officer', 'safety@adroit.com', 'Safety Officer', 'site', 'project-manager'),
    ('client', 'client@adroit.com', 'Client User', 'external', None),
    ('subcontractor', 'subcontractor@adroit.com', 'Subcontractor', 'external', None),
]

users_by_key = {}


def find_existing_user(username, email):
    """Match legacy rows by username or email (seed is safe to re-run)."""
    return (
        CustomUser.objects.filter(username=username).first()
        or CustomUser.objects.filter(email=email).first()
    )


for username, email, full_name, department, _reports_to in ORG_TREE:
    existing = find_existing_user(username, email)
    if existing:
        changed = []
        if existing.role != username:
            existing.role = username
            changed.append('role')
        if existing.department != department:
            existing.department = department
            changed.append('department')
        if full_name and existing.full_name != full_name:
            existing.full_name = full_name
            changed.append('full_name')
        if existing.email != email and not CustomUser.objects.filter(email=email).exclude(pk=existing.pk).exists():
            existing.email = email
            changed.append('email')
        if changed:
            existing.save(update_fields=changed)
            print(f"Updated {username} ({email}): {', '.join(changed)}")
        else:
            print(f"User {username} ({existing.email}) already up to date")
        users_by_key[username] = existing
        continue

    user = CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        role=username,
        full_name=full_name,
        department=department,
    )
    users_by_key[username] = user
    print(f"Created user: {username} ({email})")

for username, email, _full_name, _department, reports_to_username in ORG_TREE:
    user = users_by_key.get(username) or find_existing_user(username, email)
    if not user:
        continue
    if reports_to_username:
        manager = users_by_key.get(reports_to_username) or CustomUser.objects.filter(
            username=reports_to_username
        ).first()
        if manager and user.reports_to_id != manager.id:
            user.reports_to = manager
            user.save(update_fields=['reports_to'])
            print(f"Set {username} reports to {reports_to_username}")

print("Done. Default password for new users: password123")
