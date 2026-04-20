import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()
user, _ = User.objects.get_or_create(username='testdeact', email='td@test.com')
user.set_password('Tpass123')
user.is_active = False
user.save()
print("Done")
