import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from workforce.models import Worker

print("Printing all workers:")
for w in Worker.objects.all():
    print(f"[{w.id}] Project {w.project_id} - '{w.first_name}' '{w.last_name}'")
