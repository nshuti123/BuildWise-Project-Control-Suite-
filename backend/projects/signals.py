from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Task, SubTask, PhaseTask
from .services import recalculate_project_progress, sync_phase_task_from_linked_tasks

@receiver(post_save, sender=Task)
@receiver(post_save, sender=SubTask)
def trigger_auto_assignment(sender, instance, created, **kwargs):
    """
    Auto-assignment is intentionally manual-only.
    Users must explicitly trigger assignment from the UI action.
    """
    return

@receiver([post_save, post_delete], sender=SubTask)
def auto_sync_parent_task_status(sender, instance, **kwargs):
    """
    If a SubTask is checked or unchecked, automatically update the parent Task's status
    so that progress calculations accurately reflect the checklist.
    """
    task = instance.parent_task
    if not task:
        return
        
    subtasks = task.subtasks.all()
    total = subtasks.count()
    if total > 0:
        completed = subtasks.filter(is_completed=True).count()
        
        # We need to use update() to avoid infinite recursion with the other signals,
        # but we must manually call the sync functions afterwards.
        old_status = task.status
        if completed < total and task.status == 'completed':
            task.status = 'in_progress' if completed > 0 else 'pending'
        elif completed == total and task.status != 'completed':
            task.status = 'completed'
            
        if old_status != task.status:
            # Avoid triggering post_save recursively
            Task.objects.filter(id=task.id).update(status=task.status)
            
            # Manually trigger phase task sync since we bypassed Task.save()
            if task.phase_task_id:
                try:
                    sync_phase_task_from_linked_tasks(task.phase_task)
                except Exception:
                    pass

@receiver([post_save, post_delete], sender=Task)
@receiver([post_save, post_delete], sender=SubTask)
def update_project_progress(sender, instance, **kwargs):
    try:
        if isinstance(instance, SubTask):
            project = instance.parent_task.project
        else:
            project = getattr(instance, 'project', None)
        if not project:
            return
    except Exception:
        # Related object may already be deleted during cascading operations.
        return

    # Keep timeline phase task status in sync with Task Management status changes.
    phase_task = None
    if isinstance(instance, Task) and instance.phase_task_id:
        phase_task = instance.phase_task
    elif isinstance(instance, SubTask) and instance.parent_task and instance.parent_task.phase_task_id:
        phase_task = instance.parent_task.phase_task

    if phase_task:
        try:
            sync_phase_task_from_linked_tasks(phase_task)
        except Exception:
            pass

    recalculate_project_progress(project)


@receiver(post_save, sender=PhaseTask)
@receiver(post_delete, sender=PhaseTask)
def update_project_progress_from_phase_task(sender, instance, **kwargs):
    if instance.project_id:
        recalculate_project_progress(instance.project)


from django.apps import apps



@receiver(post_save, sender='workforce.DailyPayroll')
def auto_log_payroll_transaction(sender, instance, created, **kwargs):
    Transaction = apps.get_model('projects', 'Transaction')
    BudgetCategory = apps.get_model('projects', 'BudgetCategory')

    if instance.status == 'paid':
        desc = f"Auto: Payroll for {instance.date}"
        if not Transaction.objects.filter(project=instance.project, description=desc).exists():
            category, _ = BudgetCategory.objects.get_or_create(
                name="Labor",
                defaults={"description": "Automatically generated for labor", "color": "#8b5cf6"}
            )
            Transaction.objects.create(
                project=instance.project,
                category=category,
                description=desc,
                amount=instance.total_amount,
                transaction_date=instance.date,
                status='approved',
                notes=f"Auto-generated from Paid DailyPayroll ID: {instance.id}"
            )
