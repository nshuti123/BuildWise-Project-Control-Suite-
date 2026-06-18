from datetime import date, timedelta

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Project, ProjectPhase, PhaseTask
from .phase_constants import STANDARD_CONSTRUCTION_PHASES
from .utils import add_working_days


def day_after(d: date) -> date:
    return d + timedelta(days=1)


def phase_duration_days(start: date, end: date) -> int:
    return (end - start).days + 1


def get_ordered_phases(project: Project):
    return list(ProjectPhase.objects.filter(project=project).order_by('order', 'id'))


def get_previous_phase(phase: ProjectPhase) -> ProjectPhase | None:
    return (
        ProjectPhase.objects.filter(project_id=phase.project_id, order__lt=phase.order)
        .order_by('-order', '-id')
        .first()
    )


def get_subsequent_phases(phase: ProjectPhase):
    return ProjectPhase.objects.filter(
        project_id=phase.project_id,
        order__gt=phase.order,
    ).order_by('order', 'id')


def validate_phase_date_range(start: date | None, end: date | None):
    if start and end and end < start:
        raise ValidationError({'end_date': 'End date cannot be before start date.'})


def validate_phase_sequence(
    project: Project,
    order: int,
    start: date | None,
    end: date | None,
    *,
    exclude_phase_id: int | None = None,
):
    validate_phase_date_range(start, end)
    if not start:
        return

    prev = (
        ProjectPhase.objects.filter(project=project, order__lt=order)
        .exclude(pk=exclude_phase_id)
        .order_by('-order', '-id')
        .first()
    )
    if prev and prev.end_date:
        min_start = day_after(prev.end_date)
        if start < min_start:
            raise ValidationError({
                'start_date': (
                    f'Must start on or after {min_start.isoformat()} '
                    f'(day after "{prev.name}" ends on {prev.end_date.isoformat()}).'
                ),
            })

    nxt = (
        ProjectPhase.objects.filter(project=project, order__gt=order)
        .exclude(pk=exclude_phase_id)
        .order_by('order', 'id')
        .first()
    )
    if nxt and nxt.start_date and end:
        max_end = nxt.start_date - timedelta(days=1)
        if end > max_end:
            raise ValidationError({
                'end_date': (
                    f'Must end on or before {max_end.isoformat()} '
                    f'so "{nxt.name}" can start on {nxt.start_date.isoformat()}.'
                ),
            })


def validate_tasks_fit_phase(phase: ProjectPhase, start: date | None, end: date | None):
    if not start and not end:
        return
    for task in phase.tasks.all():
        if not task.start_date:
            continue
        task_end = add_working_days(task.start_date, task.duration_working_days or 1)
        if start and task.start_date < start:
            raise ValidationError({
                'start_date': (
                    f'Cannot start before {start.isoformat()}: task '
                    f'"{task.task_name}" begins on {task.start_date.isoformat()}.'
                ),
            })
        if end and task_end and task_end > end:
            raise ValidationError({
                'end_date': (
                    f'Cannot end before {task_end.isoformat()}: task '
                    f'"{task.task_name}" runs until {task_end.isoformat()}.'
                ),
            })


def cascade_shift_subsequent_phases(phase: ProjectPhase, delta_days: int):
    if delta_days == 0:
        return
    delta = timedelta(days=delta_days)
    for later in get_subsequent_phases(phase):
        if later.start_date:
            later.start_date = later.start_date + delta
        if later.end_date:
            later.end_date = later.end_date + delta
        later.save(update_fields=['start_date', 'end_date', 'updated_at'])


