"""Who each user may message (project team + reporting line)."""
from django.db.models import Q

from users.models import CustomUser
from users.services import (
    COMPANY_WIDE_READ_ROLES,
    get_subordinate_user_ids,
    projects_queryset_for_user,
    user_has_full_access,
)


def _project_staff_user_ids(project) -> set[int]:
    ids: set[int] = set()
    for attr in (
        "manager_id",
        "site_engineer_id",
        "project_accountant_id",
        "procurement_officer_id",
        "site_foreman_id",
    ):
        uid = getattr(project, attr, None)
        if uid:
            ids.add(uid)
    ids.update(project.subcontractors.values_list("id", flat=True))
    return ids


def get_message_recipient_ids(user) -> set[int]:
    if not user or not user.is_authenticated:
        return set()

    if user_has_full_access(user):
        return set(
            CustomUser.objects.filter(is_active=True)
            .exclude(id=user.id)
            .values_list("id", flat=True)
        )

    ids: set[int] = set()

    if user.reports_to_id:
        ids.add(user.reports_to_id)

    ids.update(get_subordinate_user_ids(user))

    for project in projects_queryset_for_user(user).prefetch_related("subcontractors"):
        ids.update(_project_staff_user_ids(project))

    if user.role in COMPANY_WIDE_READ_ROLES:
        ids.update(
            CustomUser.objects.filter(is_active=True)
            .exclude(id=user.id)
            .values_list("id", flat=True)
        )

    ids.discard(user.id)
    return ids


def get_message_recipients_queryset(user):
    ids = get_message_recipient_ids(user)
    if not ids:
        return CustomUser.objects.none()
    return CustomUser.objects.filter(id__in=ids, is_active=True).order_by(
        "full_name", "username"
    )


def user_may_message_recipient(sender, recipient) -> bool:
    if not sender or not recipient or not recipient.is_active:
        return False
    if sender.id == recipient.id:
        return False
    return recipient.id in get_message_recipient_ids(sender)
