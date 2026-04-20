from rest_framework import serializers
from .models import Supplier, Material, PurchaseOrder, MaterialRequest

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

class MaterialRequestSerializer(serializers.ModelSerializer):
    material_name = serializers.ReadOnlyField(source='material.name')
    material_unit = serializers.ReadOnlyField(source='material.unit')
    requested_by_name = serializers.SerializerMethodField()
    project_name = serializers.ReadOnlyField(source='project.name')
    requested_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = MaterialRequest
        fields = '__all__'

    def get_requested_by_name(self, obj):
        return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip() or obj.requested_by.username