def assign_default_schedule(project: Project, phases: list[ProjectPhase] | None = None):
    """Assign sequential non-overlapping calendar dates to phases without dates."""
    items = phases or get_ordered_phases(project)
    if not items:
        return

    today = date.today()
    if project.deadline and project.deadline > today:
        span = (project.deadline - today).days + 1
        days_each = max(7, span // len(items))
    else:
        days_each = 14

    current_start = today
    for phase in items:
        if phase.start_date and phase.end_date:
            current_start = day_after(phase.end_date)
            continue
        phase.start_date = current_start
        phase.end_date = current_start + timedelta(days=days_each - 1)
        phase.save(update_fields=['start_date', 'end_date', 'updated_at'])
        current_start = day_after(phase.end_date)


def suggest_phase_start(project: Project, order: int | None = None) -> date:
    if order is None:
        order = next_phase_order(project)
    prev = (
        ProjectPhase.objects.filter(project=project, order__lt=order)
        .order_by('-order', '-id')
        .first()
    )
    if prev and prev.end_date:
        return day_after(prev.end_date)
    return date.today()


def apply_phase_update(instance: ProjectPhase, validated_data: dict) -> ProjectPhase:
    old_end = instance.end_date

    for attr, value in validated_data.items():
        setattr(instance, attr, value)

    validate_phase_date_range(instance.start_date, instance.end_date)
    validate_phase_sequence(
        instance.project,
        instance.order,
        instance.start_date,
        instance.end_date,
        exclude_phase_id=instance.pk,
    )
    validate_tasks_fit_phase(instance, instance.start_date, instance.end_date)

    instance.save()

    if old_end and instance.end_date:
        delta_days = (instance.end_date - old_end).days
        if delta_days != 0:
            cascade_shift_subsequent_phases(instance, delta_days)

    return instance


def validate_task_against_phase(
    project_phase: ProjectPhase | None,
    start_date: date | None,
    duration_working_days: int,
):
    if not project_phase or not start_date:
        return
    if not project_phase.start_date or not project_phase.end_date:
        raise ValidationError({
            'project_phase': (
                f'Phase "{project_phase.name}" has no start/end dates. '
                'Set the phase schedule before adding tasks.'
            ),
        })
    task_end = add_working_days(start_date, duration_working_days or 1)
    if start_date < project_phase.start_date:
        raise ValidationError({
            'start_date': (
                f'Task cannot start before phase start ({project_phase.start_date.isoformat()}).'
            ),
        })
    if task_end > project_phase.end_date:
        raise ValidationError({
            'start_date': (
                f'Task ends on {task_end.isoformat()}, which exceeds phase end '
                f'({project_phase.end_date.isoformat()}). Shorten duration or adjust dates.'
            ),
        })


def seed_standard_phases(project: Project) -> tuple[int, list[ProjectPhase]]:
    created = 0
    phases: list[ProjectPhase] = []

    with transaction.atomic():
        for index, name in enumerate(STANDARD_CONSTRUCTION_PHASES, start=1):
            phase, was_created = ProjectPhase.objects.get_or_create(
                project=project,
                name=name,
                defaults={
                    'order': index,
                    'is_standard': True,
                },
            )
            if was_created:
                created += 1
            elif phase.order != index:
                phase.order = index
                phase.is_standard = True
                phase.save(update_fields=['order', 'is_standard'])
            phases.append(phase)

        assign_default_schedule(project, phases)
        sync_phase_tasks_to_phases(project)

    return created, phases


def sync_phase_tasks_to_phases(project: Project) -> int:
    linked = 0
    for task in PhaseTask.objects.filter(project=project, project_phase__isnull=True):
        phase_obj, _ = ProjectPhase.objects.get_or_create(
            project=project,
            name=task.phase,
            defaults={'order': ProjectPhase.objects.filter(project=project).count() + 1},
        )
        task.project_phase = phase_obj
        task.save(update_fields=['project_phase', 'phase'])
        linked += 1
    return linked


def next_phase_order(project: Project) -> int:
    last = (
        ProjectPhase.objects.filter(project=project)
        .order_by('-order')
        .values_list('order', flat=True)
        .first()
    )
    return (last or 0) + 1
