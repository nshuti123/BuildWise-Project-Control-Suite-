from django.db import models
from django.conf import settings

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
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='managed_projects')
    site_engineer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='engineered_projects', limit_choices_to={'role': 'site-engineer'})
    subcontractors = models.ManyToManyField(settings.AUTH_USER_MODEL, limit_choices_to={'role': 'subcontractor'}, blank=True, related_name='subcontracted_projects')
    budget = models.CharField(max_length=50, blank=True, help_text="e.g. Rwf450M")
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
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks', null=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='tasks')
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
        super().save(*args, **kwargs)
        if self.phase_task and self.phase_task.tracking_method == 'subtasks':
            # Trigger recalcluation on parent PhaseTask
            self.phase_task.save()

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
    phase = models.CharField(max_length=100)
    task_name = models.CharField(max_length=255)
    tracking_method = models.CharField(max_length=20, choices=TRACKING_CHOICES, default='manual')
    target_units = models.IntegerField(default=0)
    completed_units = models.IntegerField(default=0)
    unit_name = models.CharField(max_length=50, blank=True, help_text="e.g. Tons, Meters, Hours")
    start_date = models.DateField()
    end_date = models.DateField()
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
                    completed = self.sub_tasks.filter(status='completed').count()
                    self.progress = int((completed / total) * 100)
                else:
                    self.progress = 0

        if self.progress == 100:
            self.status = 'completed'
        elif self.progress > 0 and self.status == 'pending':
            self.status = 'on-track'
            
        super().save(*args, **kwargs)
