"""Who can see an announcement and optional notify on publish."""
from django.db.models import Q
from django.utils import timezone

from users.models import Announcement, CustomUser, Notification


def announcement_queryset_for_user(user):
    """Active, non-expired announcements visible to this user."""
    now = timezone.now()
    qs = (
        Announcement.objects.filter(is_active=True)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .select_related("created_by")
        .prefetch_related("target_users", "target_projects", "acknowledgments")
    )
    # Filter in Python for M2M/JSON — acceptable for modest announcement volume
    visible_ids = [a.id for a in qs if user_can_see_announcement(user, a)]
    return Announcement.objects.filter(id__in=visible_ids).order_by("-created_at")


def user_can_see_announcement(user, announcement: Announcement) -> bool:
    if not user or not user.is_active:
        return False
    if announcement.audience_type == Announcement.AUDIENCE_ALL:
        return True
    if announcement.audience_type == Announcement.AUDIENCE_ROLES:
        return user.role in (announcement.target_roles or [])
    if announcement.audience_type == Announcement.AUDIENCE_DEPARTMENTS:
        return user.department in (announcement.target_departments or [])
    if announcement.audience_type == Announcement.AUDIENCE_USERS:
        return announcement.target_users.filter(pk=user.pk).exists()
    if announcement.audience_type == Announcement.AUDIENCE_PROJECTS:
        from users.services import projects_queryset_for_user

        project_ids = set(
            announcement.target_projects.values_list("id", flat=True)
        )
        if not project_ids:
            return False
        allowed = set(
            projects_queryset_for_user(user).values_list("id", flat=True)
        )
        return bool(project_ids & allowed)
    return False


def resolve_audience_users(announcement: Announcement):
    """All active users who should receive this announcement."""
    base = CustomUser.objects.filter(is_active=True)
    if announcement.audience_type == Announcement.AUDIENCE_ALL:
        return base
    if announcement.audience_type == Announcement.AUDIENCE_ROLES:
        return base.filter(role__in=announcement.target_roles or [])
    if announcement.audience_type == Announcement.AUDIENCE_DEPARTMENTS:
        return base.filter(department__in=announcement.target_departments or [])
    if announcement.audience_type == Announcement.AUDIENCE_USERS:
        return announcement.target_users.filter(is_active=True)
    if announcement.audience_type == Announcement.AUDIENCE_PROJECTS:
        from users.services import projects_queryset_for_user

        project_ids = list(
            announcement.target_projects.values_list("id", flat=True)
        )
        if not project_ids:
            return base.none()
        seen = set()
        recipients = []
        for u in base:
            allowed = projects_queryset_for_user(u).filter(id__in=project_ids)
            if allowed.exists() and u.id not in seen:
                seen.add(u.id)
                recipients.append(u.id)
        return base.filter(id__in=recipients)
    return base.none()


def notify_audience(announcement: Announcement):
    preview = (announcement.body or "")[:120]
    for u in resolve_audience_users(announcement):
        Notification.objects.create(
            user=u,
            title=announcement.title,
            message=preview,
            link="communication",
        )


def audience_summary(announcement: Announcement) -> str:
    if announcement.audience_type == Announcement.AUDIENCE_ALL:
        return "Everyone"
    if announcement.audience_type == Announcement.AUDIENCE_ROLES:
        roles = announcement.target_roles or []
        return ", ".join(r.replace("-", " ") for r in roles) if roles else "No roles"
    if announcement.audience_type == Announcement.AUDIENCE_DEPARTMENTS:
        deps = announcement.target_departments or []
        return ", ".join(deps) if deps else "No departments"
    if announcement.audience_type == Announcement.AUDIENCE_USERS:
        n = announcement.target_users.count()
        return f"{n} selected user{'s' if n != 1 else ''}"
    if announcement.audience_type == Announcement.AUDIENCE_PROJECTS:
        n = announcement.target_projects.count()
        return f"{n} project{'s' if n != 1 else ''}"
    return announcement.audience_type
