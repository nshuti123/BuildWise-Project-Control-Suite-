from django.contrib.auth.models import AbstractUser
from django.db import models
from .managers import CustomUserManager

class CustomUser(AbstractUser):
    objects = CustomUserManager()

    ROLE_CHOICES = [
        ('admin', 'System Admin'),
        ('managing-director', 'Managing Director'),
        ('director-finance', 'Director of Finance'),
        ('technical-director', 'Technical Director'),
        ('accountant', 'Accountant'),
        ('project-manager', 'Project Manager'),
        ('procurement-officer', 'Procurement Officer'),
        ('site-engineer', 'Site Engineer'),
        ('site-foreman', 'Site Foreman'),
        ('subcontractor', 'Subcontractor'),
        ('safety-officer', 'Safety Officer'),
        ('client', 'Client'),
    ]

    DEPARTMENT_CHOICES = [
        ('executive', 'Executive'),
        ('finance', 'Finance'),
        ('technical', 'Technical'),
        ('site', 'Site Operations'),
        ('external', 'External'),
    ]

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='site-engineer')
    department = models.CharField(max_length=20, choices=DEPARTMENT_CHOICES, default='site', blank=True)
    job_title = models.CharField(max_length=255, blank=True)
    reports_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports',
    )
    full_name = models.CharField(max_length=255, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.email

class PasswordResetOTP(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.otp}"

class SystemLog(models.Model):
    LOG_TYPES = [
        ('system', 'System'),
        ('security', 'Security'),
        ('user', 'User Action'),
        ('alert', 'Alert'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    type = models.CharField(max_length=50, choices=LOG_TYPES, default='system')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        username = self.user.username if self.user else "System"
        return f"{username} - {self.action} ({self.type})"

class Notification(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    link = models.CharField(max_length=255, blank=True, null=True)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )

    def __str__(self):
        return f"{self.user.username} - {self.title}"

class Message(models.Model):
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    subject = models.CharField(max_length=255)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    is_urgent = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"From {self.sender.username} to {self.recipient.username} - {self.subject}"


class Announcement(models.Model):
    AUDIENCE_ALL = "all"
    AUDIENCE_ROLES = "roles"
    AUDIENCE_USERS = "users"
    AUDIENCE_DEPARTMENTS = "departments"
    AUDIENCE_PROJECTS = "projects"
    AUDIENCE_CHOICES = [
        (AUDIENCE_ALL, "Everyone"),
        (AUDIENCE_ROLES, "By role"),
        (AUDIENCE_USERS, "Specific users"),
        (AUDIENCE_DEPARTMENTS, "By department"),
        (AUDIENCE_PROJECTS, "By project"),
    ]

    title = models.CharField(max_length=255, default="System Announcement")
    body = models.TextField()
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="announcements_created",
    )
    audience_type = models.CharField(
        max_length=20, choices=AUDIENCE_CHOICES, default=AUDIENCE_ALL
    )
    target_roles = models.JSONField(default=list, blank=True)
    target_departments = models.JSONField(default=list, blank=True)
    target_users = models.ManyToManyField(
        CustomUser, blank=True, related_name="announcements_targeting_me"
    )
    target_projects = models.ManyToManyField(
        "projects.Project", blank=True, related_name="announcements"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.audience_type})"


class AnnouncementAcknowledgment(models.Model):
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="acknowledgments"
    )
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="announcement_acks"
    )
    acknowledged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("announcement", "user")

    def __str__(self):
        return f"{self.user.username} ack #{self.announcement_id}"
