"""Pending budget transactions and finance alerts for purchase orders."""

from decimal import Decimal

from rest_framework.exceptions import ValidationError


def _po_transaction_marker(purchase_order_id: int) -> str:
    return f"purchase_order:{purchase_order_id}"


def get_po_transaction(purchase_order):
    from projects.models import Transaction

    if not purchase_order or not purchase_order.project_id:
        return None
    marker = _po_transaction_marker(purchase_order.id)
    return Transaction.objects.filter(
        project_id=purchase_order.project_id,
        notes__contains=marker,
    ).first()


def log_purchase_order_expense(purchase_order, created_by, *, user=None, notify=True):
    """
    Record a pending expense in transaction history for finance review.
    Idempotent per purchase order.
    """
    if not purchase_order.project_id:
        return None

    existing = get_po_transaction(purchase_order)
    if existing:
        return existing

    from projects.budget_allocation import (
        procurement_category_for_order_type,
        require_category_budget_available,
    )
    from projects.models import Transaction
    from django.utils import timezone

    category_name = procurement_category_for_order_type(purchase_order.order_type)
    _, budget_item = require_category_budget_available(
        purchase_order.project,
        category_name,
        purchase_order.total_amount,
        user=user,
    )
    if not budget_item or not budget_item.category_id:
        raise ValidationError(
            {
                "detail": (
                    "Could not link this purchase order to a project budget line. "
                    "Contact the finance department."
                )
            }
        )
    category = budget_item.category
    marker = _po_transaction_marker(purchase_order.id)
    material_name = getattr(purchase_order.material, "name", "items")

    transaction = Transaction.objects.create(
        project=purchase_order.project,
        category=category,
        budget_item=budget_item,
        amount=purchase_order.total_amount,
        description=f"PO #{purchase_order.po_number} - {material_name}",
        transaction_date=purchase_order.order_date or timezone.now().date(),
        status="pending",
        notes=(
            f"{marker} | Pending expense from purchase order #{purchase_order.po_number}. "
            "Awaiting finance approval."
        ),
        created_by=created_by,
    )

    if notify:
        notify_finance_about_po_expense(purchase_order, transaction, created_by)

    return transaction


def notify_finance_about_po_expense(purchase_order, transaction, actor=None):
    from users.models import CustomUser
    from users.notification_utils import create_notification

    project = purchase_order.project
    if not project:
        return

    actor_name = "Procurement"
    if actor:
        actor_name = actor.full_name or actor.username or actor_name

    amount = Decimal(transaction.amount or purchase_order.total_amount or 0)
    message = (
        f"{actor_name} placed purchase order #{purchase_order.po_number} "
        f"({getattr(purchase_order.material, 'name', 'order')}) for "
        f"Rwf {float(amount):,.0f} on {project.name}. "
        "Review the pending expense in Budget & Costs → Transaction History."
    )

    notified_ids = set()

    for director in CustomUser.objects.filter(role="director-finance", is_active=True):
        if director.id in notified_ids:
            continue
        notified_ids.add(director.id)
        create_notification(
            user=director,
            title="New purchase order expense",
            message=message,
            link="budget",
            project=project,
        )

    accountant = getattr(project, "project_accountant", None)
    if accountant and accountant.is_active and accountant.id not in notified_ids:
        create_notification(
            user=accountant,
            title="New purchase order expense",
            message=message,
            link="budget",
            project=project,
        )


def ensure_po_pending_transaction(purchase_order, user, *, notify=False):
    """Get or create the pending transaction linked to a PO."""
    tx = get_po_transaction(purchase_order)
    if tx:
        return tx
    return log_purchase_order_expense(
        purchase_order, user, user=user, notify=notify
    )


def get_purchase_order_for_transaction(transaction):
    """Resolve the purchase order linked to a finance transaction."""
    import re
    from procurement.models import PurchaseOrder

    notes = transaction.notes or ""
    marker_match = re.search(r"purchase_order:(\d+)", notes)
    if marker_match:
        return (
            PurchaseOrder.objects.filter(pk=int(marker_match.group(1)))
            .select_related("supplier", "material", "project")
            .first()
        )

    for text in (transaction.description or "", notes):
        po_match = re.search(r"PO #([\w-]+)", text)
        if po_match:
            return (
                PurchaseOrder.objects.filter(po_number=po_match.group(1))
                .select_related("supplier", "material", "project")
                .first()
            )
    return None


