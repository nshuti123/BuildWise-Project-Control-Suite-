from django.db import models
from django.conf import settings

class Supplier(models.Model):
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    materials_supplied = models.ManyToManyField('Material', related_name='suppliers', blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Material(models.Model):
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=50) # e.g., Bags, Tons, Trips
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    current_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    minimum_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.current_stock} {self.unit})"

class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('on-track', 'On Track'),
        ('delayed', 'Delayed'),
        ('completed', 'Completed'),
    ]

    po_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='orders')
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='orders')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='on-track')
    
    ORDER_TYPE_CHOICES = [
        ('material', 'Material'),
        ('equipment', 'Equipment'),
    ]
    order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES, default='material')
    
    order_date = models.DateField()
    delivery_date = models.DateField(blank=True, null=True)
    project = models.ForeignKey('projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PO #{self.po_number} - {self.supplier.name}"


class MaterialRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('po_approved', 'Procurement Approved'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('ordered', 'Ordered'),
        ('fulfilled', 'Fulfilled'),
    ]

    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='material_requests')
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='requests')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='material_requests')
    quantity_requested = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    rejection_notes = models.TextField(
        blank=True,
        help_text='Reason returned to the requester when this requisition is rejected.',
    )
    site_engineer_confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='material_requests_confirmed',
    )
    site_engineer_confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.material.name} - {self.quantity_requested} ({self.status})"

class SiteInventory(models.Model):
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='site_inventory')
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='site_inventory')
    current_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'material')

    def __str__(self):
        return f"{self.project.name} - {self.material.name} ({self.current_stock})"

class MaterialAllocation(models.Model):
    site_inventory = models.ForeignKey(SiteInventory, on_delete=models.CASCADE, related_name='allocations')
    task = models.ForeignKey('projects.Task', on_delete=models.CASCADE, related_name='material_allocations')
    allocated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='material_allocations')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    date_allocated = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.quantity} of {self.site_inventory.material.name} to {self.task.task_name}"
