import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from projects.models import Task

User = get_user_model()
try:
    user = User.objects.get(username='admin')
except:
    user = User.objects.first()

client = APIClient()
client.force_authenticate(user=user)

# Let's get the active task, assign multiple workers, and see if it persists!
task = Task.objects.first()
print(f"Task original assigned_to: {list(task.assigned_to.values_list('id', flat=True))}")

payload = {'assigned_to': [1, 2, 3]}
resp = client.patch(f'/api/projects/tasks/{task.id}/', payload, format='json')
if resp.status_code == 200:
    print(f"Patched successfully.")
    task.refresh_from_db()
    print(f"Task NEW assigned_to: {list(task.assigned_to.values_list('id', flat=True))}")
else:
    print(resp.content)
