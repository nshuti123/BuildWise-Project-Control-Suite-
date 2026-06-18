from django.db.models import Q

FULL_ACCESS_ROLES = frozenset({
    'managing-director',
    'admin',
})

EXECUTIVE_ROLES = frozenset({
    'managing-director',
    'director-finance',
    'technical-director',
})


def user_has_full_access(user) -> bool:
    """Managing Director / System Admin — unrestricted read, write, and approval."""
    return getattr(user, 'role', None) in FULL_ACCESS_ROLES


def user_has_technical_oversight(user) -> bool:
    """Technical Director — company-wide technical portfolio, projects, and site org."""
    return getattr(user, 'role', None) == 'technical-director'


def user_can_view_all_users(user) -> bool:
    """Read-only directory of every account (Technical Director)."""
    return user_has_full_access(user) or user_has_technical_oversight(user)


def user_can_manage_users(user) -> bool:
    """Create, update, or deactivate user accounts."""
    return user_has_full_access(user)


def user_can_create_project(user) -> bool:
    """New construction projects are initiated by the Technical Director (or system admin)."""
    return user_has_technical_oversight(user) or getattr(user, 'role', None) == 'admin'


def user_can_assign_project_manager(user) -> bool:
    return user_has_full_access(user) or user_has_technical_oversight(user)


def resolve_project_manager_for_assignment(actor, manager_id):
    """
    Return an active project-manager user if the actor may assign them to a project.
    Technical Directors may only assign PMs who report to them.
    """
    from users.models import CustomUser

    if not manager_id:
        return None
    try:
        pm = CustomUser.objects.get(pk=int(manager_id), role='project-manager', is_active=True)
    except (CustomUser.DoesNotExist, ValueError, TypeError):
        return None

    if user_has_full_access(actor):
        return pm
    if user_has_technical_oversight(actor):
        if pm.reports_to_id == actor.id:
            return pm
        return None
    return None


ROLES_MANAGEABLE_BY_TECHNICAL_DIRECTOR = frozenset({
    'project-manager',
    'procurement-officer',
    'site-engineer',
    'site-foreman',
    'safety-officer',
    'subcontractor',
})


def technical_director_may_manage_user(actor, target_user=None, role=None) -> bool:
    if not user_has_technical_oversight(actor):
        return False
    effective_role = role or getattr(target_user, 'role', None)
    if effective_role not in ROLES_MANAGEABLE_BY_TECHNICAL_DIRECTOR:
        return False
    if target_user is None:
        return True
    if target_user.id == actor.id:
        return False
    sub_ids = get_subordinate_user_ids(actor)
    return (
        target_user.reports_to_id == actor.id
        or target_user.id in sub_ids
    )

COMPANY_WIDE_READ_ROLES = frozenset({
    'admin',
    'managing-director',
    'director-finance',
    'technical-director',
    'accountant',
})

SITE_STAFF_ROLES = frozenset({
    'site-engineer',
    'site-foreman',
    'procurement-officer',
})

APPROVAL_REQUIRED_ROLES = frozenset({
    'site-foreman',
    'site-engineer',
    'procurement-officer',
})

FINANCE_APPROVER_ROLES = frozenset({
    'accountant',
    'director-finance',
    'managing-director',
    'admin',
})

TECHNICAL_APPROVAL_TYPES = frozenset({
    'material_request',
    'purchase_order',
    'task_complete',
    'incident',
    'allocation',
    'staff_assignment',
})

BASELINE_EDITOR_ROLES = frozenset({
    'managing-director',
    'admin',
    'technical-director',
    'project-manager',
})

ROLE_DEFAULT_REPORTS_TO = {
    'accountant': 'director-finance',
    'project-manager': 'technical-director',
    'director-finance': 'managing-director',
    'technical-director': 'managing-director',
    'procurement-officer': 'project-manager',
    'site-engineer': 'project-manager',
    'site-foreman': 'site-engineer',
}


def user_requires_approval(user) -> bool:
    return getattr(user, 'role', None) in APPROVAL_REQUIRED_ROLES


def can_approve_for_role(user) -> bool:
    if user_has_full_access(user):
        return True
    role = getattr(user, 'role', None)
    return role in (
        'site-engineer',
        'project-manager',
        'technical-director',
        'director-finance',
        'accountant',
    )


def get_finance_escalation_threshold() -> float:
    from django.conf import settings
    return float(getattr(settings, 'BUILDWISE_FINANCE_ESCALATION_THRESHOLD', 5_000_000))


def transaction_requires_finance_escalation(transaction) -> bool:
    if transaction is None:
        return False
    return float(transaction.amount or 0) >= get_finance_escalation_threshold()


def user_can_edit_schedule_baseline(user, project=None) -> bool:
    """Schedule baseline snapshots: TD, PM (own project), MD, Admin only."""
    if user_has_full_access(user) or user_has_technical_oversight(user):
        return True
    role = getattr(user, 'role', None)
    if role == 'project-manager':
        if project is None:
            return True
        return project.manager_id == user.id
    return False


