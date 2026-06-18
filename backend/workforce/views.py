from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.exceptions import PermissionDenied, ValidationError
import csv
import io
from django.utils import timezone
from .models import Worker, Attendance, DailyPayroll, PayrollRecord
from .serializers import WorkerSerializer, AttendanceSerializer, DailyPayrollSerializer
from .permissions import (
    assert_project_in_user_scope,
    assert_site_foreman_initiate_payroll,
    deny_site_foreman_worker_mutation,
)
from .payroll_service import (
    _payroll_blocks_attendance,
    attendance_change_blocked_for_user,
    get_active_payroll_for_date,
    recalculate_payroll_from_attendance,
    user_can_edit_attendance_during_payroll_review,
    STATUS_AWAITING_SITE,
)


def _scoped_workers_queryset(request):
    from users.services import projects_queryset_for_user

    Worker.objects.filter(is_active=True, end_date__lt=timezone.now().date()).update(
        is_active=False
    )
    allowed = projects_queryset_for_user(request.user)
    queryset = Worker.objects.filter(project__in=allowed).order_by("first_name", "last_name")
    project_id = request.query_params.get("project")
    if project_id is not None:
        queryset = queryset.filter(project_id=project_id)
    return queryset


class WorkerViewSet(viewsets.ModelViewSet):
    serializer_class = WorkerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scoped_workers_queryset(self.request)

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project")
        project_id = getattr(project, "id", project)
        assert_project_in_user_scope(self.request.user, project_id)
        serializer.save()

    def perform_update(self, serializer):
        deny_site_foreman_worker_mutation(self.request.user, "update")
        assert_project_in_user_scope(
            self.request.user, serializer.instance.project_id
        )
        serializer.save()

    def perform_destroy(self, instance):
        deny_site_foreman_worker_mutation(self.request.user, "destroy")
        assert_project_in_user_scope(self.request.user, instance.project_id)
        instance.delete()

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        deny_site_foreman_worker_mutation(request.user, "bulk_upload")
        if 'file' not in request.FILES:
            return Response({'detail': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        if not file.name.endswith('.csv'):
            return Response({'detail': 'Please upload a CSV file (Excel exported as CSV)'}, status=status.HTTP_400_BAD_REQUEST)
        
        project_id = request.data.get('project')
        if not project_id:
            return Response({'detail': 'Project ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        assert_project_in_user_scope(request.user, project_id)

        try:
            decoded_file = file.read().decode('utf-8-sig') # utf-8-sig removes BOM if present
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            workers_to_create = []
            for row in reader:
                workers_to_create.append(Worker(
                    project_id=project_id,
                    first_name=row.get('first_name', '').strip(),
                    last_name=row.get('last_name', '').strip(),
                    phone_number=row.get('phone_number', '').strip(),
                    role=row.get('role', 'laborer').strip().lower(),
                    daily_rate=row.get('daily_rate', 0.00) or 0.00,
                    start_date=row.get('start_date', '').strip() or None,
                    end_date=row.get('end_date', '').strip() or None,
                    is_active=True
                ))
            
            if not workers_to_create:
                return Response({'detail': 'CSV file is empty or missing headers (first_name, last_name, role, etc)'}, status=status.HTTP_400_BAD_REQUEST)

            Worker.objects.bulk_create(workers_to_create)
            
            return Response({'detail': f'Successfully bulk inserted {len(workers_to_create)} workers!'})
        except Exception as e:
            return Response({'detail': f'Error parsing CSV file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from users.services import projects_queryset_for_user

        allowed = projects_queryset_for_user(self.request.user)
        queryset = Attendance.objects.filter(worker__project__in=allowed).order_by(
            "-date", "worker__first_name"
        )
        project_id = self.request.query_params.get('project', None)
        date = self.request.query_params.get('date', None)
        
        if project_id is not None:
            queryset = queryset.filter(worker__project_id=project_id)
        if date is not None:
            queryset = queryset.filter(date=date)
            
        return queryset

    def perform_create(self, serializer):
        worker = serializer.validated_data.get('worker')
        assert_project_in_user_scope(self.request.user, worker.project_id)
        date = serializer.validated_data.get('date')
        if attendance_change_blocked_for_user(
            self.request.user, worker.project_id, date
        ):
            raise ValidationError({
                'detail': 'You cannot edit attendance of a day where payment was already initiated.',
            })
        instance = serializer.save()
        self._sync_payroll_after_attendance_change(worker.project_id, date)

    def perform_update(self, serializer):
        worker = getattr(serializer.instance, 'worker', None)
        old_notes = getattr(serializer.instance, 'notes', '') if serializer.instance else ''
        if worker:
            assert_project_in_user_scope(self.request.user, worker.project_id)
        date = getattr(serializer.instance, 'date', None)
        if attendance_change_blocked_for_user(
            self.request.user,
            worker.project_id,
            date,
            validated_data=serializer.validated_data,
            instance=serializer.instance,
        ):
            raise ValidationError({
                'detail': (
                    'You cannot edit attendance after payroll was sent to finance. '
                    'You may only add notes.'
                ),
            })
        instance = serializer.save()
        if worker:
            self._sync_payroll_after_attendance_change(worker.project_id, date)
            new_notes = serializer.validated_data.get('notes')
            if new_notes is not None and new_notes != old_notes:
                if worker.project and worker.project.manager:
                    from users.notification_utils import create_notification
                    create_notification(
                        user=worker.project.manager,
                        title="Attendance Note Submitted",
                        message=(
                            f"A note was added for {worker.first_name} {worker.last_name}'s "
                            f"attendance on {date}: '{instance.notes}'"
                        ),
                        link="workforce",
                        project=worker.project,
                    )

    def _sync_payroll_after_attendance_change(self, project_id, date):
        payroll = get_active_payroll_for_date(project_id, date)
        if not payroll or payroll.status != STATUS_AWAITING_SITE:
            return
        from projects.models import Project

        project = Project.objects.filter(pk=project_id).first()
        if user_can_edit_attendance_during_payroll_review(
            self.request.user, project, date
        ):
            recalculate_payroll_from_attendance(payroll)

class DailyPayrollViewSet(viewsets.ModelViewSet):
    serializer_class = DailyPayrollSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "post", "patch", "options"]

    def get_queryset(self):
        from users.services import projects_queryset_for_user

        allowed = projects_queryset_for_user(self.request.user)
        queryset = (
            DailyPayroll.objects.filter(project__in=allowed)
            .select_related(
                "project",
                "initiated_by",
                "site_confirmed_by",
                "accountant_approved_by",
                "director_finance_approved_by",
            )
            .prefetch_related("records")
            .order_by("-date", "-created_at")
        )
        project_id = self.request.query_params.get("project")
        date_param = self.request.query_params.get("date")
        status_param = self.request.query_params.get("status")
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        if date_param is not None:
            queryset = queryset.filter(date=date_param)
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    @action(detail=False, methods=["post"])
    def initiate(self, request):
        from projects.models import Project
        from workforce.payroll_service import initiate_daily_payroll

        project_id = request.data.get("project")
        date = request.data.get("date")
        if not project_id or not date:
            return Response(
                {"detail": "Project and date are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assert_project_in_user_scope(request.user, project_id)
        project = Project.objects.filter(pk=project_id).first()
        if not project:
            return Response({"detail": "Project not found."}, status=404)
        assert_site_foreman_initiate_payroll(request.user, project)
        try:
            payroll_run = initiate_daily_payroll(project, request.user, date)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            DailyPayrollSerializer(payroll_run).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"], url_path="confirm-site")
    def confirm_site(self, request, pk=None):
        from workforce.payroll_service import confirm_payroll_site_engineer

        payroll = self.get_object()
        try:
            payroll = confirm_payroll_site_engineer(payroll, request.user)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        return Response(DailyPayrollSerializer(payroll).data)

    @action(detail=True, methods=["post"], url_path="finance-approve")
    def finance_approve(self, request, pk=None):
        from workforce.payroll_service import approve_payroll_finance

        payroll = self.get_object()
        try:
            payroll = approve_payroll_finance(payroll, request.user)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        return Response(DailyPayrollSerializer(payroll).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        from workforce.payroll_service import reject_payroll

        payroll = self.get_object()
        reason = request.data.get("reason", "")
        try:
            payroll = reject_payroll(payroll, request.user, reason=reason)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        return Response(DailyPayrollSerializer(payroll).data)

    @action(detail=True, methods=["patch"])
    def review(self, request, pk=None):
        action_status = request.data.get("status")
        if action_status == "approved":
            return self.finance_approve(request, pk=pk)
        if action_status == "rejected":
            return self.reject(request, pk=pk)
        return Response(
            {"detail": "Use finance-approve or reject actions."},
            status=status.HTTP_400_BAD_REQUEST,
        )
