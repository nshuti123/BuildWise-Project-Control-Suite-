"""Central helpers for writing admin-visible system audit logs."""

from .models import SystemLog


def client_ip(request) -> str | None:
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_system_event(
    action: str,
    *,
    user=None,
    log_type: str = 'system',
    timestamp=None,
) -> None:
    action = (action or '').strip()
    if not action:
        return
    if len(action) > 255:
        action = action[:252] + '...'
    log = SystemLog.objects.create(user=user, action=action, type=log_type)
    if timestamp is not None:
        SystemLog.objects.filter(pk=log.pk).update(timestamp=timestamp)


def log_user_login(user, *, request=None) -> None:
    ip = client_ip(request)
    ip_part = f' from {ip}' if ip else ''
    log_system_event(f'Logged in successfully{ip_part}', user=user, log_type='user')


def log_failed_login(username: str, *, request=None, reason: str = 'Invalid credentials') -> None:
    from .models import CustomUser

    ip = client_ip(request)
    ip_part = f' from {ip}' if ip else ''
    lookup = (username or 'Unknown').strip()
    user = CustomUser.objects.filter(username=lookup).first()
    if not user and '@' in lookup:
        user = CustomUser.objects.filter(email__iexact=lookup).first()
    log_system_event(
        f'Failed login attempt for username: {lookup}{ip_part} — {reason}',
        user=user,
        log_type='security',
    )


def log_report_generated(user, report_label: str, project=None) -> None:
    project_part = f' for project "{project.name}"' if project else ''
    log_system_event(
        f'Generated report: {report_label}{project_part}',
        user=user,
        log_type='user',
    )


def backfill_report_logs(*, dry_run: bool = False) -> int:
    """Create log entries for historical GeneratedReport rows missing from the audit trail."""
    from projects.models import GeneratedReport

    created = 0
    for report in (
        GeneratedReport.objects.select_related('created_by', 'project')
        .order_by('created_at')
    ):
        label = report.get_report_type_display() or report.report_type
        project_part = f' for project "{report.project.name}"' if report.project_id else ''
        action = f'Generated report: {label}{project_part}'
        if len(action) > 255:
            action = action[:252] + '...'

        exists = SystemLog.objects.filter(
            user=report.created_by,
            action=action,
            type='user',
        ).exists()
        if exists:
            continue

        if dry_run:
            created += 1
            continue

        log_system_event(
            action,
            user=report.created_by,
            log_type='user',
            timestamp=report.created_at,
        )
        created += 1
    return created


MOCK_LOG_ACTIONS = {
    'Automatic database backup completed successfully.',
    'Updated global safety protocols for Q2.',
    'Failed login attempt (Invalid Password).',
    'Created new project phase routing.',
    'Weekly performance report generated.',
}


def purge_mock_system_logs(*, dry_run: bool = False) -> int:
    """Remove seeded/demo log rows that are not real platform events."""
    qs = SystemLog.objects.filter(action__in=MOCK_LOG_ACTIONS)
    count = qs.count()
    if not dry_run and count:
        qs.delete()
    return count
