"""Project staff assignment rules and approval-backed requests."""
import json

from django.utils import timezone

from users.services import (
    user_has_full_access,
    user_has_technical_oversight,
    resolve_project_manager_for_assignment,
)

# Project FK fields that reference staff users
STAFF_FIELD_ROLES = {
    'manager': 'project-manager',
    'site_engineer': 'site-engineer',
    'project_accountant': 'accountant',
    'procurement_officer': 'procurement-officer',
    'site_foreman': 'site-foreman',
}

# TD (or exec) assigns directly — no approval queue
TD_DIRECT_ASSIGN_FIELDS = frozenset({
    'manager',
    'site_engineer',
    'project_accountant',
})

# Site engineer on the project assigns field staff directly
SITE_ENGINEER_DIRECT_ASSIGN_FIELDS = frozenset({
    'procurement_officer',
    'site_foreman',
})

# PM proposes; Technical Director confirms
APPROVAL_ASSIGN_FIELDS = {
    'procurement_officer': {
        'requester_roles': frozenset({'project-manager'}),
        'approver_role': 'technical-director',
    },
}


def _parse_assignment_payload(approval):
    if not approval.description:
        return None
    try:
        data = json.loads(approval.description)
        if isinstance(data, dict) and data.get('assignment_field'):
            return data
    except (json.JSONDecodeError, TypeError):
        pass
    return None


def user_manages_project(user, project) -> bool:
    if not project or not project.manager_id:
        return False
    return project.manager_id == user.id


def user_is_project_accountant(user, project) -> bool:
    if not project or not getattr(project, 'project_accountant_id', None):
        return False
    return project.project_accountant_id == user.id


def user_is_site_engineer_on_project(user, project) -> bool:
    if not user or not project or not project.site_engineer_id:
        return False
    return getattr(user, 'role', None) == 'site-engineer' and project.site_engineer_id == user.id


def user_can_direct_assign_field(user, project, field: str) -> bool:
    if field not in STAFF_FIELD_ROLES:
        return False
    if user_has_full_access(user) or user_has_technical_oversight(user):
        return field in TD_DIRECT_ASSIGN_FIELDS or field in APPROVAL_ASSIGN_FIELDS
    if user_is_site_engineer_on_project(user, project):
        return field in SITE_ENGINEER_DIRECT_ASSIGN_FIELDS
    if field == 'manager':
        from users.services import user_can_assign_project_manager
        return user_can_assign_project_manager(user)
    return False


def fields_user_may_patch(user, project) -> frozenset:
    """Fields this user may set immediately on PATCH (no approval)."""
    if user_has_full_access(user) or user_has_technical_oversight(user):
        return frozenset(STAFF_FIELD_ROLES.keys())
    if user_is_site_engineer_on_project(user, project):
        return SITE_ENGINEER_DIRECT_ASSIGN_FIELDS
    return frozenset()


def fields_blocked_on_patch(user, project) -> frozenset:
    """Reject direct PATCH on these — use request-staff endpoint instead."""
    allowed = fields_user_may_patch(user, project)
    return frozenset(f for f in STAFF_FIELD_ROLES if f not in allowed)


def user_can_request_staff_assignment(user, project, field: str) -> bool:
    cfg = APPROVAL_ASSIGN_FIELDS.get(field)
    if not cfg:
        return False
    role = getattr(user, 'role', None)
    if role not in cfg['requester_roles']:
        return False
    if field == 'procurement_officer':
        return user_manages_project(user, project)
    return False


def resolve_staff_assignment_approver(project, field: str):
    from users.models import CustomUser

    cfg = APPROVAL_ASSIGN_FIELDS.get(field)
    if not cfg:
        return None
    if cfg['approver_role'] == 'technical-director':
        return CustomUser.objects.filter(role='technical-director', is_active=True).first()
    if cfg['approver_role'] == 'project-manager' and project.manager_id:
        return project.manager
    return None


