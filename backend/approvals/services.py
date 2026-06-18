from django.utils import timezone

from users.notification_utils import create_notification
from users.services import (
    resolve_approver,
    user_requires_approval,
    FINANCE_APPROVER_ROLES,
    user_has_full_access,
    user_has_technical_oversight,
    TECHNICAL_APPROVAL_TYPES,
)

# TD oversight feed — visible in history (highlighted), no TD action required
PROCUREMENT_OVERSIGHT_TYPES = frozenset({'material_request', 'purchase_order'})


def create_approval_request(
    *,
    request_type,
    object_type,
    object_id,
    requested_by,
    title,
    description='',
    project=None,
    approver=None,
):
    from approvals.models import ApprovalRequest

    if approver is None:
        approver = resolve_approver(requested_by, project=project)

    approval = ApprovalRequest.objects.create(
        request_type=request_type,
        object_type=object_type,
        object_id=object_id,
        project=project,
        requested_by=requested_by,
        approver=approver,
        title=title,
        description=description,
    )

    if approver:
        link = _approval_notification_link_for_approver(request_type, approver=approver)
        create_notification(
            user=approver,
            title='Approval required',
            message=f'{requested_by.full_name or requested_by.username} submitted: {title}',
            link=link,
            project=project,
        )

    return approval


def should_route_through_approval(user) -> bool:
    return user_requires_approval(user)


def _material_request_for_approval(approval):
    from procurement.models import MaterialRequest

    return (
        MaterialRequest.objects.filter(pk=approval.object_id)
        .select_related('requested_by', 'project', 'project__site_engineer')
        .first()
    )


def _foreman_material_request_needs_se_confirm(material_request) -> bool:
    if not material_request:
        return False
    return (
        getattr(material_request.requested_by, 'role', None) == 'site-foreman'
        and not material_request.site_engineer_confirmed_at
    )


def user_can_review_approval(user, approval) -> bool:
    if approval.status not in ('pending', 'po_approved'):
        return False
    if approval.request_type == 'material_request':
        subject = get_approval_subject_status(approval)
        if subject in ('approved', 'fulfilled', 'ordered', 'rejected'):
            return False
        mr = _material_request_for_approval(approval)
        if _foreman_material_request_needs_se_confirm(mr):
            if getattr(user, 'role', None) == 'procurement-officer':
                return False
            if mr.project and mr.project.site_engineer_id == user.id:
                return True
            return False
    if approval.request_type == 'staff_assignment':
        from projects.staff_assignments import user_can_review_staff_assignment
        return user_can_review_staff_assignment(user, approval)
    if approval.status == 'po_approved':
        if approval.request_type == 'material_request':
            if user_has_full_access(user):
                return True
            if user_has_technical_oversight(user):
                return True
            return (
                getattr(user, 'role', None) == 'project-manager'
                and approval.project_id
                and approval.project.manager_id == user.id
            )
        return user_has_full_access(user) or user_has_technical_oversight(user)
    if user_has_full_access(user):
        return True
    if approval.approver_id == user.id:
        return True
    if getattr(user, 'role', None) == 'procurement-officer' and approval.request_type in (
        'material_request', 'purchase_order',
    ):
        if approval.request_type == 'material_request':
            mr = _material_request_for_approval(approval)
            if _foreman_material_request_needs_se_confirm(mr):
                return False
        return True
    if user.role == 'technical-director' and approval.request_type in (
        'task_complete', 'material_request', 'purchase_order', 'incident', 'allocation',
    ):
        return True
    if user.role in FINANCE_APPROVER_ROLES and approval.request_type in ('transaction',):
        return True
    if user.role == 'project-manager' and approval.project and approval.project.manager_id == user.id:
        return True
    from users.services import get_subordinate_user_ids
    return approval.requested_by_id in get_subordinate_user_ids(user)


