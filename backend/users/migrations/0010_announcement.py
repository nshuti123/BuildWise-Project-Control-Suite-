from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0024_project_procurement_officer_project_site_accountant_and_more"),
        ("users", "0009_customuser_department_customuser_job_title_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Announcement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(default="System Announcement", max_length=255)),
                ("body", models.TextField()),
                (
                    "audience_type",
                    models.CharField(
                        choices=[
                            ("all", "Everyone"),
                            ("roles", "By role"),
                            ("users", "Specific users"),
                            ("departments", "By department"),
                            ("projects", "By project"),
                        ],
                        default="all",
                        max_length=20,
                    ),
                ),
                ("target_roles", models.JSONField(blank=True, default=list)),
                ("target_departments", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="announcements_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target_projects",
                    models.ManyToManyField(blank=True, related_name="announcements", to="projects.project"),
                ),
                (
                    "target_users",
                    models.ManyToManyField(
                        blank=True,
                        related_name="announcements_targeting_me",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AnnouncementAcknowledgment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("acknowledged_at", models.DateTimeField(auto_now_add=True)),
                (
                    "announcement",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="acknowledgments",
                        to="users.announcement",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="announcement_acks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"unique_together": {("announcement", "user")}},
        ),
    ]
