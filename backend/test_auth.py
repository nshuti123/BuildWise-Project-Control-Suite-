import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
pw = "Testpass123"
user, _ = User.objects.get_or_create(username="testdeactivated", email="test@test.com")
user.set_password(pw)
user.is_active = False
user.save()

client = APIClient()
resp = client.post('/api/users/token/', {'username': 'testdeactivated', 'password': pw}, format='json')
print(f"Status Output: {resp.status_code}")
print(f"JSON Output: {resp.json()}")
