"""Helpers for in-app notifications with optional project context."""


def notification_link(module: str, project=None) -> str:
    base = (module or "dashboard").strip().lstrip("/").split("?")[0]
    if project is not None:
        project_id = project.id if hasattr(project, "id") else project
        return f"{base}?project={project_id}"
    return base


def create_notification(*, user, title, message, link=None, project=None):
    from users.models import Notification

    module = link or "dashboard"
    full_link = notification_link(module, project)
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        link=full_link,
        project=project,
    )