def _log_approval_audit(approval, reviewer, action_label):
    from users.models import SystemLog
    role_label = reviewer.get_role_display() if hasattr(reviewer, 'get_role_display') else reviewer.role
    name = reviewer.full_name or reviewer.username
    SystemLog.objects.create(
        user=reviewer,
        action=f'{action_label}: {approval.title} (by {name}, {role_label})',
        type='user',
    )


def _approval_notification_link_for_approver(request_type, approver=None):
    """Module path for the person who must review the request."""
    if request_type == 'transaction':
        return 'budget'
    if request_type == 'purchase_order':
        return 'procurement'
    if request_type == 'material_request':
        if approver and getattr(approver, 'role', None) == 'site-engineer':
            return 'site-inventory'
        return 'procurement'
    if request_type == 'staff_assignment':
        return 'technical-approvals'
    if request_type in TECHNICAL_APPROVAL_TYPES:
        return 'technical-approvals'
    return 'technical-approvals'


def _approval_notification_link_for_submitter(approval):
    """Module path for the person who submitted the request (outcome notification)."""
    if approval.request_type == 'transaction':
        return 'budget'
    if approval.request_type in ('material_request', 'allocation'):
        return 'site-inventory'
    if approval.request_type == 'purchase_order':
        return 'procurement'
    if approval.request_type == 'task_complete':
        return 'tasks'
    if approval.request_type == 'incident':
        return 'safety'
    if approval.request_type in TECHNICAL_APPROVAL_TYPES:
        return 'technical-approvals'
    return 'dashboard'


def _resolve_technical_director_for_project(project):
    from users.models import CustomUser

    if project and project.manager_id and project.manager.reports_to_id:
        lead = project.manager.reports_to
        if lead.role == 'technical-director' and lead.is_active:
            return lead
    return CustomUser.objects.filter(role='technical-director', is_active=True).first()


def _notify_technical_director_procurement_activity(project, title, message):
    """TD visibility only — no approval action required."""
    td = _resolve_technical_director_for_project(project)
    if td:
        create_notification(
            user=td,
            title=title,
            message=message,
            link='technical-approvals',
            project=project,
        )


def _notify_procurement_officer_material_confirmed(material_request, reviewer, approval=None):
    """Tell the PO who first-approved the request that PM/TD confirmed and stock moved."""
    from users.services import resolve_procurement_officer_for_project

    po = None
    if approval and approval.procurement_reviewer_id:
        po = approval.procurement_reviewer
    if not po:
        po = resolve_procurement_officer_for_project(material_request.project)
    if not po or po.id == reviewer.id:
        return

    role_label = reviewer.get_role_display()
    project_name = material_request.project.name if material_request.project_id else 'the project'
    create_notification(
        user=po,
        title='Material request confirmed',
        message=(
            f'{reviewer.full_name or reviewer.username} ({role_label}) confirmed '
            f'"{material_request.material.name}" for {project_name}. '
            f'Warehouse stock was deducted and site inventory was updated.'
        ),
        link='procurement',
        project=material_request.project,
    )


def _material_request_approval_row(material_request, statuses=('pending',)):
    from approvals.models import ApprovalRequest

    return ApprovalRequest.objects.filter(
        request_type='material_request',
        object_id=material_request.id,
        status__in=statuses,
    ).order_by('-created_at').first()


def get_approval_subject_status(approval):
    """Live status of the underlying business object (may differ from approval row)."""
    if approval.request_type == 'material_request':
        from procurement.models import MaterialRequest

        return (
            MaterialRequest.objects.filter(pk=approval.object_id)
            .values_list('status', flat=True)
            .first()
        )
    if approval.request_type == 'purchase_order':
        from procurement.models import PurchaseOrder

        return (
            PurchaseOrder.objects.filter(pk=approval.object_id)
            .values_list('status', flat=True)
            .first()
        )
    if approval.request_type == 'transaction':
        from projects.models import Transaction

        return (
            Transaction.objects.filter(pk=approval.object_id)
            .values_list('status', flat=True)
            .first()
        )
    if approval.request_type == 'task_complete':
        from projects.models import Task

        return (
            Task.objects.filter(pk=approval.object_id)
            .values_list('status', flat=True)
            .first()
        )
    return None