def can_approve_transaction(user, transaction=None) -> bool:
    """Financial transaction approval — not delegated to Technical Director."""
    if user_has_full_access(user):
        return True
    role = getattr(user, 'role', None)
    if role in ('director-finance', 'accountant'):
        return True
    if role == 'project-manager' and transaction is not None:
        if transaction_requires_finance_escalation(transaction):
            return False
        if transaction.project_id and transaction.project.manager_id == user.id:
            return True
    return False


def can_delete_transaction(user) -> bool:
    """Remove entries from transaction history (finance oversight)."""
    if user_has_full_access(user):
        return True
    return getattr(user, 'role', None) == 'director-finance'


def projects_queryset_for_user(user):
    from projects.models import Project

    role = getattr(user, 'role', None)
    if role in COMPANY_WIDE_READ_ROLES:
        return Project.objects.all()
    if role == 'project-manager':
        return Project.objects.filter(manager=user)
    if role == 'accountant':
        return Project.objects.filter(project_accountant=user)
    if role == 'site-engineer':
        return Project.objects.filter(site_engineer=user)
    if role == 'procurement-officer':
        return Project.objects.all()
    if role == 'site-foreman':
        return Project.objects.filter(site_foreman=user)
    if role == 'subcontractor':
        return Project.objects.filter(subcontractors=user)
    if role == 'safety-officer':
        return Project.objects.all()
    if role == 'client':
        return Project.objects.none()
    return Project.objects.none()


def project_filter_q_for_user(user):
    project_ids = projects_queryset_for_user(user).values_list('id', flat=True)
    return Q(project_id__in=project_ids) | Q(project__in=project_ids)


def get_subordinate_user_ids(user):
    """All users in the reporting subtree (direct and indirect reports)."""
    from users.models import CustomUser

    subordinate_ids = set()
    frontier = list(
        CustomUser.objects.filter(reports_to=user).values_list('id', flat=True)
    )
    while frontier:
        subordinate_ids.update(frontier)
        frontier = list(
            CustomUser.objects.filter(reports_to_id__in=frontier).values_list('id', flat=True)
        )
    return subordinate_ids


def resolve_procurement_officer_for_project(project):
    """Procurement Officer who handles first-tier material request approval."""
    from users.models import CustomUser

    if project and project.procurement_officer_id:
        return project.procurement_officer
    if project and project.manager_id:
        po = CustomUser.objects.filter(
            role='procurement-officer',
            reports_to_id=project.manager_id,
            is_active=True,
        ).first()
        if po:
            return po
    return CustomUser.objects.filter(role='procurement-officer', is_active=True).first()


def resolve_approver(user, project=None):
    from users.models import CustomUser

    if user.reports_to_id:
        return user.reports_to

    if project and project.manager_id:
        return project.manager

    fallback_role = ROLE_DEFAULT_REPORTS_TO.get(user.role)
    if fallback_role:
        approver = CustomUser.objects.filter(role=fallback_role, is_active=True).first()
        if approver:
            return approver

    if user.role in ('site-engineer', 'site-foreman', 'procurement-officer'):
        if project and project.manager:
            return project.manager
        pm = CustomUser.objects.filter(role='project-manager', is_active=True).first()
        if pm:
            return pm

    return CustomUser.objects.filter(role='managing-director', is_active=True).first()


def sync_site_staff_reports_to(project):
    """When site staff are assigned on a project, set their line manager to the PM."""
    if not project.manager_id:
        return
    from users.models import CustomUser

    site_user_ids = [
        project.site_engineer_id,
        project.procurement_officer_id,
        project.site_foreman_id,
    ]
    if getattr(project, 'project_accountant_id', None):
        pa = CustomUser.objects.filter(pk=project.project_accountant_id).first()
        if pa and pa.role == 'accountant' and not pa.reports_to_id:
            pa.reports_to_id = project.manager_id
            pa.department = 'finance'
            pa.save(update_fields=['reports_to', 'department'])
    for uid in site_user_ids:
        if not uid:
            continue
        user = CustomUser.objects.filter(pk=uid).first()
        if user and user.role in SITE_STAFF_ROLES and user.role != 'site-engineer':
            if not user.reports_to_id or user.reports_to_id == project.manager_id:
                user.reports_to_id = project.manager_id
                user.department = 'site'
                user.save(update_fields=['reports_to', 'department'])
        elif user and user.role == 'site-engineer':
            if not user.reports_to_id:
                user.reports_to_id = project.manager_id
                user.department = 'site'
                user.save(update_fields=['reports_to', 'department'])

    if project.site_foreman_id and project.site_engineer_id:
        foreman = CustomUser.objects.filter(pk=project.site_foreman_id).first()
        if foreman and not foreman.reports_to_id:
            foreman.reports_to_id = project.site_engineer_id
            foreman.save(update_fields=['reports_to'])
