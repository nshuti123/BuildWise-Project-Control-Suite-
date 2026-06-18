from django.db.models import Count, Q
from workforce.models import Worker
from django.utils import timezone

from decimal import Decimal, InvalidOperation
import re


def parse_project_budget_to_decimal(budget_str):
    """
    Parse human-entered project budget strings into a Decimal amount in RWF.

    Accepts examples like:
    - "Rwf450M", "RWF 450M", "450M"
    - "450,000,000", "Rwf 450,000,000"
    - "450000000"

    Supports suffix multipliers: K, M, B (case-insensitive).
    Returns None when empty/unparseable.
    """
    if budget_str is None:
        return None
    s = str(budget_str).strip()
    if not s:
        return None

    # Remove currency labels and spaces (keep digits, separators, sign, decimal, suffix letters)
    s = re.sub(r"(?i)\brwf\b", "", s)
    s = s.replace(" ", "")

    # Extract numeric + optional suffix at end
    m = re.match(r"^([+-]?[\d,]*\.?\d*)([kKmMbB]?)$", s)
    if not m:
        # Try a more forgiving path: strip all non numeric-ish except suffix
        s2 = re.sub(r"[^0-9,.\-kKmMbB]", "", s)
        m = re.match(r"^([+-]?[\d,]*\.?\d*)([kKmMbB]?)$", s2)
        if not m:
            return None
    num_part, suffix = m.group(1), m.group(2)
    if not num_part:
        return None

    num_part = num_part.replace(",", "")
    try:
        n = Decimal(num_part)
    except (InvalidOperation, ValueError):
        return None

    mult = Decimal(1)
    if suffix:
        suffix = suffix.upper()
        if suffix == "K":
            mult = Decimal(1_000)
        elif suffix == "M":
            mult = Decimal(1_000_000)
        elif suffix == "B":
            mult = Decimal(1_000_000_000)

    return (n * mult).quantize(Decimal("0.01"))


def map_phase_status_to_task_status(phase_status: str) -> str:
    """PhaseTask timeline status → Task Management status."""
    if phase_status == 'completed':
        return 'completed'
    if phase_status in ('on-track', 'in_progress'):
        return 'in_progress'
    return 'pending'


def map_task_status_to_phase_status(task_status: str) -> str:
    """Task Management status → PhaseTask timeline status."""
    if task_status == 'completed':
        return 'completed'
    if task_status in ('in_progress', 'on-track'):
        return 'on-track'
    return 'pending'


def calculate_task_progress(task):
    """
    Compute task progress as a percentage.
    - If task has subtasks: based on completed subtasks ratio.
    - If no subtasks: fallback to task status.
    """
    # Explicit task completion always wins.
    if task.status == 'completed':
        return 100

    subtasks = task.subtasks.all()
    total_subtasks = subtasks.count()

    if total_subtasks > 0:
        completed_subtasks = subtasks.filter(
            Q(status='completed') | Q(is_completed=True)
        ).count()
        return int((completed_subtasks / total_subtasks) * 100)

    if task.status in ('in_progress', 'on-track'):
        return 50
    return 0


def recalculate_project_progress(project):
    """
    Recalculate project progress from the average progress of top-level PhaseTasks when present.

    Rationale:
    - Project schedule is represented by PhaseTasks (standard construction phases).
    - Each PhaseTask contributes equally to overall project progress.
    - PhaseTask progress/status is derived from linked Task/SubTask completion depending on tracking method.

    Fallback:
    - If a project has no PhaseTasks, compute from Task records as before.
    """
    phase_tasks = getattr(project, "phase_tasks", None)
    if phase_tasks is not None and phase_tasks.exists():
        pts = phase_tasks.all()
        total = pts.count()
        project_progress = int(sum(int(getattr(pt, "progress", 0) or 0) for pt in pts) / total) if total else 0
    else:
        tasks = project.tasks.all()
        total_tasks = tasks.count()
        if total_tasks == 0:
            project_progress = 0
        else:
            total_progress = sum(calculate_task_progress(task) for task in tasks)
            project_progress = int(total_progress / total_tasks)

    project.__class__.objects.filter(id=project.id).update(progress=project_progress)
    return project_progress


def sync_phase_task_from_linked_tasks(phase_task):
    """
    Keep PhaseTask timeline status/progress aligned with linked Task records.
    Task Management updates flow into the project timeline for manual and subtask tracking.
    """
    if phase_task.tracking_method == 'units':
        return

    linked_tasks = phase_task.sub_tasks.all()
    total_tasks = linked_tasks.count()
    if total_tasks == 0:
        return

    total_progress = sum(calculate_task_progress(task) for task in linked_tasks)
    next_progress = int(total_progress / total_tasks)
    next_status = map_task_status_to_phase_status(
        'completed' if next_progress == 100 else ('in_progress' if next_progress > 0 else 'pending')
    )

    updates = {}
    if phase_task.progress != next_progress:
        updates['progress'] = next_progress
    if phase_task.status != next_status:
        updates['status'] = next_status

    if updates:
        phase_task.__class__.objects.filter(id=phase_task.id).update(**updates)
        if phase_task.project_id:
            recalculate_project_progress(phase_task.project)