def reconcile_stale_approval_rows(queryset=None):
    """
    Fix approval rows left pending/po_approved when the linked record was already processed.
  """
    from approvals.models import ApprovalRequest
    from procurement.models import MaterialRequest

    qs = queryset if queryset is not None else ApprovalRequest.objects.all()
    stale = list(
        qs.filter(
            request_type='material_request',
            status__in=('pending', 'po_approved'),
        ).values_list('id', 'object_id', 'status')
    )
    if not stale:
        return 0

    mr_status = dict(
        MaterialRequest.objects.filter(
            id__in={row[1] for row in stale},
        ).values_list('id', 'status')
    )
    now = timezone.now()
    fixed = 0
    for appr_id, obj_id, appr_status in stale:
        subject = mr_status.get(obj_id)
        if not subject:
            continue
        if subject in ('approved', 'fulfilled', 'ordered') and appr_status != 'approved':
            ApprovalRequest.objects.filter(pk=appr_id).update(
                status='approved',
                resolved_at=now,
                updated_at=now,
            )
            fixed += 1
        elif subject == 'rejected' and appr_status != 'rejected':
            ApprovalRequest.objects.filter(pk=appr_id).update(
                status='rejected',
                resolved_at=now,
                updated_at=now,
            )
            fixed += 1
        elif subject == 'cancelled' and appr_status != 'rejected':
            ApprovalRequest.objects.filter(pk=appr_id).update(
                status='rejected',
                resolved_at=now,
                updated_at=now,
            )
            fixed += 1
        elif subject == 'po_approved' and appr_status == 'pending':
            ApprovalRequest.objects.filter(pk=appr_id).update(
                status='po_approved',
                updated_at=now,
            )
            fixed += 1
    return fixed


def _close_material_request_approval_if_already_done(material_request, reviewer, approval=None):
    """Material request already fulfilled — sync approval row and succeed."""
    from approvals.models import ApprovalRequest

    approval = approval or _material_request_approval_row(
        material_request, ('pending', 'po_approved'),
    )
    if not approval:
        return True, 'Already approved and stock updated'

    if approval.status not in ('approved', 'rejected'):
        approval.status = (
            'rejected' if material_request.status == 'rejected' else 'approved'
        )
        approval.approver = approval.approver or reviewer
        approval.resolved_at = approval.resolved_at or timezone.now()
        approval.save(
            update_fields=['status', 'approver', 'resolved_at', 'updated_at'],
        )
    return True, 'Already approved and stock updated'


def _material_request_finalizers():
    """Roles that may confirm after procurement approval or approve pending directly."""
    return frozenset({'project-manager', 'technical-director'})


