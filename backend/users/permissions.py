from rest_framework import permissions

from .services import user_has_full_access


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsManagingDirector(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'managing-director'


class IsFullAccess(permissions.BasePermission):
    """Managing Director or System Admin — full platform access."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and user_has_full_access(request.user)


class IsDirectorFinance(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'director-finance'


class IsTechnicalDirector(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'technical-director'


class IsExecutive(permissions.BasePermission):
    """Managing Director, Directors, or System Admin."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            'admin',
            'managing-director',
            'director-finance',
            'technical-director',
        )


class IsProjectManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'project-manager'


class IsSiteEngineer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'site-engineer'


class IsSiteForeman(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'site-foreman'


class IsSubcontractor(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'subcontractor'


class IsProcurementOfficer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'procurement-officer'


class IsSafetyOfficer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'safety-officer'


class IsAccountant(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'accountant'


class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'client'


class IsFinanceApprover(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            'accountant',
            'director-finance',
            'managing-director',
            'admin',
        )