def sync_linked_tasks_from_phase_task(phase_task):
    """
    Mirror timeline PhaseTask fields onto linked Task rows without firing Task signals
    (avoids overwriting manual timeline progress right after save).
    """
    from .models import Task

    linked = list(Task.objects.filter(phase_task=phase_task))
    if not linked:
        return

    task_status = map_phase_status_to_task_status(phase_task.status)
    title = f"{phase_task.phase} - {phase_task.task_name}"
    for task in linked:
        Task.objects.filter(pk=task.pk).update(
            title=title,
            date=phase_task.start_date,
            status=task_status,
        )
        task.assigned_to.set(phase_task.assigned_to.all())

def auto_assign_task(task_instance, workers_needed=1, allow_overbook=False):
    """
    Automatically assigns a task or subtask to the active worker on the project
    who has the matching required_role and the fewest currently active tasks.
    """
    if not hasattr(task_instance, 'assigned_to'):
        return False, "Task model has no assigned_to attribute", False
        
    required_skills = getattr(task_instance, 'required_skills', [])
    # Also handle the case where it was saved as a string by accident
    if isinstance(required_skills, str):
        try:
            import json
            required_skills = json.loads(required_skills)
        except:
            required_skills = [required_skills]
            
    # Business rule: auto-assign requires at least one explicit required skill.
    if not required_skills:
        return False, "Set at least one required skill before using auto-assign.", False

    project = getattr(task_instance, 'project', None)
    if not project and hasattr(task_instance, 'parent_task'):
        project = task_instance.parent_task.project
        
    if not project:
        return False, "Task is not associated with any project.", False
        
    try:
        workers_needed = int(workers_needed)
    except (TypeError, ValueError):
        return False, "Invalid workers count. Please provide a valid number.", False

    if workers_needed <= 0:
        return False, "Workers needed must be at least 1.", False

    currently_assigned_ids = set(task_instance.assigned_to.values_list('id', flat=True))
    today = timezone.now().date()

    from django.db.models import Q, Count
    
    # 1. Base pool of skilled, active workers
    skilled_workers = Worker.objects.filter(
        project=project,
        role__in=required_skills,
        is_active=True,
    )
    
    total_skilled = skilled_workers.count()
    if total_skilled == 0:
        return False, f"No active workers found on this project with the required skills: {', '.join(required_skills)}.", False
        
    if total_skilled < workers_needed:
        return False, f"Only found {total_skilled} active worker(s) with the required skills, but {workers_needed} are needed.", False

    # 2. Filter by contract dates
    date_available_workers = skilled_workers.filter(
        Q(start_date__isnull=True) | Q(start_date__lte=today)
    ).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=today)
    )
    
    total_date_available = date_available_workers.count()
    if total_date_available < workers_needed:
        return False, f"Found {total_skilled} skilled worker(s), but {total_skilled - total_date_available} are unavailable today due to their contract start/end dates. Please check their dates in Workforce Management.", False

    # 3. Filter out those already assigned to this task
    candidate_workers = date_available_workers.exclude(id__in=currently_assigned_ids)

    available_count = candidate_workers.count()
    if available_count < workers_needed:
        return (
            False,
            f"Found {total_date_available} available skilled worker(s), but {total_date_available - available_count} are already assigned to this specific task.",
            False,
        )

    candidate_workers = candidate_workers.annotate(
        active_tasks_count=Count(
            'tasks',
            filter=Q(tasks__status__in=['pending', 'in_progress'])
        ) + Count(
            'assigned_subtasks',
            filter=Q(assigned_subtasks__status__in=['pending', 'in_progress'])
        )
    ).order_by('active_tasks_count', 'id')

    selected_workers = list(candidate_workers[:workers_needed])
    if not selected_workers:
        return False, "No matching active workers available for auto-assign.", False

    busy_workers = [w for w in selected_workers if getattr(w, 'active_tasks_count', 0) > 0]
    if busy_workers and not allow_overbook:
        busy_names = ", ".join(f"{w.first_name} {w.last_name}".strip() for w in busy_workers)
        return (
            False,
            f"These workers are already assigned to active tasks: {busy_names}. Do you want to proceed anyway?",
            True,
        )

    task_instance.assigned_to.add(*selected_workers)
    return True, f"Successfully auto-assigned {len(selected_workers)} worker(s).", False

def check_budget_limit(project, category_name, requested_amount, budget_item=None):
    """
    Ensure spending stays within allocated (planned) budget for the category.
    Raises ValidationError if nothing is allocated or remaining is insufficient.
    """
    from rest_framework.exceptions import ValidationError
    from .budget_allocation import (
        insufficient_allocated_message,
        require_category_budget_allocated,
    )

    if not project:
        return

    try:
        requested_amount = float(requested_amount or 0)
    except (ValueError, TypeError):
        return

    if requested_amount <= 0:
        return

    if budget_item is not None:
        require_category_budget_allocated(project, budget_item.category.name)
        remaining = float(budget_item.planned_amount or 0) - float(
            budget_item.actual_amount or 0
        )
        if requested_amount > remaining:
            label = budget_item.description or category_name or "budget item"
            raise ValidationError(
                insufficient_allocated_message(
                    budget_item.category.name, requested_amount, remaining
                )
            )
        return

    if not category_name:
        return

    summary = require_category_budget_allocated(project, category_name)
    if requested_amount > float(summary["remaining"]):
        raise ValidationError(
            insufficient_allocated_message(
                category_name, requested_amount, summary["remaining"]
            )
        )
