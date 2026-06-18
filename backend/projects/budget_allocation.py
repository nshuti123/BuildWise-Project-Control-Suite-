"""Enforce that project spending uses pre-allocated budget lines by category."""

from decimal import Decimal

from rest_framework.exceptions import ValidationError


def _category_name_normalized(name: str) -> str:
    return (name or "").strip()


def get_category_budget_summary(project, category_name: str) -> dict:
    from .models import BudgetItem

    if not project:
        return {
            "items": [],
            "total_planned": Decimal("0"),
            "total_actual": Decimal("0"),
            "remaining": Decimal("0"),
            "has_allocation": False,
        }

    items = list(
        BudgetItem.objects.filter(
            project=project,
            category__name__iexact=_category_name_normalized(category_name),
        ).select_related("category")
    )
    total_planned = sum(Decimal(item.planned_amount or 0) for item in items)
    total_actual = sum(Decimal(item.actual_amount or 0) for item in items)
    remaining = total_planned - total_actual
    return {
        "items": items,
        "total_planned": total_planned,
        "total_actual": total_actual,
        "remaining": remaining,
        "has_allocation": total_planned > 0,
    }


def resolve_primary_budget_item(project, category_name: str):
    """Best matching budget line for a category (highest planned amount)."""
    summary = get_category_budget_summary(project, category_name)
    if not summary["items"]:
        return None
    return max(summary["items"], key=lambda item: Decimal(item.planned_amount or 0))


def allocation_required_message(category_name: str) -> str:
    return (
        f'No budget has been allocated for "{category_name}" on this project. '
        "Ask the accountant to add a budget line under Budget & Costs → Budget Items "
        f'(category "{category_name}") with a planned amount before proceeding.'
    )


def insufficient_allocated_message(category_name: str, requested, remaining) -> str:
    return (
        f'Insufficient allocated budget for "{category_name}". '
        f"Requested: Rwf {float(requested):,.2f}, Remaining: Rwf {float(remaining):,.2f}. "
        "Ask the accountant to increase the planned amount in Budget & Costs."
    )


def procurement_budget_issue_message() -> str:
    return (
        "This purchase order cannot be processed right now due to a project budget issue. "
        "Please contact the finance department for assistance."
    )


def _user_sees_procurement_budget_mask(user) -> bool:
    return getattr(user, "role", None) == "procurement-officer"


def budget_validation_detail(
    user,
    category_name: str,
    error_code: str,
    *,
    requested=None,
    remaining=None,
) -> str:
    if _user_sees_procurement_budget_mask(user):
        return procurement_budget_issue_message()
    if error_code == "budget_not_allocated":
        return allocation_required_message(category_name)
    return insufficient_allocated_message(category_name, requested, remaining)


def require_category_budget_allocated(project, category_name: str, *, user=None) -> dict:
    """Raise if the project has no planned budget for this category."""
    summary = get_category_budget_summary(project, category_name)
    if not summary["has_allocation"]:
        raise ValidationError(
            {
                "detail": budget_validation_detail(user, category_name, "budget_not_allocated"),
                "code": "budget_not_allocated",
                "category": category_name,
            }
        )
    return summary


def require_category_budget_available(project, category_name: str, amount, *, user=None) -> tuple:
    """
    Require allocated budget and enough remaining headroom.
    Returns (summary, primary_budget_item).
    """
    summary = require_category_budget_allocated(project, category_name, user=user)
    requested = Decimal(str(amount or 0))
    if requested <= 0:
        primary = resolve_primary_budget_item(project, category_name)
        return summary, primary

    if requested > summary["remaining"]:
        raise ValidationError(
            {
                "detail": budget_validation_detail(
                    user,
                    category_name,
                    "insufficient_allocated_budget",
                    requested=requested,
                    remaining=summary["remaining"],
                ),
                "code": "insufficient_allocated_budget",
                "category": category_name,
            }
        )
    primary = resolve_primary_budget_item(project, category_name)
    return summary, primary


def procurement_category_for_order_type(order_type: str) -> str:
    return "Equipment" if order_type == "equipment" else "Materials"


def sync_budget_item_actual_from_approved_transactions(budget_item) -> None:
    """Keep budget line actual spend aligned with approved transactions only."""
    if not budget_item:
        return
    from django.db.models import Sum
    from .models import Transaction

    total = (
        Transaction.objects.filter(budget_item=budget_item, status="approved").aggregate(
            total=Sum("amount")
        )["total"]
        or 0
    )
    budget_item.actual_amount = total
    budget_item.save(update_fields=["actual_amount"])
