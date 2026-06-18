import psutil
import time
from django.db.models import Q
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, ListAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from .models import CustomUser, SystemLog, Notification, PasswordResetOTP, Message, Announcement
from .serializers import (
    CustomUserSerializer,
    CustomTokenObtainPairSerializer,
    SystemLogSerializer,
    NotificationSerializer,
    RequestPasswordResetSerializer,
    VerifyPasswordResetSerializer,
    MessageSerializer,
    AnnouncementSerializer,
)
from .permissions import IsAdmin, IsExecutive
from .services import get_subordinate_user_ids
from rest_framework_simplejwt.views import TokenObtainPairView

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = CustomUserSerializer(user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        serializer = CustomUserSerializer(user, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            # Prevent users from elevating their privileges
            if 'role' in serializer.validated_data and user.role not in ('admin', 'managing-director'):
                serializer.validated_data.pop('role')
            if 'is_active' in serializer.validated_data and user.role not in ('admin', 'managing-director'):
                serializer.validated_data.pop('is_active')
            if 'reports_to' in serializer.validated_data and user.role not in ('admin', 'managing-director'):
                serializer.validated_data.pop('reports_to')
                
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserListView(ListCreateAPIView):
    queryset = CustomUser.objects.all().order_by('-date_joined')
    serializer_class = CustomUserSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        if self.request.method == 'POST':
            from .services import user_can_manage_users
            if user_can_manage_users(self.request.user):
                return [IsAuthenticated()]
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        from .services import user_can_view_all_users
        user = self.request.user
        qs = CustomUser.objects.all().order_by('-date_joined')
        if user_can_view_all_users(user):
            return qs
        if user.role == 'director-finance':
            sub_ids = get_subordinate_user_ids(user)
            return qs.filter(Q(id=user.id) | Q(id__in=sub_ids) | Q(reports_to=user))
        return qs.filter(id=user.id)

    def perform_create(self, serializer):
        user = serializer.save()
        from .audit import log_system_event
        log_system_event(
            f'Created user account "{user.username}" ({user.get_role_display()})',
            user=self.request.user,
            log_type='user',
        )

class UserDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            from .services import user_can_manage_users
            if user_can_manage_users(self.request.user):
                return [IsAuthenticated()]
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        instance = serializer.instance
        was_active = instance.is_active
        old_role = instance.role
        user = serializer.save()
        from .audit import log_system_event
        actor = self.request.user
        if was_active and not user.is_active:
            log_system_event(
                f'Deactivated user account "{user.username}"',
                user=actor,
                log_type='security',
            )
        elif not was_active and user.is_active:
            log_system_event(
                f'Reactivated user account "{user.username}"',
                user=actor,
                log_type='user',
            )
        elif old_role != user.role:
            log_system_event(
                f'Changed role for "{user.username}" to {user.get_role_display()}',
                user=actor,
                log_type='security',
            )
        else:
            log_system_event(
                f'Updated user account "{user.username}"',
                user=actor,
                log_type='user',
            )

    def perform_destroy(self, instance):
        from .audit import log_system_event
        username = instance.username
        log_system_event(
            f'Deleted user account "{username}"',
            user=self.request.user,
            log_type='security',
        )
        instance.delete()

import random
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta

class RequestPasswordResetView(APIView):
    permission_classes = [] # Allow unauthenticated

    def post(self, request):
        serializer = RequestPasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = CustomUser.objects.filter(email=email).first()
            if user:
                # Generate 6 digit OTP
                otp = str(random.randint(100000, 999999))
                # Delete old OTPs for this user
                PasswordResetOTP.objects.filter(user=user).delete()
                # Create new OTP
                PasswordResetOTP.objects.create(user=user, otp=otp)

                from .audit import log_system_event
                log_system_event(
                    f'Password reset requested for account "{user.username}"',
                    user=user,
                    log_type='security',
                )
                
                # Send email
                send_mail(
                    'BuildWise Password Reset',
                    f'Your password reset code is: {otp}\nThis code will expire in 15 minutes.',
                    'noreply@buildwise.com',
                    [email],
                    fail_silently=False,
                )
            
            # Always return success message to prevent email enumeration
            return Response({"detail": "If the email exists, a reset code has been sent."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyPasswordResetView(APIView):
    permission_classes = [] # Allow unauthenticated

    def post(self, request):
        serializer = VerifyPasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            otp = serializer.validated_data['otp']
            new_password = serializer.validated_data['new_password']
            
            user = CustomUser.objects.filter(email=email).first()
            if not user:
                return Response({"detail": "Invalid email or OTP"}, status=status.HTTP_400_BAD_REQUEST)
                
            otp_obj = PasswordResetOTP.objects.filter(user=user, otp=otp).first()
            if not otp_obj:
                return Response({"detail": "Invalid email or OTP"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Check expiration (15 minutes)
            if timezone.now() > otp_obj.created_at + timedelta(minutes=15):
                otp_obj.delete()
                return Response({"detail": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Reset password
            user.set_password(new_password)
            user.save()
            
            # Clean up used OTP
            otp_obj.delete()
            
            return Response({"detail": "Password has been successfully reset."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-timestamp')

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['patch'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsExecutive()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if (
            getattr(self.request.user, "role", None)
            in ("admin", "managing-director", "technical-director", "director-finance")
            and self.request.query_params.get("manage") == "1"
        ):
            return Announcement.objects.select_related("created_by").order_by(
                "-created_at"
            )
        from users.announcement_service import announcement_queryset_for_user

        return announcement_queryset_for_user(self.request.user)

    def perform_create(self, serializer):
        from users.announcement_service import notify_audience

        announcement = serializer.save(created_by=self.request.user)
        notify_audience(announcement)

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        from users.models import AnnouncementAcknowledgment
        from users.announcement_service import user_can_see_announcement

        announcement = self.get_object()
        if not user_can_see_announcement(request.user, announcement):
            return Response(
                {"detail": "You cannot acknowledge this announcement."},
                status=status.HTTP_403_FORBIDDEN,
            )
        AnnouncementAcknowledgment.objects.get_or_create(
            announcement=announcement, user=request.user
        )
        return Response(
            AnnouncementSerializer(announcement, context={"request": request}).data
        )


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        return Message.objects.filter(
            Q(sender=self.request.user) | Q(recipient=self.request.user)
        ).order_by('-timestamp')

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        from users.message_recipients import user_may_message_recipient

        recipient = serializer.validated_data.get('recipient')
        if recipient and not user_may_message_recipient(self.request.user, recipient):
            raise PermissionDenied(
                'You can only message users on your project team or in your reporting line.'
            )
        msg = serializer.save(sender=self.request.user)
        if msg.recipient_id and msg.recipient_id != self.request.user.id:
            sender_name = self.request.user.full_name or self.request.user.username
            preview = (msg.body or '')[:120]
            Notification.objects.create(
                user=msg.recipient,
                title='New message',
                message=f'{sender_name}: {preview}',
                link='communication',
            )

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        msg = self.get_object()
        if msg.recipient == request.user:
            msg.is_read = True
            msg.save()
        return Response(MessageSerializer(msg).data)

class MessageRecipientsView(APIView):
    """Users the current account is allowed to message (for compose UI)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from users.message_recipients import get_message_recipients_queryset

        qs = get_message_recipients_queryset(request.user)
        serializer = CustomUserSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class OrgChartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = CustomUser.objects.filter(is_active=True).select_related('reports_to')
        nodes = []
        for u in users:
            nodes.append({
                'id': u.id,
                'name': u.full_name or u.username,
                'role': u.role,
                'department': u.department,
                'job_title': u.job_title,
                'reports_to_id': u.reports_to_id,
            })
        return Response(nodes)


class SubordinatesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sub_ids = get_subordinate_user_ids(request.user)
        subordinates = CustomUser.objects.filter(id__in=sub_ids, is_active=True)
        serializer = CustomUserSerializer(subordinates, many=True, context={'request': request})
        return Response(serializer.data)


class SendReportEmailView(APIView):
    """Send a report email with optional generated PDF and custom attachments (no project scope)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from rest_framework.response import Response
        from projects.report_email import send_report_email, CUSTOM_ATTACHMENT_HELP

        to_email = (request.data.get('email') or '').strip()
        subject = (request.data.get('subject') or 'BuildWise Report').strip()
        message = (request.data.get('message') or '').strip()
        if not to_email:
            return Response({'detail': 'Recipient email is required.'}, status=400)

        exporter = request.user.full_name or request.user.username
        body = (
            f"Hello,\n\n"
            f"{exporter} shared a report from BuildWise.\n\n"
        )
        if message:
            body += f"{message.strip()}\n\n"
        body += f"Note: {CUSTOM_ATTACHMENT_HELP}\n\nRegards,\nBuildWise Project Control Suite"

        report_file = request.FILES.get('report')
        extra = request.FILES.getlist('attachments')
        try:
            send_report_email(
                to_email=to_email,
                subject=subject,
                body=body,
                report_bytes=report_file.read() if report_file else None,
                report_filename=report_file.name if report_file else None,
                report_mimetype=getattr(report_file, 'content_type', None) or 'application/pdf',
                extra_attachments=extra,
            )
        except Exception as exc:
            return Response(
                {'detail': f'Failed to send email. Check server mail settings. ({exc})'},
                status=500,
            )
        return Response({'detail': f'Report emailed to {to_email}.'})


class SystemLogListView(ListAPIView):
    serializer_class = SystemLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = SystemLog.objects.select_related('user').order_by('-timestamp')
        log_type = self.request.query_params.get('type')
        if log_type:
            qs = qs.filter(type=log_type)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(action__icontains=search)
        return qs

BOOT_TIME = psutil.boot_time()

class SystemMetricsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        import os
        
        # CPU
        cpu_percent = psutil.cpu_percent(interval=None)
        
        # CPU & Memory of the Buildwise App specifically
        process = psutil.Process(os.getpid())
        memory_used_mb = round(process.memory_info().rss / (1024 * 1024), 2)
        memory_usage_str = f"{memory_used_mb} MB"
        
        # Fallback to C: since it's Windows mostly
        disk_path = '/'
        if hasattr(psutil, 'WINDOWS') and psutil.WINDOWS:
             disk_path = 'C:\\'
        elif hasattr(psutil, 'os') and psutil.os.name == 'nt':
             disk_path = 'C:\\'
             
        disk = psutil.disk_usage(disk_path)
        disk_used_gb = round(disk.used / (1024**3), 2)
        disk_total_gb = round(disk.total / (1024**3), 2)
        disk_percent = disk.percent
        
        uptime_seconds = time.time() - BOOT_TIME
        uptime_hours = round(uptime_seconds / 3600, 2)
        
        return Response({
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": memory_usage_str,
            "uptime": f"{uptime_hours}h",
            "disk_used_gb": disk_used_gb,
            "disk_total_gb": disk_total_gb,
            "disk_percent": disk_percent,
        })
