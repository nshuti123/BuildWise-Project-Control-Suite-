import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from projects.models import Project, PhaseTask, Task, SubTask
from projects.services import recalculate_project_progress

projects = Project.objects.all()
for project in projects:
    print(f"Project: {project.id} - {project.name}")
    print(f"Current DB Progress: {project.progress}%")
    
    pts = project.phase_tasks.all()
    print(f"Total PhaseTasks: {pts.count()}")
    for pt in pts:
        tasks = pt.sub_tasks.all()
        print(f"  PhaseTask {pt.id}: '{pt.phase}' | status={pt.status} | progress={pt.progress}% | tasks_count={tasks.count()}")
        for t in tasks:
            subs = t.subtasks.count()
            comp_subs = t.subtasks.filter(is_completed=True).count()
            print(f"    Task {t.id}: status={t.status} | subtasks={comp_subs}/{subs}")
            
    calc = recalculate_project_progress(project)
    print(f"Recalculated Progress: {calc}%")
    print("-" * 40)
