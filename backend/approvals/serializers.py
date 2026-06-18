from django.utils import timezone
from rest_framework import serializers
from .models import ApprovalRequest
from .services import get_approval_subject_status
from users.serializers import CustomUserSerializer


def _actor_payload(user):
    if not user:
        return None
    return {
        'id': user.id,
        'full_name': user.full_name or user.username,
        'username': user.username,
        'role': user.role,
        'role_display': user.get_role_display(),
    }


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_details = CustomUserSerializer(source='requested_by', read_only=True)
    approver_details = CustomUserSerializer(source='approver', read_only=True)
    procurement_reviewer_details = CustomUserSerializer(
        source='procurement_reviewer', read_only=True
    )
    resolved_by_details = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    audit_trail = serializers.SerializerMethodField()
    resolution_history = serializers.SerializerMethodField()
    highlight_for_viewer = serializers.SerializerMethodField()
    subject_status = serializers.SerializerMethodField()
    is_actionable = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = (
            'id',
            'request_type',
            'request_type_display',
            'object_type',
            'object_id',
            'project',
            'project_name',
            'requested_by',
            'requested_by_details',
            'approver',
            'approver_details',
            'procurement_reviewer',
            'procurement_reviewer_details',
            'procurement_reviewed_at',
            'resolved_by_details',
            'status',
            'status_display',
            'title',
            'description',
            'notes',
            'audit_trail',
            'resolution_history',
            'highlight_for_viewer',
            'subject_status',
            'is_actionable',
            'created_at',
            'updated_at',
            'resolved_at',
        )
        read_only_fields = (
            'requested_by',
            'approver',
            'status',
            'created_at',
            'updated_at',
            'resolved_at',
        )

    def get_project_name(self, obj):
        return obj.project.name if obj.project_id else ''

    def get_subject_status(self, obj):
        return get_approval_subject_status(obj)

    def get_is_actionable(self, obj):
        subject = get_approval_subject_status(obj)
        if obj.request_type == 'material_request' and subject:
            if subject in ('approved', 'fulfilled', 'ordered', 'rejected'):
                return False
            if subject == 'po_approved':
                return obj.status == 'po_approved'
            if subject == 'pending':
                return obj.status in ('pending', 'po_approved')
        return obj.status in ('pending', 'po_approved')

    def get_resolved_by_details(self, obj):
        if obj.status in ('pending',):
            return None
        if obj.status == 'po_approved':
            reviewer = obj.procurement_reviewer or obj.approver
        else:
            reviewer = obj.approver
        return _actor_payload(reviewer)

    def get_resolution_history(self, obj):
        """Ordered steps: procurement tier (if any), then final approve/reject."""
        events = []
        reviewer = obj.procurement_reviewer
        if not reviewer and obj.status == 'po_approved' and obj.approver_id:
            reviewer = obj.approver
        if reviewer:
            when = obj.procurement_reviewed_at or obj.resolved_at
            events.append({
                'action': 'po_approved',
                'label': 'Procurement approved',
                'actor': _actor_payload(reviewer),
                'at': when.isoformat() if when else None,
                'notes': '',
            })
        if obj.status == 'approved' and obj.approver_id:
            label = 'Confirmed' if obj.procurement_reviewer_id else 'Approved'
            events.append({
                'action': 'approved',
                'label': label,
                'actor': _actor_payload(obj.approver),
                'at': obj.resolved_at.isoformat() if obj.resolved_at else None,
                'notes': obj.notes or '',
            })
        elif obj.status == 'rejected' and obj.approver_id:
            events.append({
                'action': 'rejected',
                'label': 'Rejected',
                'actor': _actor_payload(obj.approver),
                'at': obj.resolved_at.isoformat() if obj.resolved_at else None,
                'notes': obj.notes or '',
            })
        elif obj.status == 'po_approved' and len(events) == 1:
            events[0]['notes'] = (
                obj.notes or 'Awaiting Project Manager or Technical Director confirmation'
            )
        return events

    def get_audit_trail(self, obj):
        events = self.get_resolution_history(obj)
        if not events:
            return None
        parts = []
        for ev in events:
            actor = ev.get('actor') or {}
            name = actor.get('full_name') or actor.get('username') or 'Unknown'
            role = actor.get('role_display') or actor.get('role') or ''
            when = ''
            if ev.get('at'):
                try:
                    from django.utils.dateparse import parse_datetime
                    dt = parse_datetime(ev['at'])
                    when = dt.strftime('%d %b %Y %H:%M') if dt else ''
                except Exception:
                    when = ''
            line = f"{ev['label']} by {name} ({role})"
            if when:
                line += f' on {when}'
            if ev.get('notes'):
                line += f' — {ev["notes"]}'
            parts.append(line)
        return ' | '.join(parts)

    def get_highlight_for_viewer(self, obj):
        from datetime import timedelta
        from .services import PROCUREMENT_OVERSIGHT_TYPES

        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) != 'technical-director':
            return False
        if obj.request_type not in PROCUREMENT_OVERSIGHT_TYPES:
            return False
        if obj.status == 'po_approved':
            return True
        if obj.status == 'approved' and obj.resolved_at:
            return timezone.now() - obj.resolved_at < timedelta(hours=72)
        return False