def site_engineer_confirm_material_request(material_request, se_user, notes='', approval=None):
    """Site Engineer confirms a foreman request — forwards to Procurement Officer."""
    from users.services import resolve_procurement_officer_for_project

    if material_request.status in ('approved', 'fulfilled', 'ordered', 'rejected'):
        return _close_material_request_approval_if_already_done(
            material_request, se_user, approval=approval,
        )

    if getattr(material_request.requested_by, 'role', None) != 'site-foreman':
        return False, 'Only foreman requests require site engineer confirmation.'

    if material_request.site_engineer_confirmed_at:
        return False, 'This request was already confirmed by the site engineer.'

    if material_request.status != 'pending':
        return False, 'Request is not pending site engineer review.'

    project = material_request.project
    if not project or project.site_engineer_id != se_user.id:
        return False, 'You are not the site engineer for this project.'

    po = resolve_procurement_officer_for_project(project)
    if not po:
        return False, 'No procurement officer is assigned for this project.'

    audit_note = notes.strip() if notes else ''
    approval = approval or _material_request_approval_row(material_request, ('pending',))
    if not approval:
        return False, 'No pending approval found for this requisition.'

    material_request.site_engineer_confirmed_by = se_user
    material_request.site_engineer_confirmed_at = timezone.now()
    material_request.save(
        update_fields=['site_engineer_confirmed_by', 'site_engineer_confirmed_at', 'updated_at'],
    )

    approval.approver = po
    approval.notes = audit_note
    approval.save(update_fields=['approver', 'notes', 'updated_at'])

    se_name = se_user.full_name or se_user.username
    material_label = material_request.material.name
    project_name = project.name

    _log_approval_audit(approval, se_user, 'Site Engineer confirmed')

    create_notification(
        user=material_request.requested_by,
        title='Material request confirmed',
        message=(
            f'{se_name} confirmed your request for {material_label} on {project_name}. '
            f'It has been sent to Procurement for approval.'
        ),
        link='site-inventory',
        project=project,
    )

    create_notification(
        user=se_user,
        title='Material request forwarded',
        message=(
            f'You confirmed {material_request.requested_by.full_name or material_request.requested_by.username}\'s '
            f'request for {material_label} on {project_name}. '
            f'Procurement has been notified to review it.'
        ),
        link='site-inventory',
        project=project,
    )

    create_notification(
        user=po,
        title='Approval required',
        message=(
            f'{se_name} confirmed a foreman material request for {material_label} on {project_name}. '
            f'Please review and approve to release stock.'
        ),
        link='procurement',
        project=project,
    )

    return True, 'Confirmed and sent to Procurement for approval'


def po_approve_material_request(material_request, po_user, notes='', approval=None):
    """Procurement Officer approves — stock moves to site inventory immediately."""
    from approvals.models import ApprovalRequest

    if material_request.status in ('approved', 'fulfilled', 'ordered', 'rejected'):
        return _close_material_request_approval_if_already_done(
            material_request, po_user, approval=approval,
        )

    if material_request.status == 'po_approved':
        return False, 'Awaiting Project Manager or Technical Director confirmation.'

    if material_request.status != 'pending':
        return False, 'Request is not pending approval.'

    if (
        getattr(material_request.requested_by, 'role', None) == 'site-foreman'
        and not material_request.site_engineer_confirmed_at
    ):
        return False, 'Site Engineer must confirm this foreman request before procurement approval.'

    ok, err = _validate_material_request_stock(material_request)
    if not ok:
        return False, err

    audit_note = notes.strip() if notes else ''
    approval = approval or _material_request_approval_row(material_request, ('pending',))

    if not approval:
        approval = ApprovalRequest.objects.create(
            request_type='material_request',
            object_type='procurement.MaterialRequest',
            object_id=material_request.id,
            project=material_request.project,
            requested_by=material_request.requested_by,
            approver=po_user,
            title=f'Material request: {material_request.material.name}',
            description=material_request.notes or '',
        )

    approval.status = 'approved'
    approval.approver = po_user
    approval.procurement_reviewer = po_user
    approval.procurement_reviewed_at = timezone.now()
    approval.notes = audit_note
    approval.resolved_at = timezone.now()
    approval.save()

    _approve_material_request(material_request)
    _log_approval_audit(approval, po_user, 'Procurement approved')

    project = material_request.project
    if project and project.manager_id and project.manager_id != po_user.id:
        create_notification(
            user=project.manager,
            title='Material request approved',
            message=(
                f'Procurement approved {material_request.material.name} for {project.name} '
                f'and released stock to site inventory.'
            ),
            link='procurement',
            project=project,
        )

    td = _resolve_technical_director_for_project(project)
    if td:
        create_notification(
            user=td,
            title='Material request approved by Procurement',
            message=(
                f'Procurement approved "{material_request.material.name}" on {project.name}.'
            ),
            link='technical-approvals',
            project=project,
        )

    create_notification(
        user=material_request.requested_by,
        title='Material request approved',
        message=(
            f'Your request for {material_request.material.name} was approved by '
            f'Procurement and added to site inventory.'
        ),
        link='site-inventory',
        project=material_request.project,
    )
    return True, 'Approved and stock updated'


