from rest_framework import serializers
from django.contrib.auth.signals import user_logged_in
from .models import (
    CustomUser,
    Notification,
    SystemLog,
    Message,
    Announcement,
    AnnouncementAcknowledgment,
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        from .audit import log_failed_login

        username = attrs.get(self.username_field)
        request = self.context.get('request')
        if username:
            user = (
                CustomUser.objects.filter(username=username).first()
                or CustomUser.objects.filter(email__iexact=username).first()
            )
            if user and not user.is_active:
                log_failed_login(
                    username,
                    request=request,
                    reason='Account deactivated',
                )
                raise AuthenticationFailed(
                    "Your account has been deactivated. Please contact your administrator.",
                    code="user_inactive",
                )
            if user and "@" in username:
                attrs[self.username_field] = user.username

        try:
            data = super().validate(attrs)
        except AuthenticationFailed as exc:
            detail = exc.detail
            if isinstance(detail, list):
                reason = ' '.join(str(item) for item in detail)
            elif isinstance(detail, dict):
                reason = ' '.join(str(v) for v in detail.values())
            else:
                reason = str(detail)
            log_failed_login(username or 'Unknown', request=request, reason=reason)
            raise

        user = self.user
        user_logged_in.send(sender=user.__class__, request=request, user=user)
        return data

class CustomUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField()
    reports_to_details = serializers.SerializerMethodField()
    reports_to_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'username', 'email', 'full_name', 'role', 'department', 'job_title',
            'reports_to', 'reports_to_details', 'reports_to_name',
            'profile_picture', 'is_active', 'last_login', 'password',
        )
        read_only_fields = ('last_login',)

    def get_reports_to_details(self, obj):
        if obj.reports_to:
            return {
                'id': obj.reports_to.id,
                'full_name': obj.reports_to.full_name,
                'username': obj.reports_to.username,
                'role': obj.reports_to.role,
            }
        return None

    def get_reports_to_name(self, obj):
        if obj.reports_to:
            return obj.reports_to.full_name or obj.reports_to.username
        return None

    def validate_email(self, value):
        email = CustomUser.objects.normalize_email(value)
        qs = CustomUser.objects.filter(email__iexact=email)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Email already in use.")
        return email

    def validate(self, attrs):
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == 'technical-director':
            if request.method in ('POST', 'PUT', 'PATCH'):
                raise serializers.ValidationError(
                    'Technical Director has view-only access to user accounts.'
                )
        return attrs

    def create(self, validated_data):
        from django.db import IntegrityError

        try:
            user = CustomUser.objects.create_user(
                username=validated_data['username'],
                email=validated_data['email'],
                password=validated_data['password'],
                role=validated_data.get('role', 'site-engineer'),
                full_name=validated_data.get('full_name', ''),
                department=validated_data.get('department', 'site'),
                job_title=validated_data.get('job_title', ''),
                reports_to=validated_data.get('reports_to'),
            )
        except IntegrityError as exc:
            if 'email' in str(exc).lower():
                raise serializers.ValidationError(
                    {'email': ['Email already in use.']}
                ) from exc
            raise
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

class VerifyPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)

class SystemLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = SystemLog
        fields = ('id', 'user', 'user_role', 'action', 'type', 'timestamp')

    def get_user(self, obj):
        if obj.user:
            return obj.user.full_name or obj.user.username
        return "System"

    def get_user_role(self, obj):
        if obj.user:
            return obj.user.get_role_display()
        return None

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'is_read', 'timestamp', 'link', 'project']

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    audience_summary = serializers.SerializerMethodField()
    is_acknowledged = serializers.SerializerMethodField()
    target_user_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    target_project_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "body",
            "audience_type",
            "target_roles",
            "target_departments",
            "target_user_ids",
            "target_project_ids",
            "is_active",
            "created_at",
            "expires_at",
            "created_by",
            "created_by_name",
            "audience_summary",
            "is_acknowledged",
        ]
        read_only_fields = ["created_by", "created_at", "created_by_name", "audience_summary", "is_acknowledged"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return "System"

    def get_audience_summary(self, obj):
        from users.announcement_service import audience_summary

        return audience_summary(obj)

    def get_is_acknowledged(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.acknowledgments.filter(user=request.user).exists()

    def validate(self, attrs):
        audience_type = attrs.get(
            "audience_type",
            getattr(self.instance, "audience_type", Announcement.AUDIENCE_ALL),
        )
        target_roles = attrs.get("target_roles", getattr(self.instance, "target_roles", []))
        target_departments = attrs.get(
            "target_departments", getattr(self.instance, "target_departments", [])
        )
        target_user_ids = attrs.get("target_user_ids")
        target_project_ids = attrs.get("target_project_ids")

        if audience_type == Announcement.AUDIENCE_ROLES and not target_roles:
            raise serializers.ValidationError(
                {"target_roles": "Select at least one role."}
            )
        if audience_type == Announcement.AUDIENCE_DEPARTMENTS and not target_departments:
            raise serializers.ValidationError(
                {"target_departments": "Select at least one department."}
            )
        if audience_type == Announcement.AUDIENCE_USERS:
            if target_user_ids is not None:
                if not target_user_ids:
                    raise serializers.ValidationError(
                        {"target_user_ids": "Select at least one user."}
                    )
            elif not self.instance or not self.instance.target_users.exists():
                raise serializers.ValidationError(
                    {"target_user_ids": "Select at least one user."}
                )
        if audience_type == Announcement.AUDIENCE_PROJECTS:
            if target_project_ids is not None:
                if not target_project_ids:
                    raise serializers.ValidationError(
                        {"target_project_ids": "Select at least one project."}
                    )
            elif not self.instance or not self.instance.target_projects.exists():
                raise serializers.ValidationError(
                    {"target_project_ids": "Select at least one project."}
                )
        return attrs

    def create(self, validated_data):
        target_user_ids = validated_data.pop("target_user_ids", [])
        target_project_ids = validated_data.pop("target_project_ids", [])
        announcement = Announcement.objects.create(**validated_data)
        if target_user_ids:
            announcement.target_users.set(target_user_ids)
        if target_project_ids:
            announcement.target_projects.set(target_project_ids)
        return announcement

    def update(self, instance, validated_data):
        target_user_ids = validated_data.pop("target_user_ids", None)
        target_project_ids = validated_data.pop("target_project_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if target_user_ids is not None:
            instance.target_users.set(target_user_ids)
        if target_project_ids is not None:
            instance.target_projects.set(target_project_ids)
        return instance


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_email = serializers.EmailField(source='sender.email', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'sender_username', 'sender_email', 'recipient', 'recipient_name', 'recipient_username', 'recipient_email', 'subject', 'body', 'is_read', 'is_urgent', 'timestamp']
        read_only_fields = ['sender', 'timestamp']
