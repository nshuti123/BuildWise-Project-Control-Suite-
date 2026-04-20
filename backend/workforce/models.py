from django.db import models
from projects.models import Project
from django.contrib.auth import get_user_model

User = get_user_model()

class Worker(models.Model):
    ROLE_CHOICES = [
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
    
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='workers')
    is_active = models.BooleanField(default=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_role_display()})"

class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('half-day', 'Half-Day'),
        ('leave', 'Leave'),
    ]

    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    overtime_hours = models.DecimalField(max_digits=4, decimal_places=1, default=0.0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('worker', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.worker.first_name} {self.worker.last_name} - {self.date} ({self.status})"

class DailyPayroll(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payrolls')
    date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('paid', 'Paid')
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='initiated_payrolls')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='approved_payrolls', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

class PayrollRecord(models.Model):
    payroll_run = models.ForeignKey(DailyPayroll, on_delete=models.CASCADE, related_name='records')
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE)
    attendance = models.ForeignKey(Attendance, on_delete=models.SET_NULL, null=True)
    calculated_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('payroll_run', 'worker')
