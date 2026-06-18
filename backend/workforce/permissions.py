from rest_framework.exceptions import PermissionDenied


def assert_project_in_user_scope(user, project_id):
    from users.services import projects_queryset_for_user

    if project_id is None:
        raise PermissionDenied("Project is required.")
    allowed = set(projects_queryset_for_user(user).values_list("id", flat=True))
    try:
        pid = int(project_id)
    except (TypeError, ValueError):
        raise PermissionDenied("Invalid project.")
    if pid not in allowed:
        raise PermissionDenied("You do not have access to this project.")


def assert_can_initiate_payroll(user, project):
    from workforce.payroll_service import user_can_initiate_payroll

    if user_can_initiate_payroll(user, project):
        return
    raise PermissionDenied(
        "Only the assigned site foreman, site engineer, or Technical Director "
        "can initiate daily payroll for this project."
    )


def assert_site_foreman_initiate_payroll(user, project):
    assert_can_initiate_payroll(user, project)


def deny_site_foreman_worker_mutation(user, action):
    """Foreman may register workers and mark attendance; not edit/remove catalog entries."""
    if getattr(user, "role", None) != "site-foreman":
        return
    if action in ("update", "partial_update", "destroy", "bulk_upload"):
        raise PermissionDenied(
            "Site foremen can add workers and mark attendance only."
        )
