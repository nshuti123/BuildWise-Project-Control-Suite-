import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from projects.models import PhaseTask, Task

count = 0
for pt in PhaseTask.objects.all():
    if not Task.objects.filter(phase_task=pt).exists():
        Task.objects.create(
            project=pt.project,
            phase_task=pt,
            title=f"{pt.phase} - {pt.task_name}",
            date=pt.start_date,
            status=pt.status
        )
        count += 1

print(f"Backfilled {count} tasks successfully.")
