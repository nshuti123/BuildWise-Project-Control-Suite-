"""Permissions for project supporting documents."""

from users.services import user_has_full_access, user_has_technical_oversight


def user_can_manage_project_documents(user, project) -> bool:
    if not user or not user.is_authenticated or not project:
        return False
    if user_has_full_access(user) or user_has_technical_oversight(user):
        return True
    role = getattr(user, 'role', None)
    if role == 'project-manager' and project.manager_id == user.id:
        return True
    if role == 'site-engineer' and project.site_engineer_id == user.id:
        return True
    return False
