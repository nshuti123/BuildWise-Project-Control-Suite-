from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from .models import ApprovalRequest
from .serializers import ApprovalRequestSerializer
from .services import (
    apply_approval,
    reject_approval,
    reconcile_stale_approval_rows,
    user_can_review_approval,
)
from users.services import (
    get_subordinate_user_ids,
    projects_queryset_for_user,
    user_has_full_access,
    user_has_technical_oversight,
    TECHNICAL_APPROVAL_TYPES,
)


def _approval_visibility_filter(user, subordinate_ids):
    """Who may see an approval row in inbox/history."""
    from .services import PROCUREMENT_OVERSIGHT_TYPES

    base = Q(approver=user) | Q(requested_by=user)
    if subordinate_ids:
        base |= Q(requested_by_id__in=subordinate_ids)
    if getattr(user, 'role', None) == 'procurement-officer':
        base |= Q(request_type__in=PROCUREMENT_OVERSIGHT_TYPES)
    if user_has_technical_oversight(user) or getattr(user, 'role', None) == 'project-manager':
        allowed_projects = projects_queryset_for_user(user)
        base |= Q(
            request_type__in=TECHNICAL_APPROVAL_TYPES,
            project__in=allowed_projects,
        )
    return base


class ApprovalRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        subordinate_ids = get_subordinate_user_ids(user)

        qs = ApprovalRequest.objects.select_related(
            'requested_by',
            'approver',
            'procurement_reviewer',
            'project',
        )

        if not user_has_full_access(user):
            qs = qs.filter(_approval_visibility_filter(user, subordinate_ids))

        scope = self.request.query_params.get('scope')
        feed = self.request.query_params.get('feed')
        if scope == 'technical':
            qs = qs.filter(request_type__in=TECHNICAL_APPROVAL_TYPES)
        elif scope == 'finance':
            qs = qs.filter(request_type='transaction')
        if feed == 'procurement':
            from .services import PROCUREMENT_OVERSIGHT_TYPES
            qs = qs.filter(request_type__in=PROCUREMENT_OVERSIGHT_TYPES)

        status_filter = self.request.query_params.get('status')
        if status_filter == 'history':
            qs = qs.filter(status__in=('approved', 'rejected', 'po_approved'))
        elif status_filter:
            qs = qs.filter(status=status_filter)

        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        elif not user_has_full_access(user):
            allowed_projects = projects_queryset_for_user(user)
            qs = qs.filter(
                Q(project__in=allowed_projects) | Q(project__isnull=True)
            )

        reconcile_stale_approval_rows(qs)

        if status_filter == 'history':
            return qs.order_by('-resolved_at', '-created_at')
        return qs.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        approval = self.get_object()
        if not user_can_review_approval(request.user, approval):
            return Response({'detail': 'You cannot approve this request.'}, status=403)
        notes = request.data.get('notes', '')
        if approval.request_type == 'material_request' and not (notes or '').strip():
            return Response(
                {'detail': 'Please add approval notes before approving this requisition.'},
                status=400,
            )
        ok, message = apply_approval(approval, request.user, notes=notes)
        if not ok:
            return Response({'detail': message}, status=400)
        approval.refresh_from_db()
        return Response(
            ApprovalRequestSerializer(approval, context={'request': request}).data,
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        approval = self.get_object()
        if not user_can_review_approval(request.user, approval):
            return Response({'detail': 'You cannot reject this request.'}, status=403)
        notes = request.data.get('notes', '')
        if approval.request_type == 'material_request' and not (notes or '').strip():
            return Response(
                {'detail': 'Please add rejection notes before returning this requisition to site.'},
                status=400,
            )
        ok, message = reject_approval(approval, request.user, notes=notes)
        if not ok:
            return Response({'detail': message}, status=400)
        return Response(ApprovalRequestSerializer(approval).data)

    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        qs = self.get_queryset().filter(status='pending')
        scope = request.query_params.get('scope')
        if scope == 'technical':
            qs = qs.filter(request_type__in=TECHNICAL_APPROVAL_TYPES)
        elif scope == 'finance':
            qs = qs.filter(request_type='transaction')
        return Response({'count': qs.count()})