def complete_purchase_order_on_payment(purchase_order):
    """Mark PO completed and receive stock into warehouse (idempotent)."""
    if purchase_order.status == "completed":
        return False

    purchase_order.status = "completed"
    purchase_order.save(update_fields=["status"])

    material = purchase_order.material
    material.current_stock += purchase_order.quantity
    material.save(update_fields=["current_stock"])
    return True


def send_payment_proof_to_supplier(purchase_order, transaction, approved_by):
    """Email payment proof PDF to the supplier after finance approval."""
    from django.conf import settings
    from django.core.mail import EmailMessage

    from procurement.utils import generate_payment_proof_pdf

    supplier = purchase_order.supplier
    if not supplier or not getattr(supplier, "email", None):
        return False

    pdf_bytes = generate_payment_proof_pdf(purchase_order, transaction, approved_by)
    approver_name = "Finance Department"
    if approved_by:
        approver_name = (
            getattr(approved_by, "full_name", None)
            or f"{approved_by.first_name} {approved_by.last_name}".strip()
            or approved_by.username
        )

    amount = float(transaction.amount or purchase_order.total_amount or 0)
    payment_date = transaction.transaction_date.strftime("%Y-%m-%d")
    subject = f"Payment confirmation — PO {purchase_order.po_number}"
    body = (
        f"Hello {supplier.name},\n\n"
        f"This confirms that payment for Purchase Order {purchase_order.po_number} "
        f"has been approved by our finance department.\n\n"
        f"Amount paid: Rwf {amount:,.2f}\n"
        f"Payment date: {payment_date}\n"
        f"Approved by: {approver_name}\n\n"
        f"The payment proof is attached for your records.\n\n"
        f"Thank you,\nBuildWise Procurement & Finance"
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "finance@buildwise.local")
    email = EmailMessage(subject, body, from_email, [supplier.email])
    email.attach(
        f"Payment_Proof_{purchase_order.po_number}.pdf",
        pdf_bytes,
        "application/pdf",
    )
    email.send(fail_silently=True)
    return True


def finalize_purchase_order_payment(transaction, approved_by):
    """
    When finance approves a PO-linked transaction:
    complete the order, receive stock, and email payment proof to the supplier.
    """
    purchase_order = get_purchase_order_for_transaction(transaction)
    if not purchase_order:
        return False

    complete_purchase_order_on_payment(purchase_order)
    send_payment_proof_to_supplier(purchase_order, transaction, approved_by)
    return True


def can_delete_purchase_order(user, purchase_order=None) -> bool:
    role = getattr(user, 'role', None)
    if role in ('admin', 'managing-director', 'technical-director', 'procurement-officer'):
        return True
    if role == 'project-manager' and purchase_order and purchase_order.project_id:
        return purchase_order.project.manager_id == user.id
    return False


def delete_purchase_order(purchase_order, user):
    """
    Remove a purchase order and clean up pending approvals/transactions.
    Blocked once finance has approved the linked payment.
    """
    from django.db import transaction as db_transaction
    from django.db.models import Sum
    from approvals.models import ApprovalRequest

    if not can_delete_purchase_order(user, purchase_order):
        return False, 'You do not have permission to delete this purchase order.'

    linked_tx = get_po_transaction(purchase_order)
    if linked_tx and linked_tx.status == 'approved':
        return False, (
            'This purchase order cannot be deleted because finance has already '
            'approved payment. Contact the finance department if a reversal is needed.'
        )

    with db_transaction.atomic():
        if purchase_order.status == 'completed':
            material = purchase_order.material
            material.current_stock -= purchase_order.quantity
            if material.current_stock < 0:
                material.current_stock = 0
            material.save(update_fields=['current_stock'])

        if linked_tx:
            budget_item = linked_tx.budget_item
            linked_tx.delete()
            if budget_item:
                total = (
                    budget_item.transactions.filter(status='approved').aggregate(
                        total=Sum('amount'),
                    )['total']
                    or 0
                )
                budget_item.actual_amount = total
                budget_item.save(update_fields=['actual_amount'])

        ApprovalRequest.objects.filter(
            request_type='purchase_order',
            object_id=purchase_order.id,
        ).delete()

        purchase_order.delete()

    return True, 'Purchase order deleted.'
