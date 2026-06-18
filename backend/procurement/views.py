from django.db import models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Supplier, Material, PurchaseOrder, MaterialRequest
from .serializers import SupplierSerializer, MaterialSerializer, PurchaseOrderSerializer, MaterialRequestSerializer
from .utils import email_po_to_supplier


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
        
        from users.services import projects_queryset_for_user
        allowed = projects_queryset_for_user(self.request.user)
        return PurchaseOrder.objects.filter(
            models.Q(project__in=allowed) | models.Q(project__isnull=True)
        ).select_related('supplier', 'material').order_by('-created_at')

    def perform_create(self, serializer):
        from django.db import transaction as db_transaction
        from rest_framework.exceptions import ValidationError

        with db_transaction.atomic():
            purchase_order = serializer.save(status='on-track')
            try:
                email_po_to_supplier(purchase_order)
            except Exception as e:
                print(f"Failed to generate/send automated PO email: {e}")
                raise ValidationError({
                    'detail': (
                        'Could not email the purchase order to the supplier. '
                        'Check the supplier email and mail settings, then try again. '
                        f'({e})'
                    ),
                }) from e

    def perform_update(self, serializer):
        original_status = serializer.instance.status
        purchase_order = serializer.save()
        
        # If PO status transitions to "completed", auto-receive into inventory
        if original_status != 'completed' and purchase_order.status == 'completed':
            try:
                material = purchase_order.material
                material.current_stock += purchase_order.quantity
                material.save()
                print(f"Inventory auto-incremented for Material ID {material.id} by {purchase_order.quantity}")
            except Exception as e:
                print(f"Failed to auto-update material stock: {e}")

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        from .po_expense import delete_purchase_order

        ok, message = delete_purchase_order(instance, self.request.user)
        if not ok:
            if 'permission' in message.lower():
                raise PermissionDenied(message)
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': message})

    @action(detail=True, methods=['post'], url_path='request-payment')
    def request_payment(self, request, pk=None):
        purchase_order = self.get_object()
        
        if purchase_order.status != 'on-track':
            return Response({'detail': 'Can only request payment for on-track orders.'}, status=400)
            
        purchase_order.status = 'pending'
        purchase_order.save()

        if purchase_order.project:
            from rest_framework.exceptions import ValidationError
            from .po_expense import ensure_po_pending_transaction

            try:
                ensure_po_pending_transaction(
                    purchase_order, request.user, notify=False
                )
            except ValidationError as exc:
                purchase_order.status = 'on-track'
                purchase_order.save(update_fields=['status'])
                raise exc
                
        return Response(self.get_serializer(purchase_order).data)