def validate_candidate_for_field(user, field: str):
    expected = STAFF_FIELD_ROLES.get(field)
    if not user or not user.is_active:
        return False, 'User is not active.'
    if getattr(user, 'role', None) != expected:
        return False, f'Selected user must have role {expected}.'
    return True, ''


def create_staff_assignment_request(project, requester, field: str, candidate_id, notes=''):
    from users.models import CustomUser
    from approvals.services import create_approval_request

    if field not in APPROVAL_ASSIGN_FIELDS:
        return None, 'This assignment type requires approval workflow.'
    if not user_can_request_staff_assignment(requester, project, field):
        return None, 'You cannot request this assignment on this project.'

    try:
        candidate = CustomUser.objects.get(pk=int(candidate_id), is_active=True)
    except (CustomUser.DoesNotExist, ValueError, TypeError):
        return None, 'Invalid staff member selected.'

    ok, err = validate_candidate_for_field(candidate, field)
    if not ok:
        return None, err

    approver = resolve_staff_assignment_approver(project, field)
    if not approver:
        return None, 'No approver available for this assignment.'

    label = field.replace('_', ' ').title()
    payload = {
        'assignment_field': field,
        'candidate_id': candidate.id,
        'candidate_name': candidate.full_name or candidate.username,
    }
    approval = create_approval_request(
        request_type='staff_assignment',
        object_type='projects.Project',
        object_id=project.id,
        requested_by=requester,
        title=f'Assign {label}: {candidate.full_name or candidate.username}',
        description=json.dumps(payload),
        project=project,
        approver=approver,
    )
    if notes:
        approval.notes = notes
        approval.save(update_fields=['notes'])

    return approval, 'Assignment submitted for approval.'


def apply_staff_assignment(approval, reviewer):
    payload = _parse_assignment_payload(approval)
    if not payload:
        return False, 'Invalid assignment request data.'

    from projects.models import Project
    from users.models import CustomUser

    project = Project.objects.filter(pk=approval.object_id).first()
    if not project:
        return False, 'Project not found.'

    field = payload.get('assignment_field')
    candidate_id = payload.get('candidate_id')
    cfg = APPROVAL_ASSIGN_FIELDS.get(field)
    if not cfg:
        return False, 'Unknown assignment field.'

    role = getattr(reviewer, 'role', None)
    if cfg['approver_role'] == 'technical-director' and role != 'technical-director' and not user_has_full_access(reviewer):
        return False, 'Only Technical Director can approve this assignment.'
    if cfg['approver_role'] == 'project-manager':
        if not user_has_full_access(reviewer) and not user_manages_project(reviewer, project):
            return False, 'Only the Project Manager can approve this assignment.'

    try:
        candidate = CustomUser.objects.get(pk=int(candidate_id), is_active=True)
    except (CustomUser.DoesNotExist, ValueError, TypeError):
        return False, 'Candidate user no longer available.'

    ok, err = validate_candidate_for_field(candidate, field)
    if not ok:
        return False, err

    setattr(project, field, candidate)
    project.save(update_fields=[field])
    from users.services import sync_site_staff_reports_to
    sync_site_staff_reports_to(project)

    return True, f'{field.replace("_", " ").title()} assigned successfully.'


def user_can_review_staff_assignment(user, approval) -> bool:
    payload = _parse_assignment_payload(approval)
    if not payload:
        return False
    from projects.models import Project
    project = Project.objects.filter(pk=approval.object_id).first()
    if not project:
        return False
    field = payload.get('assignment_field')
    cfg = APPROVAL_ASSIGN_FIELDS.get(field)
    if not cfg:
        return False
    if user_has_full_access(user):
        return True
    role = getattr(user, 'role', None)
    if cfg['approver_role'] == 'technical-director':
        return role == 'technical-director'
    if cfg['approver_role'] == 'project-manager':
        return user_manages_project(user, project)
    return False
