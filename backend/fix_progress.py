import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from projects.models import Project, Task
from projects.services import (
    map_phase_status_to_task_status,
    recalculate_project_progress,
    sync_phase_task_from_linked_tasks,
)

print("Normalizing invalid task statuses (on-track → in_progress)...")
invalid = Task.objects.filter(status='on-track')
for task in invalid:
    Task.objects.filter(pk=task.pk).update(
        status=map_phase_status_to_task_status('on-track'),
    )
print(f"  Fixed {invalid.count()} tasks.")

print("Fixing task statuses based on their subtasks...")

tasks = Task.objects.all()
fixed_count = 0

for task in tasks:
    subtasks = task.subtasks.all()
    total = subtasks.count()
    if total > 0:
        completed = subtasks.filter(is_completed=True).count()
        old_status = task.status
        
        if completed < total and task.status == 'completed':
            task.status = 'in_progress' if completed > 0 else 'pending'
        elif completed == total and task.status != 'completed':
            task.status = 'completed'
            
        if old_status != task.status:
            Task.objects.filter(id=task.id).update(status=task.status)
            fixed_count += 1
            if task.phase_task:
                sync_phase_task_from_linked_tasks(task.phase_task)

print(f"Fixed {fixed_count} task statuses.")

projects = Project.objects.all()
for p in projects:
    recalculate_project_progress(p)
    print(f"Project '{p.name}' true progress is now: {p.progress}%")