def _may_finalize_material_request(reviewer, material_request) -> bool:
    role = getattr(reviewer, 'role', None)
    if user_has_full_access(reviewer):
        return True
    if role == 'technical-director':
        return True
    if role == 'project-manager' and material_request.project.manager_id == reviewer.id:
        return True
    return False


def finalize_material_request_after_po(material_request, reviewer, notes='', approval=None):
    """After PO approval: PM or TD confirms — stock moves to site inventory."""
    if not _may_finalize_material_request(reviewer, material_request):
        return False, 'Only Project Manager or Technical Director can confirm after procurement approval.'

    if material_request.status in ('approved', 'fulfilled', 'ordered', 'rejected'):
        return _close_material_request_approval_if_already_done(
            material_request, reviewer, approval=approval,
        )

    if material_request.status != 'po_approved':
        return False, 'Procurement Officer must approve this request first.'

    ok, err = _validate_material_request_stock(material_request)
    if not ok:
        return False, err

    audit_note = notes.strip() if notes else ''
    approval = approval or _material_request_approval_row(material_request, ('po_approved',))
    if not approval:
        return False, 'No procurement-approved request found to confirm.'

    approval.status = 'approved'
    approval.approver = reviewer
    approval.notes = audit_note
    approval.resolved_at = timezone.now()
    approval.save()

    _approve_material_request(material_request)
    role_label = reviewer.get_role_display()
    _log_approval_audit(approval, reviewer, f'{role_label} confirmed')

    if getattr(reviewer, 'role', None) == 'project-manager':
        _notify_technical_director_procurement_activity(
            material_request.project,
            'Procurement activity',
            (
                f'{reviewer.full_name or reviewer.username} confirmed material request '
                f'"{material_request.material.name}" on {material_request.project.name}.'
            ),
        )

    _notify_procurement_officer_material_confirmed(material_request, reviewer, approval=approval)

    create_notification(
        user=material_request.requested_by,
        title='Material request approved',
        message=(
            f'Your request for {material_request.material.name} was confirmed by '
            f'{role_label} and added to site inventory.'
        ),
        link='site-inventory',
        project=material_request.project,
    )
    return True, 'Confirmed and stock updated'


def direct_approve_material_request(material_request, reviewer, notes='', approval=None):
    """PM or TD approves from pending in one step — stock moves immediately (no PO step required)."""
    from approvals.models import ApprovalRequest

    if not _may_finalize_material_request(reviewer, material_request) and not user_has_full_access(
        reviewer,
    ):
        return False, 'Only Project Manager or Technical Director can fully approve from pending.'

    if material_request.status in ('approved', 'fulfilled', 'ordered', 'rejected'):
        return _close_material_request_approval_if_already_done(
            material_request, reviewer, approval=approval,
        )

    if material_request.status != 'pending':
        return False, 'Request is not pending.'

    ok, err = _validate_material_request_stock(material_request)
    if not ok:
        return False, err

    audit_note = notes.strip() if notes else ''
    approval = approval or _material_request_approval_row(material_request, ('pending',))
    if not approval:
        approval = ApprovalRequest.objects.create(
            request_type='material_request',
            object_type='procurement.MaterialRequest',
            object_id=material_request.id,
            project=material_request.project,
            requested_by=material_request.requested_by,
            approver=reviewer,
            title=f'Material request: {material_request.material.name}',
            description=material_request.notes or '',
        )

    approval.status = 'approved'
    approval.approver = reviewer
    approval.notes = audit_note
    approval.resolved_at = timezone.now()
    approval.save()

    _approve_material_request(material_request)
    role_label = reviewer.get_role_display()
    _log_approval_audit(approval, reviewer, f'{role_label} approved')

    if getattr(reviewer, 'role', None) != 'technical-director':
        _notify_technical_director_procurement_activity(
            material_request.project,
            'Procurement activity',
            (
                f'{reviewer.full_name or reviewer.username} approved material request '
                f'"{material_request.material.name}" on {material_request.project.name}.'
            ),
        )

    _notify_procurement_officer_material_confirmed(material_request, reviewer, approval=approval)

    if material_request.requested_by_id != reviewer.id:
        create_notification(
            user=material_request.requested_by,
            title='Material request approved',
            message=(
                f'Your request for {material_request.material.name} was approved by '
                f'{role_label} and added to site inventory.'
            ),
            link='site-inventory',
            project=material_request.project,
        )
    return True, 'Approved and stock updated'


