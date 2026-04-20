import sys
import os
import django

sys.path.append(r'c:\Users\NSHUTI\Desktop\BuildWise\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from workforce.serializers import WorkerSerializer
from workforce.models import Worker

w = Worker.objects.get(id=7)
data = WorkerSerializer(w).data
print("Original data:", data)

# Simulate frontend payload
data['start_date'] = None
data['end_date'] = None
data['project'] = 1

serializer = WorkerSerializer(w, data=data)
if not serializer.is_valid():
    print("VALIDATION ERRORS:", serializer.errors)
else:
    print("Serializer is perfectly valid.")