class MaterialRequestViewSet(viewsets.ModelViewSet):
    queryset = MaterialRequest.objects.all().order_by('-created_at')
    serializer_class = MaterialRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        from users.services import projects_queryset_for_user
        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(project__in=allowed)

        role = getattr(self.request.user, 'role', None)
        if role == 'site-foreman':
            queryset = queryset.filter(requested_by=self.request.user)
        elif role == 'site-engineer':
            queryset = queryset.filter(
                Q(requested_by=self.request.user)
                | Q(
                    project__site_engineer=self.request.user,
                    requested_by__role='site-foreman',
                )
            )

        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset

    def _create_material_request_approval(self, material_request, user):
        from users.services import resolve_procurement_officer_for_project
        from approvals.services import create_approval_request

        project = material_request.project
        if user.role == 'site-foreman':
            se = getattr(project, 'site_engineer', None) if project else None
            if not se:
                from rest_framework import serializers as drf_serializers
                raise drf_serializers.ValidationError(
                    {
                        'detail': (
                            'This project has no site engineer assigned. '
                            'Ask the project manager to assign one before requesting materials.'
                        )
                    }
                )
            create_approval_request(
                request_type='material_request',
                object_type='procurement.MaterialRequest',
                object_id=material_request.id,
                requested_by=user,
                title=f'Material request: {material_request.material.name}',
                description=material_request.notes or '',
                project=project,
                approver=se,
            )
            return

        create_approval_request(
            request_type='material_request',
            object_type='procurement.MaterialRequest',
            object_id=material_request.id,
            requested_by=user,
            title=f'Material request: {material_request.material.name}',
            description=material_request.notes or '',
            project=project,
            approver=resolve_procurement_officer_for_project(project),
        )

    def perform_create(self, serializer):
        from django.db import transaction
        from rest_framework import serializers as drf_serializers
        from users.services import user_requires_approval, user_has_technical_oversight
        from approvals.services import create_approval_request, direct_approve_material_request

        user = self.request.user
        with transaction.atomic():
            mr = serializer.save(requested_by=user)

            if user_has_technical_oversight(user):
                ok, message = direct_approve_material_request(
                    mr,
                    user,
                    notes='Fulfilled immediately — requested by Technical Director',
                )
                if not ok:
                    raise drf_serializers.ValidationError({'detail': message})
                return

            if user_requires_approval(user):
                self._create_material_request_approval(mr, user)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        from users.services import user_has_full_access

        role = getattr(request.user, 'role', None)
        material_request = self.get_object()
        action_status = request.data.get('status')
        notes = request.data.get('notes', '')

        if role == 'site-foreman':
            return Response(
                {'detail': 'Site foremen cannot approve material requests.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if role == 'site-engineer':
            if action_status == 'approved':
                from approvals.services import site_engineer_confirm_material_request
                ok, message = site_engineer_confirm_material_request(
                    material_request, request.user, notes=notes
                )
                if not ok:
                    return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
                material_request.refresh_from_db()
                return Response(MaterialRequestSerializer(material_request).data)
            if action_status == 'rejected':
                from approvals.services import _material_request_approval_row, reject_approval
                approval = _material_request_approval_row(material_request, ('pending',))
                if not approval:
                    return Response(
                        {'detail': 'No pending approval found for this requisition.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not (notes or '').strip():
                    return Response(
                        {'detail': 'Please add rejection notes before returning this requisition to site.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                ok, message = reject_approval(approval, request.user, notes=notes)
                if not ok:
                    return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
                material_request.refresh_from_db()
                return Response(MaterialRequestSerializer(material_request).data)
            return Response({'detail': 'Invalid status update.'}, status=status.HTTP_400_BAD_REQUEST)

        if action_status not in ['approved', 'rejected', 'ordered', 'fulfilled']:
            return Response({'detail': 'Invalid status update.'}, status=status.HTTP_400_BAD_REQUEST)

        if action_status == 'approved' and not (notes or '').strip():
            return Response(
                {'detail': 'Please add approval notes before approving this requisition.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action_status == 'rejected' and not (notes or '').strip():
            return Response(
                {'detail': 'Please add rejection notes before returning this requisition to site.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action_status == 'approved' and role == 'procurement-officer':
            from approvals.services import po_approve_material_request
            ok, message = po_approve_material_request(
                material_request, request.user, notes=notes
            )
            if not ok:
                return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
            material_request.refresh_from_db()
            return Response(MaterialRequestSerializer(material_request).data)

        if action_status == 'approved' and role in ('project-manager', 'technical-director'):
            from approvals.services import (
                finalize_material_request_after_po,
                direct_approve_material_request,
            )
            if material_request.status == 'po_approved':
                ok, message = finalize_material_request_after_po(
                    material_request, request.user, notes=notes
                )
            elif material_request.status == 'pending':
                ok, message = direct_approve_material_request(
                    material_request, request.user, notes=notes
                )
            else:
                return Response(
                    {'detail': 'This request cannot be approved in its current state.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not ok:
                return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
            material_request.refresh_from_db()
            return Response(MaterialRequestSerializer(material_request).data)

        if action_status == 'approved' and user_has_full_access(request.user):
            from approvals.services import (
                po_approve_material_request,
                finalize_material_request_after_po,
                direct_approve_material_request,
            )
            if material_request.status == 'pending':
                direct_approve_material_request(material_request, request.user, notes=notes)
            elif material_request.status == 'po_approved':
                finalize_material_request_after_po(material_request, request.user, notes=notes)
            material_request.refresh_from_db()
            return Response(MaterialRequestSerializer(material_request).data)

        if action_status == 'approved':
            return Response(
                {
                    'detail': (
                        'Procurement Officer: approve first (no stock). '
                        'Project Manager or Technical Director: confirm after PO, '
                        'or approve directly from pending.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action_status == 'rejected':
            from approvals.services import _material_request_approval_row, reject_approval
            approval = _material_request_approval_row(
                material_request, ('pending', 'po_approved')
            )
            if approval:
                ok, message = reject_approval(approval, request.user, notes=notes)
                if not ok:
                    return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
                material_request.refresh_from_db()
                return Response(MaterialRequestSerializer(material_request).data)

        if action_status == 'rejected':
            material_request.status = 'rejected'
            material_request.rejection_notes = (notes or '').strip()
            material_request.save(update_fields=['status', 'rejection_notes'])
            return Response(MaterialRequestSerializer(material_request).data)

        material_request.status = action_status
        material_request.save(update_fields=['status'])
        return Response(MaterialRequestSerializer(material_request).data)

    @action(detail=True, methods=['post'], url_path='resubmit')
    def resubmit(self, request, pk=None):
        """Return a rejected requisition to pending after the requester revises it."""
        from rest_framework.exceptions import PermissionDenied
        from users.services import resolve_procurement_officer_for_project
        from approvals.services import create_approval_request
        from approvals.models import ApprovalRequest

        material_request = self.get_object()
        role = getattr(request.user, 'role', None)
        if role not in ('site-engineer', 'site-foreman'):
            raise PermissionDenied('Only field staff can revise and resubmit requisitions.')
        if material_request.requested_by_id != request.user.id:
            raise PermissionDenied('You can only resubmit your own requisitions.')
        if material_request.status != 'rejected':
            return Response(
                {'detail': 'Only rejected requisitions can be revised and resubmitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quantity = request.data.get('quantity_requested')
        material_id = request.data.get('material')
        if quantity is not None:
            material_request.quantity_requested = quantity
        if material_id is not None:
            material_request.material_id = material_id
        if 'notes' in request.data:
            material_request.notes = request.data.get('notes') or ''

        from .models import Material
        from .stock_validation import (
            FIELD_REQUISITION_STOCK_MESSAGE,
            quantity_exceeds_warehouse_stock,
        )

        material = material_request.material
        if material_id is not None:
            material = Material.objects.filter(pk=material_id).first()
        if quantity_exceeds_warehouse_stock(material, material_request.quantity_requested):
            return Response(
                {'quantity_requested': FIELD_REQUISITION_STOCK_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST,
            )

        material_request.status = 'pending'
        material_request.rejection_notes = ''
        material_request.site_engineer_confirmed_by = None
        material_request.site_engineer_confirmed_at = None
        material_request.save()

        approval = (
            ApprovalRequest.objects.filter(
                request_type='material_request',
                object_id=material_request.id,
            )
            .order_by('-created_at')
            .first()
        )
        notified = False
        if approval:
            approval.status = 'pending'
            approval.notes = ''
            approval.resolved_at = None
            approval.procurement_reviewer = None
            approval.procurement_reviewed_at = None
            if material_request.requested_by.role == 'site-foreman':
                se = material_request.project.site_engineer if material_request.project_id else None
                approval.approver = se
            else:
                approval.approver = resolve_procurement_officer_for_project(material_request.project)
            approval.save()
        else:
            self._create_material_request_approval(material_request, request.user)
            notified = True

        if not notified:
            approver = approval.approver if approval else None
            if not approver and material_request.requested_by.role == 'site-foreman':
                approver = material_request.project.site_engineer if material_request.project_id else None
            elif not approver:
                approver = resolve_procurement_officer_for_project(material_request.project)
            if approver:
                from users.notification_utils import create_notification
                create_notification(
                    user=approver,
                    title='Material requisition resubmitted',
                    message=(
                        f'{request.user.full_name or request.user.username} revised and resubmitted '
                        f'a request for {material_request.material.name}.'
                    ),
                    link='site-inventory' if approver.role == 'site-engineer' else 'procurement',
                    project=material_request.project,
                )

        return Response(MaterialRequestSerializer(material_request).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        from approvals.services import cancel_material_request

        material_request = self.get_object()
        ok, message = cancel_material_request(material_request, request.user)
        if not ok:
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
        material_request.refresh_from_db()
        return Response(MaterialRequestSerializer(material_request).data)

from .models import SiteInventory, MaterialAllocation
from .serializers import SiteInventorySerializer, MaterialAllocationSerializer

class SiteInventoryViewSet(viewsets.ModelViewSet):
    queryset = SiteInventory.objects.all().order_by('-updated_at')
    serializer_class = SiteInventorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from users.services import projects_queryset_for_user
        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(project__in=allowed)
        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

class MaterialAllocationViewSet(viewsets.ModelViewSet):
    queryset = MaterialAllocation.objects.all().order_by('-date_allocated')
    serializer_class = MaterialAllocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.utils.dateparse import parse_date
        from users.services import projects_queryset_for_user
        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(site_inventory__project__in=allowed)
        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(site_inventory__project_id=project_id)
        date_param = self.request.query_params.get('date')
        if date_param:
            day = parse_date(date_param)
            if day:
                queryset = queryset.filter(date_allocated__date=day)
        return queryset

    def perform_create(self, serializer):
        from django.db import transaction
        from rest_framework import serializers as drf_serializers
        from users.services import user_requires_approval
        from approvals.services import create_approval_request

        user = self.request.user
        quantity = serializer.validated_data['quantity']

        with transaction.atomic():
            site_inv = SiteInventory.objects.select_for_update().get(
                pk=serializer.validated_data['site_inventory'].pk
            )

            if site_inv.current_stock < quantity:
                raise drf_serializers.ValidationError(
                    {'detail': 'Insufficient stock in site inventory.'}
                )

            allocation = serializer.save(allocated_by=user)

            site_inv.current_stock -= quantity
            site_inv.save(update_fields=['current_stock'])

            if user_requires_approval(user):
                create_approval_request(
                    request_type='allocation',
                    object_type='procurement.MaterialAllocation',
                    object_id=allocation.id,
                    requested_by=user,
                    title=f'Material allocation: {allocation.site_inventory.material.name}',
                    project=allocation.site_inventory.project,
                )