# Backwards-compatible alias
pm_confirm_material_request = finalize_material_request_after_po


def user_can_cancel_material_request(user, material_request) -> bool:
    if material_request.status not in ('pending', 'po_approved', 'rejected'):
        return False
    role = getattr(user, 'role', None)
    if role in ('site-engineer', 'site-foreman'):
        return material_request.requested_by_id == user.id
    if role == 'project-manager':
        return material_request.project.manager_id == user.id
    if role in ('procurement-officer', 'technical-director', 'admin', 'managing-director'):
        return True
    if role == 'accountant':
        return material_request.project.project_accountant_id == user.id
    return False


def cancel_material_request(material_request, user):
    if material_request.status not in ('pending', 'po_approved', 'rejected'):
        return False, 'This requisition cannot be cancelled.'
    if not user_can_cancel_material_request(user, material_request):
        return False, 'You cannot cancel this requisition.'

    material_request.status = 'cancelled'
    material_request.save(update_fields=['status', 'updated_at'])

    approval = _material_request_approval_row(
        material_request, ('pending', 'po_approved'),
    )
    if approval:
        audit_note = f'Cancelled by {user.get_role_display() or user.username}'
        approval.status = 'rejected'
        approval.notes = audit_note
        approval.resolved_at = timezone.now()
        approval.approver = user
        approval.save(
            update_fields=['status', 'notes', 'resolved_at', 'approver', 'updated_at'],
        )
        _log_approval_audit(approval, user, 'Cancelled')

    project = material_request.project
    role = getattr(user, 'role', None)
    if role in ('site-engineer', 'site-foreman') and project:
        from users.services import resolve_procurement_officer_for_project

        po = resolve_procurement_officer_for_project(project)
        if po and po.id != user.id:
            create_notification(
                user=po,
                title='Material requisition cancelled',
                message=(
                    f'{user.full_name or user.username} cancelled a request for '
                    f'{material_request.material.name} on {project.name}.'
                ),
                link='procurement',
                project=project,
            )
        if project.manager_id and project.manager_id != user.id:
            create_notification(
                user=project.manager,
                title='Material requisition cancelled',
                message=(
                    f'{user.full_name or user.username} cancelled a request for '
                    f'{material_request.material.name} on {project.name}.'
                ),
                link='procurement',
                project=project,
            )

    return True, 'Requisition cancelled.'


