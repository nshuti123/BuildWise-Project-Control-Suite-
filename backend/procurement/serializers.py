import random

from django.utils import timezone
from rest_framework import serializers
from .models import Supplier, Material, PurchaseOrder, MaterialRequest


def generate_unique_po_number() -> str:
    year = timezone.now().year
    for _ in range(20):
        candidate = f"PO-{year}-{random.randint(10000, 99999)}"
        if not PurchaseOrder.objects.filter(po_number=candidate).exists():
            return candidate
    raise serializers.ValidationError(
        {"po_number": "Could not generate a unique purchase order number. Try again."}
    )

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = '__all__'

class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    material_name = serializers.ReadOnlyField(source='material.name')
    material_unit = serializers.ReadOnlyField(source='material.unit')

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        extra_kwargs = {
            'po_number': {'required': False, 'allow_blank': True},
        }

    def _budget_user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None) if request else None

    def validate(self, data):
        order_date = data.get('order_date', getattr(self.instance, 'order_date', None))
        delivery_date = data.get(
            'delivery_date',
            getattr(self.instance, 'delivery_date', None) if self.instance else None,
        )
        if delivery_date and order_date and delivery_date < order_date:
            raise serializers.ValidationError(
                {
                    'delivery_date': (
                        'Delivery date cannot be earlier than the order date.'
                    )
                }
            )

        project = data.get('project', getattr(self.instance, 'project', None))
        if not project:
            return data

        amount = data.get('total_amount', getattr(self.instance, 'total_amount', None))
        order_type = data.get('order_type', getattr(self.instance, 'order_type', 'material'))
        from decimal import Decimal
        from projects.budget_allocation import (
            procurement_category_for_order_type,
            require_category_budget_available,
        )

        category_name = procurement_category_for_order_type(order_type)
        user = self._budget_user()

        if self.instance is None:
            supplier = data.get('supplier')
            if supplier and not getattr(supplier, 'email', None):
                raise serializers.ValidationError(
                    {
                        'supplier': (
                            f'Supplier "{supplier.name}" has no email address. '
                            'Add an email on the supplier record before placing an order.'
                        )
                    }
                )
            try:
                amount_value = Decimal(str(amount or 0))
            except Exception:
                amount_value = Decimal("0")
            if amount_value <= 0:
                raise serializers.ValidationError(
                    {
                        "total_amount": (
                            "Total amount must be greater than zero. "
                            "Select a material and enter a quantity."
                        )
                    }
                )
            require_category_budget_available(project, category_name, amount, user=user)
            return data

        status = data.get('status', self.instance.status)
        if status == 'completed' and self.instance.status != 'completed':
            require_category_budget_available(project, category_name, amount, user=user)

        if 'total_amount' in data and data['total_amount'] != self.instance.total_amount:
            require_category_budget_available(
                project, category_name, data['total_amount'], user=user
            )

        return data

    def create(self, validated_data):
        if not validated_data.get('po_number'):
            validated_data['po_number'] = generate_unique_po_number()
        return super().create(validated_data)

class MaterialRequestSerializer(serializers.ModelSerializer):
    material_name = serializers.ReadOnlyField(source='material.name')
    material_unit = serializers.ReadOnlyField(source='material.unit')
    requested_by_name = serializers.SerializerMethodField()
    requested_by_role = serializers.CharField(source='requested_by.role', read_only=True)
    site_engineer_confirmed_by_name = serializers.SerializerMethodField()
    project_name = serializers.ReadOnlyField(source='project.name')
    requested_by = serializers.PrimaryKeyRelatedField(read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    approval_notes = serializers.SerializerMethodField()

    class Meta:
        model = MaterialRequest
        fields = '__all__'
        read_only_fields = ('rejection_notes',)

    def get_requested_by_name(self, obj):
        return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip() or obj.requested_by.username

    def get_site_engineer_confirmed_by_name(self, obj):
        user = obj.site_engineer_confirmed_by
        if not user:
            return None
        return f"{user.first_name} {user.last_name}".strip() or user.username

    def _latest_material_approval(self, obj, statuses):
        from approvals.models import ApprovalRequest

        return (
            ApprovalRequest.objects.filter(
                request_type='material_request',
                object_id=obj.id,
                status__in=statuses,
            )
            .select_related('approver')
            .order_by('-resolved_at')
            .first()
        )

    def get_reviewed_by_name(self, obj):
        approval = self._latest_material_approval(obj, ('approved', 'rejected'))
        if not approval or not approval.approver:
            return None
        user = approval.approver
        return f"{user.first_name} {user.last_name}".strip() or user.username

    def get_approval_notes(self, obj):
        if obj.status not in ('approved', 'fulfilled', 'ordered'):
            return ''
        approval = self._latest_material_approval(obj, ('approved',))
        return (approval.notes or '').strip() if approval else ''

    def validate(self, data):
        from .stock_validation import (
            FIELD_REQUISITION_STOCK_MESSAGE,
            quantity_exceeds_warehouse_stock,
        )

        material = data.get('material') or getattr(self.instance, 'material', None)
        quantity = data.get(
            'quantity_requested',
            getattr(self.instance, 'quantity_requested', None),
        )
        if material and quantity is not None and quantity_exceeds_warehouse_stock(
            material, quantity,
        ):
            raise serializers.ValidationError(
                {'quantity_requested': FIELD_REQUISITION_STOCK_MESSAGE},
            )
        return data

from .models import SiteInventory, MaterialAllocation

class SiteInventorySerializer(serializers.ModelSerializer):
    material_name = serializers.ReadOnlyField(source='material.name')
    material_unit = serializers.ReadOnlyField(source='material.unit')
    material_minimum_stock = serializers.DecimalField(
        source='material.minimum_stock',
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    project_name = serializers.ReadOnlyField(source='project.name')

    class Meta:
        model = SiteInventory
        fields = '__all__'

class MaterialAllocationSerializer(serializers.ModelSerializer):
    material_name = serializers.ReadOnlyField(source='site_inventory.material.name')
    material_unit = serializers.ReadOnlyField(source='site_inventory.material.unit')
    task_name = serializers.ReadOnlyField(source='task.title')
    allocated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MaterialAllocation
        fields = '__all__'
        read_only_fields = ['allocated_by']

    def get_allocated_by_name(self, obj):
        return f"{obj.allocated_by.first_name} {obj.allocated_by.last_name}".strip() or obj.allocated_by.username
