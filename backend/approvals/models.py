from django.db import models
from django.conf import settings


class ApprovalRequest(models.Model):
    REQUEST_TYPES = [
        ('material_request', 'Material Request'),
        ('purchase_order', 'Purchase Order'),
        ('transaction', 'Transaction'),
        ('task_complete', 'Task Completion'),
        ('incident', 'Site Incident'),
        ('allocation', 'Material Allocation'),
        ('staff_assignment', 'Staff Assignment'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('po_approved', 'Procurement Approved'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    request_type = models.CharField(max_length=50, choices=REQUEST_TYPES)
    object_type = models.CharField(max_length=100)
    object_id = models.PositiveIntegerField()
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='approval_requests',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='approval_requests_submitted',
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_requests_to_review',
    )
    procurement_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_requests_procurement_reviewed',
    )
    procurement_reviewed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_request_type_display()} #{self.object_id} ({self.status})"
