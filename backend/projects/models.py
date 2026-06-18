from django.db import models
from django.conf import settings
import uuid
from .utils import add_working_days

class Location(models.Model):
    LEVEL_CHOICES = (
        ('PROVINCE', 'Province'),
        ('DISTRICT', 'District'),
        ('SECTOR', 'Sector'),
        ('CELL', 'Cell'),
        ('VILLAGE', 'Village'),
    )
    name = models.CharField(max_length=255)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')

    def __str__(self):
        return f"{self.name} ({self.get_level_display()})"

class Project(models.Model):
    STATUS_CHOICES = [
        ('on-track', 'On Track'),
        ('at-risk', 'At Risk'),
        ('delayed', 'Delayed'),
        ('completed', 'Completed'),
    ]
    CONSTRUCTION_TYPE_CHOICES = [
        ('commercial', 'Commercial'),
        ('residential', 'Residential'),
        ('industrial', 'Industrial'),
        ('infrastructure', 'Infrastructure'),
    ]
    name = models.CharField(max_length=255)
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    address_line_2 = models.CharField(max_length=255, blank=True)
    construction_type = models.CharField(max_length=50, choices=CONSTRUCTION_TYPE_CHOICES, default='commercial')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='on-track')
    status_is_manual = models.BooleanField(
        default=False,
        help_text='When true, automatic status rules do not overwrite this project.',
    )
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='managed_projects')
    site_engineer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='engineered_projects', limit_choices_to={'role': 'site-engineer'})
    procurement_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='procurement_projects',
        limit_choices_to={'role': 'procurement-officer'},
    )
    project_accountant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finance_lead_projects',
        limit_choices_to={'role': 'accountant'},
    )
    site_foreman = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='foreman_projects',
        limit_choices_to={'role': 'site-foreman'},
    )
    subcontractors = models.ManyToManyField(settings.AUTH_USER_MODEL, limit_choices_to={'role': 'subcontractor'}, blank=True, related_name='subcontracted_projects')
    budget = models.CharField(max_length=50, blank=True, help_text="e.g. Rwf450M")
    # Canonical numeric budget in RWF (preferred for all calculations)
    budget_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    progress = models.IntegerField(default=0, help_text="Percentage 0-100")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Task(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    WORKER_ROLE_CHOICES = [
        ('mason', 'Mason'),
        ('carpenter', 'Carpenter'),
        ('plumber', 'Plumber'),
        ('electrician', 'Electrician'),
        ('laborer', 'Laborer'),
        ('welder', 'Welder'),
        ('painter', 'Painter'),
        ('driver', 'Driver'),
        ('other', 'Other'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks', null=True)
    assigned_to = models.ManyToManyField('workforce.Worker', related_name='tasks', blank=True)
    required_skills = models.JSONField(default=list, blank=True, help_text="Skills required for auto-assignment")
    phase_task = models.ForeignKey('PhaseTask', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    date = models.DateField(null=True, blank=True)
    time_str = models.CharField(max_length=50, blank=True, help_text="e.g. 09:00 AM")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Notification Flow Flags
    reminded_due_soon = models.BooleanField(default=False)
    reminded_overdue = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.status}"

    def save(self, *args, **kwargs):
        if self.status == 'completed':
            self.reminded_due_soon = False
            self.reminded_overdue = False
        super().save(*args, **kwargs)
        if self.phase_task and self.phase_task.tracking_method == 'subtasks':
            # Trigger recalcluation on parent PhaseTask
            self.phase_task.save()


class TaskProgressPhoto(models.Model):
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="progress_photos"
    )
    image = models.ImageField(upload_to="task_progress/%Y/%m/")
    caption = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        "users.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_photos_uploaded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Photo for task #{self.task_id}"


class SubTask(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    parent_task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='subtasks')
    title = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    assigned_to = models.ManyToManyField('workforce.Worker', related_name='assigned_subtasks', blank=True)
    required_skills = models.JSONField(default=list, blank=True, help_text="Skills required for auto-assignment")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} (Subtask of {self.parent_task.title})"

class Milestone(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('on-track', 'On Track'),
        ('completed', 'Completed'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    name = models.CharField(max_length=255)
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ProjectPhase(models.Model):
    """Construction phase container for scheduling tasks within a project."""
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name='phases'
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_standard = models.BooleanField(
        default=False,
        help_text="True when created from the standard construction phase template.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']
        unique_together = [('project', 'name')]

    def __str__(self):
        return f"{self.project.name} — {self.name}"


class PhaseTask(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('on-track', 'On Track'),
        ('completed', 'Completed'),
    ]
    TRACKING_CHOICES = [
        ('manual', 'Manual Percentage'),
        ('subtasks', 'Subtasks Checkboxes'),
        ('units', 'Physical Units/Quantities'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='phase_tasks')
    project_phase = models.ForeignKey(
        ProjectPhase,
        on_delete=models.CASCADE,
        related_name='tasks',
        null=True,
        blank=True,
    )
    phase = models.CharField(max_length=100)
    task_name = models.CharField(max_length=255)
    assigned_to = models.ManyToManyField('workforce.Worker', related_name='assigned_phase_tasks', blank=True, help_text="Workers assigned to execute this phase task")
    depends_on = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='dependent_tasks', help_text="Task that must be completed before this one")
    tracking_method = models.CharField(max_length=20, choices=TRACKING_CHOICES, default='manual')
    target_units = models.IntegerField(default=0)
    completed_units = models.IntegerField(default=0)
    unit_name = models.CharField(max_length=50, blank=True, help_text="e.g. Tons, Meters, Hours")
    start_date = models.DateField()
    duration_working_days = models.IntegerField(default=1)
    end_date = models.DateField(blank=True, null=True)
    progress = models.IntegerField(default=0, help_text="Percentage 0-100")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.phase} - {self.task_name}"

    def save(self, *args, **kwargs):
        if self.tracking_method == 'units':
            if self.target_units > 0:
                self.progress = min(100, int((self.completed_units / self.target_units) * 100))
            else:
                self.progress = 0
        elif self.tracking_method == 'subtasks':
            if self.pk:
                total = self.sub_tasks.count()
                if total > 0:
                    from .services import calculate_task_progress
                    total_progress = sum(calculate_task_progress(t) for t in self.sub_tasks.all())
                    self.progress = int(total_progress / total)
                else:
                    self.progress = 0

        if self.progress == 100:
            self.status = 'completed'
        elif self.progress > 0 and self.status == 'pending':
            self.status = 'on-track'

        if self.start_date and self.duration_working_days:
            self.end_date = add_working_days(self.start_date, self.duration_working_days)

        if self.project_phase_id:
            self.phase = self.project_phase.name

        super().save(*args, **kwargs)

class ProjectBaseline(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='baselines')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.name} - {self.name}"

class PhaseTaskBaseline(models.Model):
    baseline = models.ForeignKey(ProjectBaseline, on_delete=models.CASCADE, related_name='baseline_tasks')
    original_task = models.ForeignKey(PhaseTask, on_delete=models.SET_NULL, null=True, related_name='baseline_records')
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    duration_working_days = models.IntegerField(default=1)
    status = models.CharField(max_length=20, default='pending')

    def __str__(self):
        return f"{self.baseline.name} - Task {self.original_task.id if self.original_task else 'Deleted'}"


# =====================================================
# BUDGET & COST CONTROL MODELS
# =====================================================

class BudgetCategory(models.Model):
    """Budget categories like Labor, Materials, Equipment, etc."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=20, default="#3b82f6")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class BudgetItem(models.Model):
    """Individual budget line items within a project"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='budget_items')
    category = models.ForeignKey(BudgetCategory, on_delete=models.PROTECT, related_name='budget_items')
    description = models.CharField(max_length=255)
    planned_amount = models.DecimalField(max_digits=15, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def variance(self):
        return self.actual_amount - self.planned_amount

    @property
    def variance_percent(self):
        if self.planned_amount > 0:
            return (self.variance / self.planned_amount) * 100
        return 0

    def __str__(self):
        return f"{self.project.name} - {self.category.name}: {self.description}"

class SiteIncident(models.Model):
    INCIDENT_TYPES = [
        ('safety', 'Safety Issue'),
        ('equipment', 'Equipment Issue'),
        ('quality', 'Quality Defect'),
        ('other', 'Other Incident'),
    ]
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('resolved', 'Resolved'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='incidents')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reported_incidents')
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPES)
    severity = models.CharField(max_length=50, choices=SEVERITY_CHOICES, default='medium')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='open')
    description = models.TextField()
    date_reported = models.DateTimeField(auto_now_add=True)
    date_resolved = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"[{self.get_severity_display()}] {self.get_incident_type_display()} at {self.project.name}"

class Transaction(models.Model):
    """Actual expenses/transactions for a project"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='transactions')
    budget_item = models.ForeignKey(BudgetItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    category = models.ForeignKey(BudgetCategory, on_delete=models.PROTECT, related_name='transactions')
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    transaction_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.name} - {self.amount} - {self.transaction_date}"

# =====================================================
# REPORTING & ANALYTICS MODELS
# =====================================================

class GeneratedReport(models.Model):
    REPORT_TYPES = [
        ('Progress', 'Monthly Progress Report'),
        ('Financial', 'Cost Variance Analysis'),
        ('HR', 'Resource Utilization'),
        ('Procurement', 'Material Inventory Log'),
        ('Timeline', 'Project Timeline Report'),
        ('SiteInventory', 'Site Inventory Report'),
        ('SiteInventoryUsage', 'Site Inventory Usage Report'),
        ('Daily', 'Daily Transactions Report'),
        ('Custom', 'Custom Transactions Report'),
        ('Executive', 'Executive Summary Report'),
    ]
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='generated_reports', null=True, blank=True)
    name = models.CharField(max_length=255)
    report_type = models.CharField(max_length=50, choices=REPORT_TYPES)
    file = models.FileField(upload_to='reports/%Y/%m/')
    file_size_bytes = models.PositiveIntegerField(default=0)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_reports')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_report_type_display()})"


class ProjectDocument(models.Model):
    CATEGORY_CHOICES = [
        ('construction_permit', 'Construction Permit'),
        ('architectural_plan', 'Architectural Plans'),
        ('structural_plan', 'Structural / Engineering Plans'),
        ('contract', 'Contracts & Agreements'),
        ('environmental', 'Environmental / EIA'),
        ('survey', 'Survey & Geotechnical'),
        ('other', 'Other Supporting Document'),
    ]

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name='documents'
    )
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='project_documents/%Y/%m/', blank=True, null=True)
    file_size_bytes = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_project_documents',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.project.name} — {self.title}"


class ProjectDocumentAttachment(models.Model):
    document = models.ForeignKey(
        ProjectDocument,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file = models.FileField(upload_to='project_documents/%Y/%m/')
    file_size_bytes = models.PositiveIntegerField(default=0)
    original_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.original_name or self.file.name.split('/')[-1]