def apply_approval(approval, reviewer, notes=''):
    reconcile_stale_approval_rows(
        approval.__class__.objects.filter(pk=approval.pk),
    )
    approval.refresh_from_db()

    if approval.status not in ('pending', 'po_approved'):
        return True, 'This request was already processed.'

    if approval.request_type == 'staff_assignment':
        from projects.staff_assignments import apply_staff_assignment
        ok, message = apply_staff_assignment(approval, reviewer)
        if not ok:
            return False, message
        audit_note = notes.strip() if notes else ''
        approval.status = 'approved'
        approval.notes = audit_note
        approval.resolved_at = timezone.now()
        approval.approver = reviewer
        approval.save()
        _log_approval_audit(approval, reviewer, 'Staff assignment approved')
        create_notification(
            user=approval.requested_by,
            title='Staff assignment approved',
            message=f'"{approval.title}" was approved by {reviewer.get_role_display()}.',
            link='technical-approvals',
            project=approval.project,
        )
        return True, message

    if approval.request_type == 'material_request':
        from procurement.models import MaterialRequest
        mr = MaterialRequest.objects.filter(pk=approval.object_id).first()
        if not mr:
            return False, 'Material request not found'
        if mr.status in ('approved', 'fulfilled', 'ordered', 'rejected'):
            return _close_material_request_approval_if_already_done(
                mr, reviewer, approval=approval,
            )
        role = getattr(reviewer, 'role', None)
        if user_has_full_access(reviewer) and role not in ('procurement-officer',):
            if mr.status == 'pending':
                ok, msg = direct_approve_material_request(
                    mr, reviewer, notes=notes, approval=approval,
                )
            elif mr.status == 'po_approved':
                ok, msg = finalize_material_request_after_po(
                    mr, reviewer, notes=notes, approval=approval,
                )
            else:
                ok, msg = False, 'Request cannot be approved in its current state.'
            if ok:
                return ok, msg
        if (
            approval.status == 'pending'
            and role == 'site-engineer'
            and _foreman_material_request_needs_se_confirm(mr)
        ):
            return site_engineer_confirm_material_request(
                mr, reviewer, notes=notes, approval=approval,
            )
        if approval.status == 'pending' and role == 'procurement-officer':
            return po_approve_material_request(mr, reviewer, notes=notes, approval=approval)
        if approval.status == 'pending' and _may_finalize_material_request(reviewer, mr):
            return direct_approve_material_request(mr, reviewer, notes=notes, approval=approval)
        if approval.status == 'po_approved' and _may_finalize_material_request(reviewer, mr):
            return finalize_material_request_after_po(mr, reviewer, notes=notes, approval=approval)

    audit_note = notes.strip() if notes else ''
    approval.status = 'approved'
    approval.notes = audit_note
    approval.resolved_at = timezone.now()
    approval.approver = reviewer
    approval.save()

    _execute_approved_action(approval)
    _log_approval_audit(approval, reviewer, 'Approved')

    create_notification(
        user=approval.requested_by,
        title='Request approved',
        message=f'Your request "{approval.title}" was approved by {reviewer.get_role_display()}.',
        link=_approval_notification_link_for_submitter(approval),
        project=approval.project,
    )
    return True, 'Approved'


def reject_approval(approval, reviewer, notes=''):
    if approval.status not in ('pending', 'po_approved'):
        return False, 'Already resolved'

    audit_note = notes.strip() if notes else ''
    approval.status = 'rejected'
    approval.notes = audit_note
    approval.resolved_at = timezone.now()
    approval.approver = reviewer
    approval.save()

    _execute_rejected_action(approval)
    _log_approval_audit(approval, reviewer, 'Rejected')

    create_notification(
        user=approval.requested_by,
        title='Request rejected',
        message=f'Your request "{approval.title}" was rejected by {reviewer.get_role_display()}. {audit_note}'.strip(),
        link=_approval_notification_link_for_submitter(approval),
        project=approval.project,
    )
    return True, 'Rejected'


def _validate_material_request_stock(material_request):
    from procurement.stock_validation import FIELD_REQUISITION_STOCK_MESSAGE

    material = material_request.material
    if material.current_stock < material_request.quantity_requested:
        return False, FIELD_REQUISITION_STOCK_MESSAGE
    return True, ''


