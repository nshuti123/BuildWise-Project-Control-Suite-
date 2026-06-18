"""Daily payroll workflow: foreman → site engineer → finance, or site engineer → finance."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from workforce.models import Attendance, DailyPayroll, PayrollRecord

STATUS_AWAITING_SITE = "awaiting_site_engineer"
STATUS_AWAITING_FINANCE = "awaiting_finance"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUS_PAID = "paid"

# Legacy alias
STATUS_PENDING = STATUS_AWAITING_SITE


def _payroll_blocks_attendance(project_id, date):
    return get_active_payroll_for_date(project_id, date) is not None


def get_active_payroll_for_date(project_id, date):
    return (
        DailyPayroll.objects.filter(project_id=project_id, date=date)
        .exclude(status=STATUS_REJECTED)
        .first()
    )


def user_can_edit_attendance_during_payroll_review(user, project, date) -> bool:
    if not project:
        return False
    payroll = get_active_payroll_for_date(project.id, date)
    if not payroll or payroll.status != STATUS_AWAITING_SITE:
        return False
    return user_can_confirm_payroll_on_site(user, project)


def attendance_change_blocked_for_user(user, project_id, date, validated_data=None, instance=None):
    """
    Return True if this user may not apply the attendance change.
    Site engineers may edit attendance while payroll awaits their review.
    """
    payroll = get_active_payroll_for_date(project_id, date)
    if not payroll or payroll.status == STATUS_REJECTED:
        return False

    from projects.models import Project

    project = Project.objects.filter(pk=project_id).first()
    if payroll.status == STATUS_AWAITING_SITE and user_can_edit_attendance_during_payroll_review(
        user, project, date
    ):
        return False

    if validated_data is not None and instance is not None:
        for key, value in validated_data.items():
            if key != "notes" and value != getattr(instance, key, None):
                return True
        return False

    return True


def recalculate_payroll_from_attendance(payroll):
    """Refresh payroll line items while awaiting site engineer review."""
    if payroll.status != STATUS_AWAITING_SITE:
        return payroll

    attendances = _build_payroll_records(payroll.project_id, payroll.date)
    payroll.records.all().delete()

    total = Decimal("0")
    records = []
    for att in attendances:
        calc_amount = _calc_amount(att)
        records.append(
            PayrollRecord(
                payroll_run=payroll,
                worker=att.worker,
                attendance=att,
                calculated_amount=calc_amount,
            )
        )
        total += calc_amount

    PayrollRecord.objects.bulk_create(records)
    payroll.total_amount = total
    payroll.save(update_fields=["total_amount"])

    if total > 0:
        from projects.budget_allocation import require_category_budget_available

        require_category_budget_available(payroll.project, "Labor", total)

    return payroll


def user_is_site_foreman_on_project(user, project) -> bool:
    return (
        getattr(user, "role", None) == "site-foreman"
        and project
        and project.site_foreman_id == user.id
    )


def user_is_site_engineer_on_project(user, project) -> bool:
    return (
        getattr(user, "role", None) == "site-engineer"
        and project
        and project.site_engineer_id == user.id
    )


def user_is_technical_director_for_project(user, project) -> bool:
    from users.services import user_has_technical_oversight, projects_queryset_for_user

    if not user_has_technical_oversight(user) or not project:
        return False
    return projects_queryset_for_user(user).filter(pk=project.pk).exists()


def user_can_initiate_payroll(user, project) -> bool:
    if not project:
        return False
    from users.services import user_has_technical_oversight

    if user_has_technical_oversight(user):
        return True
    return (
        user_is_site_foreman_on_project(user, project)
        or user_is_site_engineer_on_project(user, project)
    )


def user_can_confirm_payroll_on_site(user, project) -> bool:
    return user_is_site_engineer_on_project(user, project) or user_is_technical_director_for_project(
        user, project
    )


def _payroll_notification_link(payroll):
    return f"payrolls?payroll={payroll.id}"


def _notify(user, title, message, link="payrolls", project=None):
    if not user:
        return
    from users.notification_utils import create_notification

    create_notification(user=user, title=title, message=message, link=link, project=project)


def _finance_users():
    from users.models import CustomUser

    accountants = CustomUser.objects.filter(role="accountant", is_active=True)
    directors = CustomUser.objects.filter(role="director-finance", is_active=True)
    return accountants, directors


def _build_payroll_records(project_id, date):
    attendances = Attendance.objects.filter(
        worker__project_id=project_id, date=date, worker__is_active=True
    )
    if not attendances.exists():
        raise ValidationError({"detail": "No attendance records found for this date."})
    return attendances


def _calc_amount(attendance):
    rate = attendance.worker.daily_rate
    if attendance.status == "present":
        return rate
    if attendance.status == "half-day":
        return rate / 2
    return Decimal("0")


def initiate_daily_payroll(project, user, date):
    is_foreman = user_is_site_foreman_on_project(user, project)
    is_direct_to_finance = (
        user_is_site_engineer_on_project(user, project)
        or user_is_technical_director_for_project(user, project)
    )

    if not is_foreman and not is_direct_to_finance:
        raise PermissionDenied(
            "Only the assigned site foreman, site engineer, or Technical Director can initiate daily payroll."
        )

    if _payroll_blocks_attendance(project.id, date):
        raise ValidationError({"detail": "Payroll for this date has already been initiated."})

    from projects.budget_allocation import require_category_budget_available

    attendances = _build_payroll_records(project.id, date)
    preview_total = sum(_calc_amount(att) for att in attendances)
    require_category_budget_available(project, "Labor", preview_total)
    now = timezone.now() if is_direct_to_finance else None
    payroll_run = DailyPayroll.objects.create(
        project=project,
        date=date,
        initiated_by=user,
        status=STATUS_AWAITING_FINANCE if is_direct_to_finance else STATUS_AWAITING_SITE,
        site_confirmed_by=user if is_direct_to_finance else None,
        site_confirmed_at=now,
        total_amount=0,
    )

    total = Decimal("0")
    records = []
    for att in attendances:
        calc_amount = _calc_amount(att)
        records.append(
            PayrollRecord(
                payroll_run=payroll_run,
                worker=att.worker,
                attendance=att,
                calculated_amount=calc_amount,
            )
        )
        total += calc_amount

    PayrollRecord.objects.bulk_create(records)
    payroll_run.total_amount = total
    payroll_run.save(update_fields=["total_amount"])

    if is_direct_to_finance:
        _route_payroll_to_finance(payroll_run, user)
    elif project.site_engineer:
        _notify(
            project.site_engineer,
            "Daily payroll submitted",
            f"Site foreman submitted payroll for {date} — {total:,.0f} Rwf. "
            "Review attendance, then approve or reject.",
            link="workforce",
            project=project,
        )

    return payroll_run


def _route_payroll_to_finance(payroll, confirmed_by):
    from projects.budget_allocation import require_category_budget_available

    project = payroll.project
    require_category_budget_available(project, "Labor", payroll.total_amount)
    _create_pending_payroll_transaction(payroll)

    confirmer_role = getattr(confirmed_by, "role", None)
    direct_submission = (
        payroll.initiated_by_id == confirmed_by.id
        and confirmer_role in ("site-engineer", "technical-director")
    )
    if direct_submission:
        if confirmer_role == "technical-director":
            lead = f"Technical Director submitted payroll for {project.name} on {payroll.date}"
        else:
            lead = f"Site engineer submitted payroll for {project.name} on {payroll.date}"
    else:
        lead = f"Site engineer approved payroll for {project.name} on {payroll.date}"

    amount_part = f"{payroll.total_amount:,.0f} Rwf. Please approve or reject this payment request."
    acc_msg = f"{lead} — {amount_part}"
    accountants, directors = _finance_users()
    payroll_link = _payroll_notification_link(payroll)
    for acc in accountants:
        _notify(acc, "Payroll payment request", acc_msg, link=payroll_link, project=project)
    df_msg = (
        f"{lead} — {payroll.total_amount:,.0f} Rwf. You may approve from Payroll Operations "
        "or wait for finance department processing."
    )
    for df in directors:
        _notify(df, "Payroll submitted for finance", df_msg, link=payroll_link, project=project)

    if payroll.initiated_by and payroll.initiated_by_id != confirmed_by.id:
        _notify(
            payroll.initiated_by,
            "Payroll approved by site engineer",
            f"Your payroll for {payroll.date} was approved by the site engineer "
            f"and sent to the finance department ({payroll.total_amount:,.0f} Rwf).",
            link="workforce",
            project=project,
        )

    return payroll


def confirm_payroll_site_engineer(payroll, user):
    project = payroll.project
    if payroll.status != STATUS_AWAITING_SITE:
        raise ValidationError({"detail": "This payroll is not awaiting site engineer confirmation."})
    if not user_can_confirm_payroll_on_site(user, project):
        raise PermissionDenied(
            "Only the assigned site engineer or Technical Director can confirm this payroll."
        )

    payroll.status = STATUS_AWAITING_FINANCE
    payroll.site_confirmed_by = user
    payroll.site_confirmed_at = timezone.now()
    payroll.save(
        update_fields=["status", "site_confirmed_by", "site_confirmed_at"]
    )

    return _route_payroll_to_finance(payroll, user)


def _create_pending_payroll_transaction(payroll):
    from projects.budget_allocation import require_category_budget_available
    from projects.models import BudgetCategory, Transaction

    _, labor_item = require_category_budget_available(
        payroll.project, "Labor", payroll.total_amount
    )
    category = labor_item.category if labor_item else None
    if not category:
        category, _ = BudgetCategory.objects.get_or_create(
            name="Labor",
            defaults={"color": "#6366f1"},
        )

    tx, created = Transaction.objects.get_or_create(
        project=payroll.project,
        notes=f"Payroll #{payroll.id}",
        defaults={
            "category": category,
            "budget_item": labor_item,
            "description": f"Workforce Payroll Batch - {payroll.date}",
            "amount": payroll.total_amount,
            "transaction_date": payroll.date,
            "status": "pending",
            "created_by": payroll.site_confirmed_by or payroll.initiated_by,
        },
    )
    if not created:
        tx.amount = payroll.total_amount
        tx.status = "pending"
        tx.budget_item = labor_item
        tx.save(update_fields=["amount", "status", "budget_item"])
    return tx


def approve_payroll_finance(payroll, user):
    role = getattr(user, "role", None)
    if role not in ("accountant", "director-finance", "admin", "managing-director"):
        raise PermissionDenied("Only Accountant or Director of Finance can approve payroll.")

    if payroll.status != STATUS_AWAITING_FINANCE:
        if payroll.status == STATUS_APPROVED:
            raise ValidationError({"detail": "Payroll is already approved."})
        raise ValidationError({"detail": "This payroll is not awaiting finance approval."})

    from projects.budget_allocation import require_category_budget_available

    require_category_budget_available(payroll.project, "Labor", payroll.total_amount)

    now = timezone.now()
    update_fields = []

    if role == "accountant":
        if payroll.accountant_approved_by_id:
            raise ValidationError({"detail": "This payroll has already been approved."})
        payroll.accountant_approved_by = user
        payroll.accountant_approved_at = now
        update_fields = ["accountant_approved_by", "accountant_approved_at"]
    elif role == "director-finance":
        if payroll.director_finance_approved_by_id:
            raise ValidationError({"detail": "This payroll has already been approved."})
        payroll.director_finance_approved_by = user
        payroll.director_finance_approved_at = now
        update_fields = ["director_finance_approved_by", "director_finance_approved_at"]
    else:
        payroll.approved_by = user
        update_fields = ["approved_by"]

    if update_fields:
        payroll.save(update_fields=update_fields)

    _finalize_payroll(payroll, user)
    return payroll


def _finalize_payroll(payroll, approver):
    approver_name = approver.full_name or approver.username
    approver_role = getattr(approver, "role", None)

    payroll.status = STATUS_APPROVED
    payroll.approved_by = approver
    payroll.save(update_fields=["status", "approved_by"])

    apply_labor_budget_impact(payroll)
    _approve_payroll_transaction(payroll)

    project_name = payroll.project.name if payroll.project_id else "project"
    amount_str = f"{payroll.total_amount:,.0f} Rwf"
    approved_msg = (
        f"Payroll for {project_name} on {payroll.date} was approved by "
        f"{approver_name} ({amount_str}). Labor budget has been updated."
    )

    if payroll.initiated_by:
        _notify(payroll.initiated_by, "Payroll approved", approved_msg, link="workforce", project=payroll.project)
    if payroll.site_confirmed_by:
        _notify(payroll.site_confirmed_by, "Payroll approved", approved_msg, link="workforce", project=payroll.project)

    accountants, directors = _finance_users()
    expense_msg = (
        f"{approver_name} approved payroll #{payroll.id} for {project_name} "
        f"on {payroll.date} ({amount_str}). The labor expense is recorded in "
        "Budget & Costs transactions."
    )

    for acc in accountants:
        _notify(acc, "Payroll approved", approved_msg, link="payrolls", project=payroll.project)

    if approver_role == "accountant":
        for df in directors:
            _notify(df, "Payroll expense logged", expense_msg, link="budget", project=payroll.project)
    elif approver_role == "director-finance":
        for df in directors:
            if df.id != approver.id:
                _notify(df, "Payroll approved", approved_msg, link="payrolls", project=payroll.project)
    else:
        for df in directors:
            _notify(df, "Payroll approved", approved_msg, link="payrolls", project=payroll.project)


def apply_labor_budget_impact(payroll):
    from projects.budget_allocation import (
        require_category_budget_available,
        sync_budget_item_actual_from_approved_transactions,
    )

    _, labor_item = require_category_budget_available(
        payroll.project, "Labor", payroll.total_amount
    )
    if labor_item:
        sync_budget_item_actual_from_approved_transactions(labor_item)


def _approve_payroll_transaction(payroll):
    from projects.budget_allocation import (
        require_category_budget_available,
        sync_budget_item_actual_from_approved_transactions,
    )
    from projects.models import Transaction

    _, labor_item = require_category_budget_available(
        payroll.project, "Labor", payroll.total_amount
    )

    tx = Transaction.objects.filter(notes__contains=f"Payroll #{payroll.id}").first()
    if tx:
        if labor_item and not tx.budget_item_id:
            tx.budget_item = labor_item
            tx.category = labor_item.category
        tx.status = "approved"
        tx.save(update_fields=["status", "budget_item", "category"])
    elif labor_item:
        from projects.models import BudgetCategory

        category = labor_item.category
        Transaction.objects.create(
            project=payroll.project,
            category=category,
            budget_item=labor_item,
            description=f"Workforce Payroll Batch - {payroll.date}",
            amount=payroll.total_amount,
            transaction_date=payroll.date,
            status="approved",
            notes=f"Payroll #{payroll.id}",
            created_by=payroll.site_confirmed_by or payroll.initiated_by,
        )

    if labor_item:
        sync_budget_item_actual_from_approved_transactions(labor_item)


def reject_payroll(payroll, user, reason=""):
    role = getattr(user, "role", None)
    allowed = False
    if payroll.status == STATUS_AWAITING_SITE and user_can_confirm_payroll_on_site(
        user, payroll.project
    ):
        allowed = True
    elif payroll.status == STATUS_AWAITING_FINANCE and role in (
        "accountant",
        "director-finance",
    ):
        allowed = True
    elif role in ("admin", "managing-director", "technical-director"):
        allowed = True

    if not allowed:
        raise PermissionDenied("You cannot reject this payroll at its current stage.")

    was_awaiting_site = payroll.status == STATUS_AWAITING_SITE
    site_engineer_rejected = was_awaiting_site and user_can_confirm_payroll_on_site(
        user, payroll.project
    )

    payroll.status = STATUS_REJECTED
    payroll.rejected_by = user
    payroll.rejected_at = timezone.now()
    payroll.rejection_notes = reason or ""
    payroll.save(
        update_fields=["status", "rejected_by", "rejected_at", "rejection_notes"]
    )

    from projects.models import Transaction

    tx = Transaction.objects.filter(notes__contains=f"Payroll #{payroll.id}").first()
    if tx:
        tx.status = "rejected"
        tx.save(update_fields=["status"])

    if payroll.initiated_by:
        rejecter = user.full_name or user.username
        if site_engineer_rejected:
            _notify(
                payroll.initiated_by,
                "Payroll rejected by site engineer",
                f"Payroll #{payroll.id} for {payroll.date} was rejected by {rejecter}"
                + (f": {reason}" if reason else ". You may correct attendance and resubmit."),
                link=_payroll_notification_link(payroll),
                project=payroll.project,
            )
        else:
            _notify(
                payroll.initiated_by,
                "Payroll rejected",
                f"Payroll #{payroll.id} for {payroll.date} was rejected"
                + (f": {reason}" if reason else "."),
                link=_payroll_notification_link(payroll),
                project=payroll.project,
            )

    return payroll
