"""Aggregated metrics and activity feed for project manager dashboard."""
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone


def _activity_type_for_status(status: str) -> str:
    if status in ('approved', 'completed', 'on-track', 'fulfilled'):
        return 'success'
    if status in ('rejected', 'delayed', 'at-risk'):
        return 'warning'
    return 'info'


def build_recent_activity(project, limit=12):
    """Merge recent project events into a single timeline."""
    from projects.models import Task, Transaction, Milestone, SiteIncident
    from procurement.models import MaterialRequest
    from approvals.models import ApprovalRequest

    entries = []
    project_name = project.name

    for txn in Transaction.objects.filter(project=project).select_related('category').order_by(
        '-transaction_date', '-created_at'
    )[:10]:
        ts = txn.transaction_date or txn.created_at.date()
        if hasattr(ts, 'isoformat'):
            stamp = f'{ts}T12:00:00' if not hasattr(ts, 'hour') else ts.isoformat()
        else:
            stamp = txn.created_at.isoformat()
        cat = txn.category.name if txn.category_id else 'Expense'
        entries.append({
            'action': f'Expense {txn.get_status_display().lower()}',
            'detail': (txn.description or cat)[:120],
            'project': project_name,
            'timestamp': stamp,
            'type': _activity_type_for_status(txn.status),
        })

    for task in Task.objects.filter(project=project).order_by('-updated_at')[:10]:
        entries.append({
            'action': f'Task {task.get_status_display().lower()}',
            'detail': task.title,
            'project': project_name,
            'timestamp': task.updated_at.isoformat(),
            'type': _activity_type_for_status(task.status),
        })

    for mr in MaterialRequest.objects.filter(project=project).select_related('material').order_by(
        '-created_at'
    )[:8]:
        entries.append({
            'action': f'Material request {mr.get_status_display().lower()}',
            'detail': f'{mr.material.name} × {mr.quantity_requested}',
            'project': project_name,
            'timestamp': mr.created_at.isoformat(),
            'type': _activity_type_for_status(mr.status),
        })

    for inc in SiteIncident.objects.filter(project=project).order_by('-date_reported')[:6]:
        ts = inc.date_reported
        stamp = (
            f'{ts.isoformat()}T12:00:00'
            if ts
            else timezone.now().isoformat()
        )
        entries.append({
            'action': f'Site incident {inc.get_status_display().lower()}',
            'detail': (inc.description or inc.get_incident_type_display())[:120],
            'project': project_name,
            'timestamp': stamp,
            'type': 'warning' if inc.status != 'resolved' else 'success',
        })

    for ar in ApprovalRequest.objects.filter(project=project).exclude(status='pending').order_by(
        '-resolved_at', '-created_at'
    )[:8]:
        ts = ar.resolved_at or ar.created_at
        entries.append({
            'action': ar.title,
            'detail': ar.get_status_display(),
            'project': project_name,
            'timestamp': ts.isoformat(),
            'type': _activity_type_for_status(ar.status),
        })

    for ms in Milestone.objects.filter(project=project).order_by('-updated_at')[:5]:
        if ms.status == 'completed':
            entries.append({
                'action': 'Milestone completed',
                'detail': getattr(ms, 'title', None) or ms.name,
                'project': project_name,
                'timestamp': ms.updated_at.isoformat(),
                'type': 'success',
            })

    entries.sort(key=lambda e: e.get('timestamp') or '', reverse=True)
    return entries[:limit]


def build_project_overview(project):
    from projects.models import Task, Milestone, Transaction
    from projects.serializers import ProjectSerializer, MilestoneSerializer
    from workforce.models import Worker

    today = timezone.now().date()
    soon = today + timedelta(days=1)

    tasks_qs = Task.objects.filter(project=project)
    task_stats = tasks_qs.aggregate(
        total=Count('id'),
        completed=Count('id', filter=Q(status='completed')),
        in_progress=Count('id', filter=Q(status='in_progress')),
        pending=Count('id', filter=Q(status='pending')),
        overdue=Count(
            'id',
            filter=Q(status__in=['pending', 'in_progress'], date__lt=today),
        ),
        due_soon=Count(
            'id',
            filter=Q(status__in=['pending', 'in_progress'], date__in=[today, soon]),
        ),
    )

    total_tasks = task_stats['total'] or 0
    completed_tasks = task_stats['completed'] or 0
    task_completion_pct = round((completed_tasks / total_tasks) * 100) if total_tasks else 0

    milestones_qs = Milestone.objects.filter(project=project).order_by('date', 'id')
    milestone_completed = milestones_qs.filter(status='completed').count()

    approved_spend = (
        Transaction.objects.filter(project=project, status='approved').aggregate(
            total=Sum('amount')
        )['total']
        or 0
    )

    team_size = Worker.objects.filter(project=project, is_active=True).count()

    return {
        'metrics': {
            'budget_amount': float(project.budget_amount) if project.budget_amount else None,
            'budget_label': project.budget or '',
            'approved_spend': float(approved_spend),
            'team_size': team_size,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': task_stats['in_progress'] or 0,
            'pending_tasks': task_stats['pending'] or 0,
            'task_completion_pct': task_completion_pct,
            'overdue_tasks': task_stats['overdue'] or 0,
            'due_soon_tasks': task_stats['due_soon'] or 0,
            'milestones_total': milestones_qs.count(),
            'milestones_completed': milestone_completed,
            'progress': project.progress,
            'status': project.status,
        },
        'milestones': MilestoneSerializer(milestones_qs, many=True).data,
        'recent_activity': build_recent_activity(project),
    }
