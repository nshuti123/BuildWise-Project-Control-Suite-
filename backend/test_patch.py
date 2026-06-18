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

task = Task.objects.get(id=7)
payload = {
    "title": task.title,
    "description": task.description,
    "location": task.location,
    "date": task.date,
    "time_str": task.time_str,
    "priority": task.priority,
    "status": task.status,
    "project": task.project_id,
}
print(f"Testing via API on task ID: {task.id} with deleted assigned_to payload")
resp = client.patch(f'/api/projects/tasks/{task.id}/', payload, format='json')
if resp.status_code == 500:
    import traceback
    print("500 HTML OUTPUT:", resp.content.decode()[:1000])
else:
    print(f"HTTP {resp.status_code}")
    print(resp.json())
