from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.mail import EmailMessage
from django.conf import settings
from .models import Supplier, Material, PurchaseOrder, MaterialRequest
from .serializers import SupplierSerializer, MaterialSerializer, PurchaseOrderSerializer, MaterialRequestSerializer
from .utils import generate_po_pdf


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('-created_at')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all().order_by('-created_at')
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]

from django.utils import timezone

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Auto-evaluate 'delayed' status
        today = timezone.now().date()
        PurchaseOrder.objects.filter(
            status__in=['pending', 'on-track'],
            delivery_date__lt=today
        ).update(status='delayed')
        
        return PurchaseOrder.objects.select_related('supplier', 'material').all().order_by('-created_at')

    def perform_create(self, serializer):
        purchase_order = serializer.save()
        
        # Dispatch the automated email if the supplier has an email address
        if purchase_order.supplier and getattr(purchase_order.supplier, 'email', None):
            try:
                pdf_bytes = generate_po_pdf(purchase_order)
                
                subject = f"New Purchase Order: {purchase_order.po_number}"
                body = f"Hello {purchase_order.supplier.name},\n\nPlease find attached the new Purchase Order ({purchase_order.po_number}) from BuildWise Procurement.\n\nThank you,\nThe BuildWise Team"
                
                # Use a dummy from_email if settings.DEFAULT_FROM_EMAIL is missing
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'procurement@buildwise.local')
                
                email = EmailMessage(
                    subject,
                    body,
                    from_email,
                    [purchase_order.supplier.email],
                )
                
                email.attach(f"{purchase_order.po_number}.pdf", pdf_bytes, 'application/pdf')
                email.send(fail_silently=True)
                
            except Exception as e:
                print(f"Failed to generate/send automated PO email: {e}")

    def perform_update(self, serializer):
        original_status = serializer.instance.status
        purchase_order = serializer.save()
        
        # If PO status transitions to "completed", auto-receive into inventory
        if original_status != 'completed' and purchase_order.status == 'completed':
            try:
                material = purchase_order.material
                material.save()
                print(f"Inventory auto-incremented for Material ID {material.id} by {purchase_order.quantity}")
            except Exception as e:
                print(f"Failed to auto-update material stock: {e}")

class MaterialRequestViewSet(viewsets.ModelViewSet):
    queryset = MaterialRequest.objects.all().order_by('-created_at')
    serializer_class = MaterialRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(self.request.user, 'role') and self.request.user.role == 'site_engineer':
            queryset = queryset.filter(requested_by=self.request.user)
            
        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        material_request = self.get_object()
        action_status = request.data.get('status')
        
        if action_status not in ['approved', 'rejected', 'ordered', 'fulfilled']:
            return Response({'detail': 'Invalid status update.'}, status=status.HTTP_400_BAD_REQUEST)
            
        material_request.status = action_status
        material_request.save()
        return Response(MaterialRequestSerializer(material_request).data)