def _approve_material_request(mr):
    from procurement.models import MaterialRequest, SiteInventory

    if mr.status in ('approved', 'fulfilled', 'ordered'):
        return
    ok, err = _validate_material_request_stock(mr)
    if not ok:
        return
    material = mr.material
    material.current_stock -= mr.quantity_requested
    material.save()
    site_inventory, _ = SiteInventory.objects.get_or_create(
        project=mr.project,
        material=material,
        defaults={'current_stock': 0},
    )
    site_inventory.current_stock += mr.quantity_requested
    site_inventory.save()
    mr.status = 'approved'
    mr.save(update_fields=['status'])


def _execute_approved_action(approval):
    if approval.request_type == 'material_request':
        from procurement.models import MaterialRequest
        mr = MaterialRequest.objects.filter(pk=approval.object_id).first()
        if mr and mr.status in ('po_approved', 'pending'):
            _approve_material_request(mr)

    elif approval.request_type == 'transaction':
        from projects.models import Transaction
        from django.db.models import Sum
        txn = Transaction.objects.filter(pk=approval.object_id).first()
        if txn and txn.status != 'approved':
            txn.status = 'approved'
            txn.save()
            if txn.budget_item_id:
                total = Transaction.objects.filter(
                    budget_item=txn.budget_item, status='approved'
                ).aggregate(total=Sum('amount'))['total'] or 0
                txn.budget_item.actual_amount = total
                txn.budget_item.save()
            from procurement.po_expense import finalize_purchase_order_payment
            finalize_purchase_order_payment(txn, approval.approver)

    elif approval.request_type == 'task_complete':
        from projects.models import Task
        task = Task.objects.filter(pk=approval.object_id).first()
        if task:
            task.status = 'completed'
            task.save(update_fields=['status'])

    elif approval.request_type == 'purchase_order':
        from procurement.models import PurchaseOrder
        from procurement.utils import email_po_to_supplier

        po = PurchaseOrder.objects.filter(pk=approval.object_id).first()
        if po and po.status == 'pending':
            po.status = 'on-track'
            po.save(update_fields=['status'])
            try:
                email_po_to_supplier(po)
            except Exception as e:
                print(f"Failed to email PO on approval: {e}")

    elif approval.request_type == 'allocation':
        # Stock is deducted when the allocation is created; approval confirms it only.
        pass


def _execute_rejected_action(approval):
    if approval.request_type == 'material_request':
        from procurement.models import MaterialRequest
        mr = MaterialRequest.objects.filter(pk=approval.object_id).first()
        if mr:
            mr.status = 'rejected'
            mr.rejection_notes = (approval.notes or '').strip()
            mr.save(update_fields=['status', 'rejection_notes'])

    elif approval.request_type == 'transaction':
        from projects.models import Transaction
        txn = Transaction.objects.filter(pk=approval.object_id).first()
        if txn:
            txn.status = 'rejected'
            txn.save(update_fields=['status'])

    elif approval.request_type == 'purchase_order':
        from procurement.models import PurchaseOrder
        from procurement.po_expense import get_po_transaction

        po = PurchaseOrder.objects.filter(pk=approval.object_id).first()
        if po:
            po.status = 'pending'
            po.save(update_fields=['status'])
            txn = get_po_transaction(po)
            if txn and txn.status == 'pending':
                txn.status = 'rejected'
                txn.notes = (
                    f"{txn.notes} | Purchase order approval was rejected."
                ).strip()
                txn.save(update_fields=['status', 'notes'])

    elif approval.request_type == 'allocation':
        from django.db import transaction
        from procurement.models import MaterialAllocation, SiteInventory

        allocation = MaterialAllocation.objects.filter(pk=approval.object_id).first()
        if allocation:
            with transaction.atomic():
                site_inv = SiteInventory.objects.select_for_update().get(
                    pk=allocation.site_inventory_id
                )
                site_inv.current_stock += allocation.quantity
                site_inv.save(update_fields=['current_stock'])
                allocation.delete()
