"""Automatic vs manual project health status."""

from datetime import timedelta

from django.utils import timezone

from .models import Project


def refresh_automatic_project_statuses(queryset=None):
    """
    Recompute status for projects that are not manually overridden.
    """
    today = timezone.now().date()
    warning_date = today + timedelta(days=7)

    base = queryset if queryset is not None else Project.objects.all()
    auto = base.filter(status_is_manual=False)

    auto.filter(progress__gte=100).exclude(status='completed').update(status='completed')

    auto.filter(
        deadline__lt=today,
        progress__lt=100,
    ).exclude(status='delayed').update(status='delayed')

    auto.filter(
        deadline__gte=today,
        deadline__lte=warning_date,
        progress__lt=80,
    ).exclude(status__in=['delayed', 'completed', 'at-risk']).update(status='at-risk')

    auto.filter(
        deadline__gt=warning_date,
        progress__lt=100,
    ).exclude(status__in=['on-track', 'delayed', 'completed']).update(status='on-track')


def user_can_set_project_status(user, project) -> bool:
    from users.services import user_has_full_access, user_has_technical_oversight
    from projects.staff_assignments import user_manages_project

    if user_has_full_access(user) or user_has_technical_oversight(user):
        return True
    if user_manages_project(user, project):
        return True
    return False
