from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    Project,
    Task,
    TaskProgressPhoto,
    Location,
    Milestone,
    ProjectPhase,
    PhaseTask,
    ProjectBaseline,
    PhaseTaskBaseline,
    SubTask,
    BudgetCategory,
    BudgetItem,
    Transaction,
    GeneratedReport,
    SiteIncident,
    ProjectDocument,
    ProjectDocumentAttachment,
)
from .serializers import (
    ProjectSerializer,
    TaskSerializer,
    TaskProgressPhotoSerializer,
    LocationSerializer,
    MilestoneSerializer,
    ProjectPhaseSerializer,
    PhaseTaskSerializer,
    ProjectBaselineSerializer,
    SubTaskSerializer,
    BudgetCategorySerializer,
    BudgetItemSerializer,
    TransactionSerializer,
    GeneratedReportSerializer,
    ProjectDocumentSerializer,
    SiteIncidentSerializer,
)
from .document_permissions import user_can_manage_project_documents
from .phase_services import seed_standard_phases, sync_phase_tasks_to_phases

class LocationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Location.objects.all().order_by('name')
        parent = self.request.query_params.get('parent', None)
        if parent is not None:
            if parent.lower() == 'null':
                queryset = queryset.filter(parent__isnull=True)
            else:
                queryset = queryset.filter(parent_id=parent)
        return queryset

class SiteIncidentViewSet(viewsets.ModelViewSet):
    queryset = SiteIncident.objects.all().order_by('-date_reported')
    serializer_class = SiteIncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from users.services import projects_queryset_for_user
        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(project__in=allowed)
        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        incident_type = self.request.query_params.get('incident_type', None)
        if incident_type:
            queryset = queryset.filter(incident_type=incident_type)
            
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        incident = serializer.save(reported_by=user)
        from users.services import user_requires_approval
        from approvals.services import create_approval_request
        if user_requires_approval(user):
            create_approval_request(
                request_type='incident',
                object_type='projects.SiteIncident',
                object_id=incident.id,
                requested_by=user,
                title=f'Site incident: {(incident.description or "Report")[:80]}',
                description=incident.description or '',
                project=incident.project,
            )

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        incident = self.get_object()
        if incident.status == 'resolved':
            serializer = self.get_serializer(incident)
            return Response(serializer.data)

        incident.status = 'resolved'
        incident.date_resolved = timezone.now()
        incident.save(update_fields=['status', 'date_resolved'])
        serializer = self.get_serializer(incident)
        return Response(serializer.data)

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from users.services import projects_queryset_for_user
        from .status_service import refresh_automatic_project_statuses

        qs = projects_queryset_for_user(self.request.user)
        refresh_automatic_project_statuses(qs)
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        from users.services import user_can_create_project
        from rest_framework.exceptions import PermissionDenied

        if not user_can_create_project(request.user):
            raise PermissionDenied(
                'Only the Technical Director can create new projects. '
                'Contact your Technical Director to add a project.'
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from rest_framework import serializers as drf_serializers
        from users.services import (
            user_can_create_project,
            resolve_project_manager_for_assignment,
        )

        user = self.request.user
        if not user_can_create_project(user):
            raise drf_serializers.ValidationError(
                {'detail': 'Only the Technical Director can create projects.'}
            )

        manager_id = self.request.data.get('manager')
        if manager_id not in (None, ''):
            pm = resolve_project_manager_for_assignment(user, manager_id)
            if not pm:
                raise drf_serializers.ValidationError(
                    {'manager': 'Invalid project manager for assignment.'}
                )
            project = serializer.save(manager=pm)
        else:
            project = serializer.save()
        from users.audit import log_system_event
        log_system_event(
            f'Created project "{project.name}"',
            user=user,
            log_type='user',
        )

    def perform_update(self, serializer):
        from rest_framework import serializers as drf_serializers
        from users.models import CustomUser
        from users.services import (
            user_can_assign_project_manager,
            resolve_project_manager_for_assignment,
            user_has_technical_oversight,
            user_has_full_access,
        )
        from projects.staff_assignments import (
            fields_blocked_on_patch,
            fields_user_may_patch,
            STAFF_FIELD_ROLES,
            validate_candidate_for_field,
        )

        user = self.request.user
        project = serializer.instance
        blocked = fields_blocked_on_patch(user, project)
        for field in blocked:
            if field in self.request.data:
                raise drf_serializers.ValidationError({
                    field: 'Use staff assignment request (requires approval) or contact Technical Director.',
                })

        allowed = fields_user_may_patch(user, project)
        extra = {}
        for field in allowed:
            if field == 'manager':
                continue
            if field not in self.request.data:
                continue
            raw = self.request.data.get(field)
            if raw in (None, ''):
                extra[field] = None
                continue
            try:
                candidate = CustomUser.objects.get(pk=int(raw), is_active=True)
            except (CustomUser.DoesNotExist, ValueError, TypeError):
                raise drf_serializers.ValidationError({field: 'Invalid user.'})
            ok, err = validate_candidate_for_field(candidate, field)
            if not ok:
                raise drf_serializers.ValidationError({field: err})
            extra[field] = candidate

        if 'manager' in self.request.data:
            if not user_can_assign_project_manager(user):
                raise drf_serializers.ValidationError(
                    {'manager': 'You cannot change the project manager.'}
                )
            pm = resolve_project_manager_for_assignment(user, self.request.data.get('manager'))
            if not pm:
                raise drf_serializers.ValidationError(
                    {'manager': 'Invalid project manager for assignment.'}
                )
            project = serializer.save(manager=pm, **extra)
        else:
            project = serializer.save(**extra)

        if 'status' in self.request.data or 'status_is_manual' in self.request.data:
            from .status_service import user_can_set_project_status, refresh_automatic_project_statuses

            if not user_can_set_project_status(user, project):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You cannot change this project status.')

            update_fields = []

            raw_manual = self.request.data.get('status_is_manual')
            if raw_manual in (False, 'false', '0', 0):
                project.status_is_manual = False
                update_fields.append('status_is_manual')

            if 'status' in self.request.data:
                valid_statuses = {c[0] for c in Project.STATUS_CHOICES}
                new_status = self.request.data.get('status')
                if new_status not in valid_statuses:
                    raise drf_serializers.ValidationError({
                        'status': f'Invalid status. Choose one of: {", ".join(sorted(valid_statuses))}.',
                    })
                project.status = new_status
                project.status_is_manual = True
                update_fields.extend(['status', 'status_is_manual'])

            if update_fields:
                project.save(update_fields=list(dict.fromkeys(update_fields)))
            if not project.status_is_manual:
                refresh_automatic_project_statuses(Project.objects.filter(pk=project.pk))
                project.refresh_from_db(fields=['status'])

        from users.services import sync_site_staff_reports_to
        sync_site_staff_reports_to(project)

    @action(detail=True, methods=['get'], url_path='overview')
    def overview(self, request, pk=None):
        """PM dashboard: live metrics, milestones, and activity for one project."""
        from projects.overview_service import build_project_overview

        project = self.get_object()
        payload = build_project_overview(project)
        payload['project'] = ProjectSerializer(project, context={'request': request}).data
        return Response(payload)

    @action(detail=True, methods=['get'], url_path='full-detail')
    def full_detail(self, request, pk=None):
        """Rich project snapshot for Technical Director / oversight roles."""
        from django.db.models import Sum, Count
        from users.services import user_has_technical_oversight, user_has_full_access

        project = self.get_object()
        if not (user_has_technical_oversight(request.user) or user_has_full_access(request.user)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Technical oversight required.')

        task_stats = Task.objects.filter(project=project).aggregate(
            total=Count('id'),
            completed=Count('id', filter=models.Q(status='completed')),
            overdue=Count('id', filter=models.Q(status__in=['pending', 'in_progress'], date__lt=timezone.now().date())),
        )
        spend = Transaction.objects.filter(project=project, status='approved').aggregate(
            total=Sum('amount')
        )['total'] or 0
        pending_staff = []
        from approvals.models import ApprovalRequest
        import json
        for ar in ApprovalRequest.objects.filter(
            request_type='staff_assignment',
            object_id=project.id,
            status='pending',
        ).select_related('requested_by', 'approver'):
            try:
                meta = json.loads(ar.description or '{}')
            except json.JSONDecodeError:
                meta = {}
            pending_staff.append({
                'approval_id': ar.id,
                'field': meta.get('assignment_field'),
                'candidate_name': meta.get('candidate_name'),
                'requested_by': ar.requested_by.full_name or ar.requested_by.username,
                'created_at': ar.created_at,
            })

        data = ProjectSerializer(project, context={'request': request}).data
        data['stats'] = {
            'tasks_total': task_stats['total'] or 0,
            'tasks_completed': task_stats['completed'] or 0,
            'tasks_overdue': task_stats['overdue'] or 0,
            'approved_spend': float(spend),
            'budget_amount': float(project.budget_amount) if project.budget_amount else None,
        }
        data['pending_staff_assignments'] = pending_staff
        return Response(data)

    @action(detail=True, methods=['post'], url_path='request-staff')
    def request_staff(self, request, pk=None):
        from rest_framework import serializers as drf_serializers
        from projects.staff_assignments import create_staff_assignment_request

        project = self.get_object()
        field = request.data.get('assignment_field') or request.data.get('field')
        user_id = request.data.get('user_id') or request.data.get('candidate_id')
        notes = request.data.get('notes', '')
        if not field or not user_id:
            raise drf_serializers.ValidationError(
                {'detail': 'assignment_field and user_id are required.'}
            )
        approval, message = create_staff_assignment_request(
            project, request.user, field, user_id, notes=notes
        )
        if not approval:
            raise drf_serializers.ValidationError({'detail': message})
        from approvals.serializers import ApprovalRequestSerializer
        return Response({
            'detail': message,
            'approval': ApprovalRequestSerializer(approval, context={'request': request}).data,
        })

    @action(detail=False, methods=['get'], url_path='staff-candidates')
    def staff_candidates(self, request):
        from users.models import CustomUser
        from users.serializers import CustomUserSerializer
        from projects.staff_assignments import STAFF_FIELD_ROLES

        role = request.query_params.get('role')
        field = request.query_params.get('field')
        if field and field in STAFF_FIELD_ROLES:
            role = STAFF_FIELD_ROLES[field]
        if not role:
            return Response({'detail': 'role or field query param required.'}, status=400)
        qs = CustomUser.objects.filter(role=role, is_active=True).order_by('full_name', 'username')
        project_id = request.query_params.get('project')
        if project_id and role == 'project-manager':
            from users.services import user_has_technical_oversight
            if user_has_technical_oversight(request.user):
                qs = qs.filter(reports_to=request.user)
        return Response(CustomUserSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='export-schedule')
    def export_schedule(self, request, pk=None):
        import csv
        from django.http import HttpResponse
        
        project = self.get_object()
        phase_tasks = PhaseTask.objects.filter(project=project).order_by('start_date')
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="Project_{project.id}_Timeline_Export.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Phase', 'Task Name', 'Start Date', 'End Date', 'Duration (Days)', 'Assigned To', 'Status'])
        
        for task in phase_tasks:
            assignees = ", ".join([f"{u.first_name} {u.last_name}" for u in task.assigned_to.all()]) if task.assigned_to.exists() else "Unassigned"
            writer.writerow([
                task.phase,
                task.task_name,
                task.start_date,
                task.end_date,
                task.duration_working_days,
                assignees,
                task.status
            ])
            
        return response

    @action(detail=True, methods=['get'], url_path='timeline-report')
    def timeline_report(self, request, pk=None):
        """Export project timeline as PDF or Excel."""
        from django.http import HttpResponse
        from django.core.files.base import ContentFile
        from django.utils import timezone
        from .models import GeneratedReport
        from .utils_reports import generate_timeline_report_pdf, generate_timeline_excel
        from .report_branding import build_verification_url, new_verification_token

        project = self.get_object()
        export_format = request.query_params.get('export_as', request.query_params.get('format', 'pdf')).lower()
        if export_format not in ('pdf', 'excel'):
            from rest_framework.response import Response
            return Response({'detail': 'export_as must be pdf or excel.'}, status=400)
        token = new_verification_token()
        verify_url = build_verification_url(token, request=request)

        if export_format == 'excel':
            excel_bytes = generate_timeline_excel(project)
            filename = f"Timeline_Report_{project.name.replace(' ', '_')}.xlsx"
            report = GeneratedReport(
                project=project,
                name=f"{project.name} Timeline Report - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
                report_type='Timeline',
                created_by=request.user,
                file_size_bytes=len(excel_bytes),
                verification_token=token,
            )
            report.file.save(filename, ContentFile(excel_bytes), save=True)
            from users.audit import log_report_generated
            log_report_generated(request.user, 'Timeline (Excel)', project)
            response = HttpResponse(
                excel_bytes,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        pdf_bytes = generate_timeline_report_pdf(
            project,
            exported_by=request.user,
            verification_token=token,
            verify_url=verify_url,
        )
        filename = f"Timeline_Report_{project.name.replace(' ', '_')}.pdf"
        report = GeneratedReport(
            project=project,
            name=f"{project.name} Timeline Report - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
            report_type='Timeline',
            created_by=request.user,
            file_size_bytes=len(pdf_bytes),
            verification_token=token,
        )
        report.file.save(filename, ContentFile(pdf_bytes), save=True)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        from users.audit import log_report_generated
        log_report_generated(request.user, 'Timeline', project)
        return response

    @action(detail=True, methods=['get'], url_path='site-inventory-report')
    def site_inventory_report(self, request, pk=None):
        """Export site inventory snapshot or daily usage as branded PDF."""
        from django.http import HttpResponse
        from django.core.files.base import ContentFile
        from django.utils import timezone
        from .models import GeneratedReport
        from .utils_reports import (
            generate_site_inventory_snapshot_pdf,
            generate_site_inventory_usage_pdf,
        )
        from .report_branding import build_verification_url, new_verification_token
        from users.audit import log_report_generated

        project = self.get_object()
        kind = (request.query_params.get('kind') or 'snapshot').lower()
        if kind not in ('snapshot', 'daily-usage'):
            from rest_framework.response import Response
            return Response({'detail': 'kind must be snapshot or daily-usage.'}, status=400)

        usage_date = request.query_params.get('date')
        if kind == 'daily-usage' and not usage_date:
            from rest_framework.response import Response
            return Response({'detail': 'date (YYYY-MM-DD) is required for daily-usage reports.'}, status=400)

        token = new_verification_token()
        verify_url = build_verification_url(token, request=request)

        if kind == 'daily-usage':
            pdf_bytes = generate_site_inventory_usage_pdf(
                project,
                usage_date,
                exported_by=request.user,
                verification_token=token,
                verify_url=verify_url,
            )
            report_type = 'SiteInventoryUsage'
            label = 'Site Inventory Daily Usage'
            filename = f"Site_Inventory_Usage_{project.name.replace(' ', '_')}_{usage_date}.pdf"
            report_name = f"{project.name} Daily Usage Report ({usage_date})"
        else:
            pdf_bytes = generate_site_inventory_snapshot_pdf(
                project,
                exported_by=request.user,
                verification_token=token,
                verify_url=verify_url,
            )
            report_type = 'SiteInventory'
            label = 'Site Inventory Full Report'
            filename = f"Site_Inventory_{project.name.replace(' ', '_')}.pdf"
            report_name = f"{project.name} Site Inventory Report"

        report = GeneratedReport(
            project=project,
            name=f"{report_name} - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
            report_type=report_type,
            created_by=request.user,
            file_size_bytes=len(pdf_bytes),
            verification_token=token,
        )
        report.file.save(filename, ContentFile(pdf_bytes), save=True)
        log_report_generated(request.user, label, project)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(
        detail=True,
        methods=['post'],
        url_path='email-timeline-report',
        parser_classes=[MultiPartParser, FormParser],
    )
    def email_timeline_report(self, request, pk=None):
        """Email the timeline PDF report to a recipient."""
        from django.utils import timezone
        from django.core.files.base import ContentFile
        from .models import GeneratedReport
        from .utils_reports import generate_timeline_report_pdf
        from .report_branding import build_verification_url, new_verification_token
        from .report_email import send_report_email, build_report_email_body

        project = self.get_object()
        to_email = (request.data.get('email') or '').strip()
        custom_message = (request.data.get('message') or '').strip()
        if not to_email:
            from rest_framework.response import Response
            return Response({'detail': 'Recipient email is required.'}, status=400)

        token = new_verification_token()
        verify_url = build_verification_url(token, request=request)
        pdf_bytes = generate_timeline_report_pdf(
            project,
            exported_by=request.user,
            verification_token=token,
            verify_url=verify_url,
        )
        filename = f"Timeline_Report_{project.name.replace(' ', '_')}.pdf"
        report = GeneratedReport(
            project=project,
            name=f"{project.name} Timeline Report - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
            report_type='Timeline',
            created_by=request.user,
            file_size_bytes=len(pdf_bytes),
            verification_token=token,
        )
        report.file.save(filename, ContentFile(pdf_bytes), save=True)

        from users.audit import log_report_generated
        log_report_generated(request.user, 'Timeline (emailed)', project)

        exporter = request.user.full_name or request.user.username
        subject = f"BuildWise Timeline Report — {project.name}"
        body = build_report_email_body(
            exporter_name=exporter,
            report_label='project timeline report',
            project_name=project.name,
            custom_message=custom_message,
            verify_url=verify_url,
            include_attachment_help=True,
        )
        extra = request.FILES.getlist('attachments')
        try:
            send_report_email(
                to_email=to_email,
                subject=subject,
                body=body,
                report_bytes=pdf_bytes,
                report_filename=filename,
                extra_attachments=extra,
            )
        except Exception as exc:
            from rest_framework.response import Response
            return Response(
                {'detail': f'Failed to send email. Check server mail settings. ({exc})'},
                status=500,
            )
        from rest_framework.response import Response
        return Response({'detail': f'Timeline report emailed to {to_email}.'})

    @staticmethod
    def _parse_table_report_payload(data):
        import json
        from rest_framework.exceptions import ValidationError

        title = (data.get('title') or 'Table Report').strip()
        headers = data.get('headers')
        rows = data.get('rows')
        if isinstance(headers, str):
            headers = json.loads(headers)
        if isinstance(rows, str):
            rows = json.loads(rows)
        if not headers or not isinstance(headers, list):
            raise ValidationError({'headers': 'A list of column headers is required.'})
        if rows is None:
            rows = []
        if not isinstance(rows, list):
            raise ValidationError({'rows': 'Rows must be a list of row arrays.'})
        return title, headers, rows

    @action(detail=True, methods=['post'], url_path='export-table-report')
    def export_table_report(self, request, pk=None):
        """Export tabular data as branded PDF or Excel."""
        from django.http import HttpResponse
        from django.core.files.base import ContentFile
        from django.utils import timezone
        from .models import GeneratedReport
        from .utils_reports import generate_table_report_pdf, generate_table_report_excel
        from .report_branding import build_verification_url, new_verification_token
        from users.audit import log_report_generated

        project = self.get_object()
        export_as = (request.data.get('export_as') or 'pdf').lower()
        if export_as not in ('pdf', 'excel'):
            from rest_framework.response import Response
            return Response({'detail': 'export_as must be pdf or excel.'}, status=400)

        title, headers, rows = self._parse_table_report_payload(request.data)
        safe_name = title.replace(' ', '_')[:40]

        if export_as == 'excel':
            excel_bytes = generate_table_report_excel(title, headers, rows)
            filename = f"{safe_name}.xlsx"
            token = new_verification_token()
            report = GeneratedReport(
                project=project,
                name=f"{project.name} {title} - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
                report_type='Custom',
                created_by=request.user,
                file_size_bytes=len(excel_bytes),
                verification_token=token,
            )
            report.file.save(filename, ContentFile(excel_bytes), save=True)
            log_report_generated(request.user, f'{title} (Excel)', project)
            response = HttpResponse(
                excel_bytes,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        token = new_verification_token()
        verify_url = build_verification_url(token, request=request)
        pdf_bytes = generate_table_report_pdf(
            project,
            title,
            headers,
            rows,
            exported_by=request.user,
            verification_token=token,
            verify_url=verify_url,
        )
        filename = f"{safe_name}.pdf"
        report = GeneratedReport(
            project=project,
            name=f"{project.name} {title} - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
            report_type='Custom',
            created_by=request.user,
            file_size_bytes=len(pdf_bytes),
            verification_token=token,
        )
        report.file.save(filename, ContentFile(pdf_bytes), save=True)
        log_report_generated(request.user, f'{title} (PDF)', project)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(
        detail=True,
        methods=['post'],
        url_path='email-table-report',
        parser_classes=[MultiPartParser, FormParser],
    )
    def email_table_report(self, request, pk=None):
        """Email a tabular report PDF plus optional custom attachments."""
        from django.utils import timezone
        from django.core.files.base import ContentFile
        from .models import GeneratedReport
        from .utils_reports import generate_table_report_pdf
        from .report_branding import build_verification_url, new_verification_token
        from .report_email import send_report_email, build_report_email_body
        from users.audit import log_report_generated

        project = self.get_object()
        to_email = (request.data.get('email') or '').strip()
        custom_message = (request.data.get('message') or '').strip()
        if not to_email:
            from rest_framework.response import Response
            return Response({'detail': 'Recipient email is required.'}, status=400)

        title, headers, rows = self._parse_table_report_payload(request.data)
        token = new_verification_token()
        verify_url = build_verification_url(token, request=request)
        pdf_bytes = generate_table_report_pdf(
            project,
            title,
            headers,
            rows,
            exported_by=request.user,
            verification_token=token,
            verify_url=verify_url,
        )
        safe_name = title.replace(' ', '_')[:40]
        filename = f"{safe_name}.pdf"
        report = GeneratedReport(
            project=project,
            name=f"{project.name} {title} - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
            report_type='Custom',
            created_by=request.user,
            file_size_bytes=len(pdf_bytes),
            verification_token=token,
        )
        report.file.save(filename, ContentFile(pdf_bytes), save=True)
        log_report_generated(request.user, f'{title} (emailed)', project)

        exporter = request.user.full_name or request.user.username
        subject = (request.data.get('subject') or f"BuildWise Report — {title}").strip()
        body = build_report_email_body(
            exporter_name=exporter,
            report_label=title,
            project_name=project.name,
            custom_message=custom_message,
            verify_url=verify_url,
            include_attachment_help=True,
        )
        extra = request.FILES.getlist('attachments')
        try:
            send_report_email(
                to_email=to_email,
                subject=subject,
                body=body,
                report_bytes=pdf_bytes,
                report_filename=filename,
                extra_attachments=extra,
            )
        except Exception as exc:
            from rest_framework.response import Response
            return Response(
                {'detail': f'Failed to send email. Check server mail settings. ({exc})'},
                status=500,
            )
        from rest_framework.response import Response
        return Response({'detail': f'Report emailed to {to_email}.'})

    @action(
        detail=True,
        methods=['post'],
        url_path='email-transaction-report',
        parser_classes=[MultiPartParser, FormParser],
    )
    def email_transaction_report(self, request, pk=None):
        """Email a daily or custom date-range transactions PDF report."""
        from django.utils import timezone
        from django.core.files.base import ContentFile
        from rest_framework.response import Response
        from .models import GeneratedReport
        from .utils_reports import (
            generate_daily_transactions_report_pdf,
            generate_custom_transactions_report_pdf,
        )
        from .report_branding import build_verification_url, new_verification_token
        from .report_email import send_report_email, build_report_email_body
        from users.audit import log_report_generated

        project = self.get_object()
        to_email = (request.data.get('email') or '').strip()
        custom_message = (request.data.get('message') or '').strip()
        report_type = (request.data.get('type') or 'Daily').strip()

        if not to_email:
            return Response({'detail': 'Recipient email is required.'}, status=400)
        if report_type not in ('Daily', 'Custom'):
            return Response({'detail': 'type must be Daily or Custom.'}, status=400)

        start_date = (request.data.get('start_date') or '').strip()
        end_date = (request.data.get('end_date') or '').strip()
        if report_type == 'Custom':
            if not start_date or not end_date:
                return Response(
                    {'detail': 'start_date and end_date are required for custom reports.'},
                    status=400,
                )
            if start_date > end_date:
                return Response(
                    {'detail': 'start_date cannot be after end_date.'},
                    status=400,
                )

        token = new_verification_token()
        verify_url = build_verification_url(token, request=request)
        meta = {
            'exported_by': request.user,
            'verification_token': token,
            'verify_url': verify_url,
        }

        if report_type == 'Daily':
            pdf_bytes = generate_daily_transactions_report_pdf(project, **meta)
            report_label = 'daily transactions report'
            filename = f"Daily_Report_{project.name.replace(' ', '_')}.pdf"
            audit_label = 'Daily (emailed)'
        else:
            pdf_bytes = generate_custom_transactions_report_pdf(
                project, start_date, end_date, **meta
            )
            report_label = f'custom transactions report ({start_date} to {end_date})'
            filename = f"Custom_Report_{project.name.replace(' ', '_')}.pdf"
            audit_label = 'Custom (emailed)'

        report = GeneratedReport(
            project=project,
            name=f"{project.name} {report_type} Report - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
            report_type=report_type,
            created_by=request.user,
            file_size_bytes=len(pdf_bytes),
            verification_token=token,
        )
        report.file.save(filename, ContentFile(pdf_bytes), save=True)
        log_report_generated(request.user, audit_label, project)

        exporter = request.user.full_name or request.user.username
        subject = f"BuildWise {report_type} Report — {project.name}"
        body = build_report_email_body(
            exporter_name=exporter,
            report_label=report_label,
            project_name=project.name,
            custom_message=custom_message,
            verify_url=verify_url,
            include_attachment_help=True,
        )
        extra = request.FILES.getlist('attachments')
        try:
            send_report_email(
                to_email=to_email,
                subject=subject,
                body=body,
                report_bytes=pdf_bytes,
                report_filename=filename,
                extra_attachments=extra,
            )
        except Exception as exc:
            return Response(
                {'detail': f'Failed to send email. Check server mail settings. ({exc})'},
                status=500,
            )
        return Response({'detail': f'{report_type} report emailed to {to_email}.'})

    @action(detail=True, methods=['get'], url_path='generate-report')
    def generate_report(self, request, pk=None):
        try:
            report_type = request.query_params.get('type', 'Financial')
            project = self.get_object()
            
            from django.http import HttpResponse
            from .utils_reports import (
                generate_financial_report_pdf,
                generate_progress_report_pdf,
                generate_hr_report_pdf,
                generate_procurement_report_pdf,
                generate_daily_transactions_report_pdf,
                generate_custom_transactions_report_pdf,
            )
            from .report_branding import build_verification_url, new_verification_token
            from django.core.files.base import ContentFile
            from django.db.models import Sum
            from .models import Transaction, GeneratedReport
            from django.utils import timezone
            
            token = new_verification_token()
            verify_url = build_verification_url(token, request=request)
            meta = {
                'exported_by': request.user,
                'verification_token': token,
                'verify_url': verify_url,
            }

            pdf_bytes = b""
            filename = f"{report_type}_Report_{project.name.replace(' ', '_')}.pdf"
            
            if report_type == 'Financial':
                actual_total = Transaction.objects.filter(project=project, status='approved').aggregate(Sum('amount'))['amount__sum'] or 0
                planned_total = project.budget_items.aggregate(Sum('planned_amount'))['planned_amount__sum'] or 0
                variance = float(actual_total) - float(planned_total)
                by_category = project.budget_items.values('category__name').annotate(planned_amount=Sum('planned_amount'))
                cat_data = []
                for cat in by_category:
                    cat_name = cat['category__name']
                    planned = float(cat['planned_amount']) if cat['planned_amount'] else 0
                    actual = Transaction.objects.filter(project=project, status='approved', category__name=cat_name).aggregate(Sum('amount'))['amount__sum'] or 0
                    cat_data.append({'category__name': cat_name, 'planned_amount': planned, 'actual_amount': float(actual)})
                budget_summary = {'total_planned': float(planned_total), 'total_actual': float(actual_total), 'variance': variance, 'by_category': cat_data}
                pdf_bytes = generate_financial_report_pdf(project, budget_summary, **meta)
            elif report_type == 'Progress':
                pdf_bytes = generate_progress_report_pdf(project, **meta)
            elif report_type == 'HR':
                pdf_bytes = generate_hr_report_pdf(project, **meta)
            elif report_type == 'Procurement':
                pdf_bytes = generate_procurement_report_pdf(project, **meta)
            elif report_type == 'Daily':
                pdf_bytes = generate_daily_transactions_report_pdf(project, **meta)
            elif report_type == 'Custom':
                start_date = request.query_params.get('start_date')
                end_date = request.query_params.get('end_date')
                pdf_bytes = generate_custom_transactions_report_pdf(project, start_date, end_date, **meta)
            elif report_type == 'Executive':
                pdf_bytes = generate_progress_report_pdf(project, **meta)
            else:
                from rest_framework.response import Response
                return Response({'detail': 'Invalid report type'}, status=400)
                
            report = GeneratedReport(
                project=project,
                name=f"{project.name} {report_type} Report - {timezone.now().strftime('%b %d, %Y %I:%M %p')}",
                report_type=report_type,
                created_by=request.user,
                file_size_bytes=len(pdf_bytes),
                verification_token=token,
            )
            report.file.save(filename, ContentFile(pdf_bytes), save=True)
            
            from users.audit import log_report_generated
            log_report_generated(request.user, f'{report_type} Report', project)

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            import traceback
            from rest_framework.response import Response
            return Response({'error': str(e), 'traceback': traceback.format_exc()}, status=500)

    @action(detail=False, methods=['get'], url_path='portfolio-analytics')
    def portfolio_analytics(self, request):
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncMonth
        from .models import Transaction, Project, BudgetItem
        
        qs = self.get_queryset()
        
        project_id = request.query_params.get('project')
        if project_id:
            qs = qs.filter(id=project_id)
        
        # 1. Project Status Distribution
        status_dist = qs.values('status').annotate(count=Count('id'))
        status_data = [{'name': item['status'], 'value': item['count']} for item in status_dist]
        
        # 2. KPIs
        total_projects = qs.count()
        total_budget = BudgetItem.objects.filter(project__in=qs).aggregate(total=Sum('planned_amount'))['total'] or 0
        total_spend = Transaction.objects.filter(project__in=qs, status='approved').aggregate(total=Sum('amount'))['total'] or 0
        
        avg_progress = qs.aggregate(avg=models.Avg('progress'))['avg'] or 0
        
        # 3. Monthly Aggregate Cash Flow
        flow = Transaction.objects.filter(
            project__in=qs, 
            status='approved'
        ).annotate(
            month=TruncMonth('transaction_date')
        ).values('month').annotate(
            total=Sum('amount')
        ).order_by('month')
        
        cash_flow_data = []
        for item in flow:
            if item['month']:
                cash_flow_data.append({
                    'date': item['month'].strftime('%b %Y'),
                    'amount': float(item['total'])
                })
                
        from users.models import CustomUser
        from approvals.models import ApprovalRequest

        from django.utils import timezone
        from .models import SiteIncident

        pending_txn = Transaction.objects.filter(project__in=qs, status='pending')
        pending_txn_agg = pending_txn.aggregate(
            total=models.Sum('amount'),
            count=models.Count('id'),
        )
        remaining_budget = float(total_budget) - float(total_spend)
        budget_utilization = (
            round(float(total_spend) / float(total_budget) * 100, 1)
            if total_budget else 0
        )

        from workforce.models import DailyPayroll

        pending_payroll_agg = DailyPayroll.objects.filter(
            project__in=qs,
            status='awaiting_finance',
        ).aggregate(
            count=models.Count('id'),
            total=models.Sum('total_amount'),
        )
        recent_pending_transactions = list(
            pending_txn.select_related('project', 'category')
            .order_by('-created_at')[:8]
            .values(
                'id',
                'description',
                'amount',
                'transaction_date',
                'status',
                'project__name',
                'category__name',
            )
        )
        for row in recent_pending_transactions:
            row['amount'] = float(row['amount'] or 0)
            row['project_name'] = row.pop('project__name', None)
            row['category_name'] = row.pop('category__name', None)

        today = timezone.now().date()
        open_incidents = SiteIncident.objects.filter(project__in=qs, status='open').count()
        pending_technical = ApprovalRequest.objects.filter(
            status='pending',
            request_type__in=(
                'material_request', 'purchase_order', 'task_complete', 'incident', 'allocation'
            ),
            project__in=qs,
        ).count()

        pm_performance = []
        for pm in CustomUser.objects.filter(role='project-manager', is_active=True):
            pm_projects = qs.filter(manager=pm)
            pids = list(pm_projects.values_list('id', flat=True))
            overdue_tasks = 0
            if pids:
                overdue_tasks = Task.objects.filter(
                    project_id__in=pids,
                    status__in=['pending', 'in_progress'],
                    date__lt=today,
                ).count()
            pm_incidents = SiteIncident.objects.filter(
                project_id__in=pids, status='open'
            ).count() if pids else 0
            avg_p = pm_projects.aggregate(avg=models.Avg('progress'))['avg'] or 0
            pm_performance.append({
                'id': pm.id,
                'name': pm.full_name or pm.username,
                'email': pm.email,
                'project_count': pm_projects.count(),
                'avg_progress': round(float(avg_p), 1),
                'overdue_tasks': overdue_tasks,
                'open_incidents': pm_incidents,
            })

        return Response({
            'kpis': {
                'total_projects': total_projects,
                'total_budget': float(total_budget),
                'total_spend': float(total_spend),
                'avg_progress': float(avg_progress),
                'budget_utilization': budget_utilization,
                'at_risk_projects': qs.filter(status__in=['at-risk', 'delayed']).count(),
                'completed_projects': qs.filter(status='completed').count(),
                'on_track_projects': qs.filter(status='on-track').count(),
                'pending_approvals': ApprovalRequest.objects.filter(status='pending').count(),
                'pending_transactions': pending_txn_agg['count'] or 0,
                'pending_transaction_amount': float(pending_txn_agg['total'] or 0),
                'remaining_budget': max(0.0, remaining_budget),
                'pending_payroll_batches': pending_payroll_agg['count'] or 0,
                'pending_payroll_amount': float(pending_payroll_agg['total'] or 0),
                'active_staff': CustomUser.objects.filter(is_active=True).exclude(
                    role__in=['client', 'subcontractor']
                ).count(),
                'open_incidents': open_incidents,
                'pending_technical_approvals': pending_technical,
            },
            'status_distribution': status_data,
            'cash_flow': cash_flow_data,
            'recent_pending_transactions': recent_pending_transactions,
            'pm_performance': pm_performance,
            'staff_by_department': list(
                CustomUser.objects.filter(is_active=True)
                .values('department')
                .annotate(count=Count('id'))
                .order_by('-count')
            ),
        })

    @action(detail=False, methods=['get'])
    def site_engineers(self, request):
        from users.models import CustomUser
        from users.serializers import CustomUserSerializer
        engineers = CustomUser.objects.filter(role='site-engineer', is_active=True)
        serializer = CustomUserSerializer(engineers, many=True, context={'request': request})
        return Response(serializer.data)

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().order_by('date', 'created_at')
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def _deny_site_foreman_write(self):
        if getattr(self.request.user, 'role', None) == 'site-foreman':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Site foremen have read-only access to task management.')

    def create(self, request, *args, **kwargs):
        self._deny_site_foreman_write()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._deny_site_foreman_write()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._deny_site_foreman_write()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._deny_site_foreman_write()
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        from users.services import projects_queryset_for_user
        allowed_projects = projects_queryset_for_user(self.request.user)
        queryset = (
            Task.objects.filter(project__in=allowed_projects)
            .prefetch_related("progress_photos", "progress_photos__uploaded_by")
            .distinct()
        )

        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)

        return queryset.order_by('date', 'created_at')

    def _check_deadlines(self, queryset):
        from datetime import date, timedelta
        from users.notification_utils import create_notification
        
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        active_tasks = queryset.exclude(status='completed').exclude(date__isnull=True)
        for task in active_tasks:
            if not task.assigned_to:
                continue
                
            if task.date < today and not task.reminded_overdue:
                desc_text = f"\n\nDetails: {task.description}" if task.description else ""
                create_notification(
                    user=task.assigned_to,
                    title="Task Overdue!",
                    message=f"Critical: Your task '{task.title}' is overdue (Deadline was {task.date}).{desc_text}",
                    link="tasks",
                    project=task.project,
                )
                task.reminded_overdue = True
                task.save(update_fields=['reminded_overdue'])
                
            elif (task.date == today or task.date == tomorrow) and not task.reminded_due_soon and not task.reminded_overdue:
                desc_text = f"\n\nDetails: {task.description}" if task.description else ""
                create_notification(
                    user=task.assigned_to,
                    title="Task Due Soon",
                    message=f"Urgent: Your task '{task.title}' is due on {task.date}.{desc_text}",
                    link="/tasks",
                    project=task.project,
                )
                task.reminded_due_soon = True
                task.save(update_fields=['reminded_due_soon'])

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # self._check_deadlines(self.get_queryset())
        return response

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        new_status = self.request.data.get('status')
        instance = self.get_object()
        if (
            new_status == 'completed'
            and instance.status != 'completed'
        ):
            from users.services import user_requires_approval
            from approvals.services import create_approval_request
            if user_requires_approval(user):
                task = serializer.save(status=instance.status)
                create_approval_request(
                    request_type='task_complete',
                    object_type='projects.Task',
                    object_id=task.id,
                    requested_by=user,
                    title=f'Complete task: {task.title}',
                    description=task.description or '',
                    project=task.project,
                )
                return
        serializer.save()

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-photo",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_photo(self, request, pk=None):
        self._deny_site_foreman_write()
        task = self.get_object()
        image = request.FILES.get("image")
        if not image:
            return Response(
                {"detail": "An image file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content_type = getattr(image, "content_type", "") or ""
        if content_type and not content_type.startswith("image/"):
            return Response(
                {"detail": "Only image files are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        photo = TaskProgressPhoto.objects.create(
            task=task,
            image=image,
            caption=(request.data.get("caption") or "")[:255],
            uploaded_by=request.user,
        )
        return Response(
            TaskProgressPhotoSerializer(photo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>\d+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        self._deny_site_foreman_write()
        task = self.get_object()
        photo = TaskProgressPhoto.objects.filter(task=task, pk=photo_id).first()
        if not photo:
            return Response({"detail": "Photo not found."}, status=status.HTTP_404_NOT_FOUND)
        photo.image.delete(save=False)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='auto-assign')
    def auto_assign(self, request, pk=None):
        task = self.get_object()
        workers_needed = request.data.get('workers_needed', 1)
        allow_overbook = request.data.get('allow_overbook', False)
        from .services import auto_assign_task
        success, message, needs_confirmation = auto_assign_task(
            task,
            workers_needed=workers_needed,
            allow_overbook=allow_overbook
        )
        if success:
            return Response({'detail': message})
        status_code = 409 if needs_confirmation else 400
        return Response({'detail': message, 'needs_confirmation': needs_confirmation}, status=status_code)

class MilestoneViewSet(viewsets.ModelViewSet):
    queryset = Milestone.objects.all().order_by('-created_at')
    serializer_class = MilestoneSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

class ProjectPhaseViewSet(viewsets.ModelViewSet):
    queryset = ProjectPhase.objects.all().order_by('order', 'id')
    serializer_class = ProjectPhaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from users.services import projects_queryset_for_user

        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(project__in=allowed)
        project_id = self.request.query_params.get('project')
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    @action(detail=False, methods=['post'], url_path='seed-standard')
    def seed_standard(self, request):
        project_id = request.data.get('project')
        if not project_id:
            return Response(
                {'detail': 'project is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project = Project.objects.filter(pk=project_id).first()
        if not project:
            return Response({'detail': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

        created_count, phases = seed_standard_phases(project)
        serializer = self.get_serializer(phases, many=True)
        return Response({
            'created': created_count,
            'total': len(phases),
            'phases': serializer.data,
        })

    @action(detail=False, methods=['post'], url_path='sync-from-tasks')
    def sync_from_tasks(self, request):
        """Create phase records from legacy timeline tasks that only have a phase name."""
        project_id = request.data.get('project')
        if not project_id:
            return Response(
                {'detail': 'project is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project = Project.objects.filter(pk=project_id).first()
        if not project:
            return Response({'detail': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

        linked = sync_phase_tasks_to_phases(project)
        phases = self.get_queryset().filter(project_id=project_id)
        serializer = self.get_serializer(phases, many=True)
        return Response({'linked_tasks': linked, 'phases': serializer.data})


class PhaseTaskViewSet(viewsets.ModelViewSet):
    queryset = PhaseTask.objects.all().order_by('start_date')
    serializer_class = PhaseTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project', None)
        phase_id = self.request.query_params.get('project_phase', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        if phase_id is not None:
            queryset = queryset.filter(project_phase_id=phase_id)
        return queryset

    def perform_create(self, serializer):
        from .services import (
            map_phase_status_to_task_status,
            recalculate_project_progress,
            sync_linked_tasks_from_phase_task,
        )

        phase_task = serializer.save()
        from .models import Task

        task = Task.objects.create(
            project=phase_task.project,
            phase_task=phase_task,
            title=f"{phase_task.phase} - {phase_task.task_name}",
            date=phase_task.start_date,
            status=map_phase_status_to_task_status(phase_task.status),
        )
        task.assigned_to.set(phase_task.assigned_to.all())
        if phase_task.project_id:
            recalculate_project_progress(phase_task.project)

    def perform_update(self, serializer):
        from .services import (
            recalculate_project_progress,
            sync_linked_tasks_from_phase_task,
        )

        phase_task = serializer.save()
        sync_linked_tasks_from_phase_task(phase_task)
        if phase_task.project_id:
            recalculate_project_progress(phase_task.project)

class ProjectBaselineViewSet(viewsets.ModelViewSet):
    queryset = ProjectBaseline.objects.all().order_by('-created_at')
    serializer_class = ProjectBaselineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def _check_baseline_permission(self, project):
        from users.services import user_can_edit_schedule_baseline
        if not user_can_edit_schedule_baseline(self.request.user, project):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Only Project Manager (for this project), Technical Director, or executives can manage schedule baselines.'
            )

    def perform_destroy(self, instance):
        self._check_baseline_permission(instance.project)
        instance.delete()

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        if project:
            self._check_baseline_permission(project)
        serializer.save()

    @action(detail=False, methods=['post'], url_path='save-snapshot')
    def save_snapshot(self, request):
        project_id = request.data.get('project')
        name = request.data.get('name', 'Snapshot')
        
        if not project_id:
            return Response({'detail': 'Project ID is required'}, status=400)
            
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response({'detail': 'Project not found'}, status=404)

        self._check_baseline_permission(project)
            
        baseline = ProjectBaseline.objects.create(project=project, name=name)
        
        # Clone all phase tasks into baseline snapshot
        phase_tasks = PhaseTask.objects.filter(project=project)
        for pt in phase_tasks:
            PhaseTaskBaseline.objects.create(
                baseline=baseline,
                original_task=pt,
                start_date=pt.start_date,
                end_date=pt.end_date,
                duration_working_days=pt.duration_working_days,
                status=pt.status
            )
            
        serializer = self.get_serializer(baseline)
        return Response(serializer.data)

class SubTaskViewSet(viewsets.ModelViewSet):
    queryset = SubTask.objects.all().order_by('created_at')
    serializer_class = SubTaskSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='auto-assign')
    def auto_assign(self, request, pk=None):
        subtask = self.get_object()
        workers_needed = request.data.get('workers_needed', 1)
        allow_overbook = request.data.get('allow_overbook', False)
        from .services import auto_assign_task
        success, message, needs_confirmation = auto_assign_task(
            subtask,
            workers_needed=workers_needed,
            allow_overbook=allow_overbook
        )
        if success:
            return Response({'detail': message})
        status_code = 409 if needs_confirmation else 400
        return Response({'detail': message, 'needs_confirmation': needs_confirmation}, status=status_code)


# =====================================================
# BUDGET & COST CONTROL VIEWSETS
# =====================================================

class BudgetCategoryViewSet(viewsets.ModelViewSet):
    queryset = BudgetCategory.objects.all().order_by('name')
    serializer_class = BudgetCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset


class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.all().order_by('-created_at')
    serializer_class = BudgetItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    @action(detail=False, methods=['get'], url_path='summary')
    def budget_summary(self, request):
        """Get budget summary for a project"""
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({'detail': 'Project ID is required'}, status=400)
        
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response({'detail': 'Project not found'}, status=404)

        items = BudgetItem.objects.filter(project_id=project_id)
        
        from django.db.models import Sum
        allocated = items.aggregate(total=Sum('planned_amount'))['total'] or 0
        total_actual = items.aggregate(total=Sum('actual_amount'))['total'] or 0

        # Prefer numeric budget_amount; fallback to parsing legacy string budget.
        total_budget = None
        if getattr(project, "budget_amount", None) is not None:
            try:
                total_budget = float(project.budget_amount)
            except Exception:
                total_budget = None

        if total_budget is None:
            from .services import parse_project_budget_to_decimal
            parsed = parse_project_budget_to_decimal(project.budget)
            total_budget = float(parsed) if parsed is not None else float(allocated)
        total_allocated = float(allocated)
        
        by_category = items.values('category__name', 'category__color').annotate(
            planned=Sum('planned_amount'),
            actual=Sum('actual_amount')
        )

        variance = float(total_actual) - float(total_budget)
        variance_percent = (variance / float(total_budget) * 100) if float(total_budget) > 0 else 0
        
        return Response({
            # Back-compat field used by frontend: treat as "total budget"
            'total_planned': float(total_budget),
            'total_actual': float(total_actual),
            # New explicit fields
            'total_budget': float(total_budget),
            'total_allocated': float(total_allocated),
            'remaining_to_allocate': float(total_budget) - float(total_allocated),
            'variance': variance,
            'variance_percent': variance_percent,
            'by_category': list(by_category)
        })


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().order_by('-transaction_date')
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from users.services import projects_queryset_for_user
        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(project__in=allowed)
        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        from users.services import user_requires_approval
        from approvals.services import create_approval_request

        extra = {}
        if user_requires_approval(user):
            extra['status'] = 'pending'
        transaction = serializer.save(created_by=user, **extra)
        if user_requires_approval(user):
            create_approval_request(
                request_type='transaction',
                object_type='projects.Transaction',
                object_id=transaction.id,
                requested_by=user,
                title=f'Transaction approval: {transaction.description[:80]}',
                description=transaction.description or '',
                project=transaction.project,
            )
        if transaction.budget_item:
            total_actual = Transaction.objects.filter(
                budget_item=transaction.budget_item,
                status='approved'
            ).aggregate(total=models.Sum('amount'))['total'] or 0
            transaction.budget_item.actual_amount = total_actual
            transaction.budget_item.save()

    def perform_destroy(self, instance):
        from users.services import can_delete_transaction
        from rest_framework.exceptions import PermissionDenied

        if not can_delete_transaction(self.request.user):
            raise PermissionDenied(
                'Only the Director of Finance or executives can delete transactions.'
            )

        budget_item = instance.budget_item
        budget_item_id = instance.budget_item_id
        was_approved = instance.status == 'approved'
        instance.delete()

        if was_approved and budget_item_id and budget_item:
            total_actual = Transaction.objects.filter(
                budget_item_id=budget_item_id,
                status='approved',
            ).aggregate(total=models.Sum('amount'))['total'] or 0
            budget_item.actual_amount = total_actual
            budget_item.save(update_fields=['actual_amount'])

    @action(detail=False, methods=['get'], url_path='recent')
    def recent_transactions(self, request):
        """Get recent transactions for a project"""
        project_id = request.query_params.get('project')
        limit = int(request.query_params.get('limit', 10))
        
        if not project_id:
            return Response({'detail': 'Project ID is required'}, status=400)
        
        transactions = Transaction.objects.filter(
            project_id=project_id
        ).order_by('-transaction_date')[:limit]
        
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        transaction = self.get_object()
        
        from users.services import (
            can_approve_transaction,
            transaction_requires_finance_escalation,
            get_finance_escalation_threshold,
        )
        if not can_approve_transaction(request.user, transaction):
            if transaction_requires_finance_escalation(transaction) and getattr(
                request.user, 'role', None
            ) == 'project-manager':
                threshold = get_finance_escalation_threshold()
                return Response(
                    {
                        'detail': (
                            f'Amount meets or exceeds Rwf {threshold:,.0f}. '
                            'Director of Finance or Managing Director must approve.'
                        ),
                        'requires_escalation': True,
                    },
                    status=403,
                )
            return Response({'detail': 'You cannot approve this transaction.'}, status=403)
            
        if transaction.status == 'approved':
            return Response({'detail': 'Transaction is already approved.'}, status=400)

        from rest_framework.exceptions import ValidationError
        from .services import check_budget_limit

        try:
            check_budget_limit(
                transaction.project,
                transaction.category.name if transaction.category_id else '',
                transaction.amount,
                budget_item=transaction.budget_item,
            )
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        transaction.status = 'approved'
        transaction.save()
        
        # Recalculate actual_amount on the budget item
        if transaction.budget_item:
            total_actual = Transaction.objects.filter(
                budget_item=transaction.budget_item,
                status='approved'
            ).aggregate(total=models.Sum('amount'))['total'] or 0
            transaction.budget_item.actual_amount = total_actual
            transaction.budget_item.save()

        from procurement.po_expense import finalize_purchase_order_payment
        finalize_purchase_order_payment(transaction, request.user)

        return Response(self.get_serializer(transaction).data)

    @action(detail=False, methods=['get'], url_path='cash-flow')
    def cash_flow(self, request):
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({'detail': 'Project ID is required'}, status=400)
            
        from django.db.models.functions import TruncDate
        from django.db.models import Sum
        
        flow = Transaction.objects.filter(
            project_id=project_id, 
            status='approved'
        ).annotate(
            date=TruncDate('transaction_date')
        ).values('date').annotate(
            total=Sum('amount')
        ).order_by('date')
        
        
        return Response(list(flow))

class GeneratedReportViewSet(viewsets.ModelViewSet):
    queryset = GeneratedReport.objects.all().order_by('-created_at')
    serializer_class = GeneratedReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path=r'verify/(?P<token>[^/.]+)', permission_classes=[AllowAny], authentication_classes=[])
    def verify(self, request, token=None):
        """Public verification — scan QR code to view the stored report PDF."""
        from django.http import HttpResponse, Http404
        from django.utils.html import escape
        from .report_branding import format_report_datetime, get_exporter_name

        report = (
            GeneratedReport.objects.filter(verification_token=token)
            .select_related('project', 'created_by')
            .first()
        )
        if not report or not report.file:
            raise Http404('Report not found or no longer available.')

        raw = request.query_params.get('view') == 'raw'
        if not raw:
            project_name = escape(report.project.name if report.project_id else 'BuildWise')
            report_name = escape(report.name)
            report_type = escape(report.report_type or 'Report')
            exporter = escape(get_exporter_name(report.created_by))
            generated = escape(format_report_datetime(report.created_at))
            # Relative URL — always matches the host the phone used when scanning the QR code.
            pdf_href = escape('?view=raw')
            html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BuildWise — Report verification</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; color: #0f172a; min-height: 100vh; }}
    header {{ background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; padding: 1.25rem 1.25rem 1.5rem; }}
    header h1 {{ margin: 0; font-size: 1.2rem; line-height: 1.3; }}
    header p {{ margin: 0.4rem 0 0; font-size: 0.9rem; opacity: 0.92; }}
    .badge {{ display: inline-block; background: #dcfce7; color: #166534; font-size: 0.7rem; font-weight: 700;
      padding: 0.25rem 0.55rem; border-radius: 999px; margin-left: 0.35rem; vertical-align: middle; }}
    main {{ padding: 1.25rem; max-width: 32rem; margin: 0 auto; }}
    .card {{ background: #fff; border-radius: 1rem; border: 1px solid #e2e8f0; padding: 1.25rem; box-shadow: 0 1px 3px rgba(15,23,42,0.06); }}
    .card h2 {{ margin: 0 0 0.75rem; font-size: 1rem; color: #1e293b; }}
    dl {{ margin: 0; font-size: 0.875rem; }}
    dt {{ color: #64748b; font-weight: 600; margin-top: 0.65rem; }}
    dt:first-child {{ margin-top: 0; }}
    dd {{ margin: 0.15rem 0 0; color: #0f172a; }}
    .actions {{ display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1.25rem; }}
    .btn {{ display: block; text-align: center; text-decoration: none; font-weight: 700; font-size: 0.95rem;
      padding: 0.85rem 1rem; border-radius: 0.75rem; }}
    .btn-primary {{ background: #2563eb; color: #fff; }}
    .btn-secondary {{ background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }}
    .hint {{ margin-top: 1rem; font-size: 0.8rem; color: #64748b; line-height: 1.45; }}
  </style>
</head>
<body>
  <header>
    <h1>BuildWise verified report <span class="badge">Authentic</span></h1>
    <p>{report_name}</p>
  </header>
  <main>
    <div class="card">
      <h2>Report details</h2>
      <dl>
        <dt>Project</dt>
        <dd>{project_name}</dd>
        <dt>Report type</dt>
        <dd>{report_type}</dd>
        <dt>Exported by</dt>
        <dd>{exporter}</dd>
        <dt>Generated</dt>
        <dd>{generated}</dd>
      </dl>
      <div class="actions">
        <a class="btn btn-primary" href="{pdf_href}">Open verified PDF</a>
        <a class="btn btn-secondary" href="{pdf_href}" download>Download PDF</a>
      </div>
      <p class="hint">
        This page confirms the report was generated by BuildWise. Tap <strong>Open verified PDF</strong>
        to view the full document on your device.
      </p>
    </div>
  </main>
</body>
</html>"""
            return HttpResponse(html, content_type='text/html; charset=utf-8')

        try:
            with report.file.open('rb') as fh:
                pdf_bytes = fh.read()
        except OSError:
            raise Http404('Report file is unavailable.')

        filename = report.file.name.split('/')[-1]
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['Cache-Control'] = 'public, max-age=3600'
        return response


class ProjectDocumentViewSet(viewsets.ModelViewSet):
    queryset = ProjectDocument.objects.all().order_by('-created_at')
    serializer_class = ProjectDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        from users.services import projects_queryset_for_user

        allowed = projects_queryset_for_user(self.request.user)
        queryset = super().get_queryset().filter(project__in=allowed)
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset.select_related('project', 'uploaded_by').prefetch_related('attachments')

    def _get_project_for_write(self):
        project_id = self.request.data.get('project')
        if not project_id and self.action in ('update', 'partial_update', 'destroy'):
            instance = self.get_object()
            return instance.project
        if not project_id:
            return None
        return Project.objects.filter(pk=project_id).first()

    def _assert_can_manage(self):
        project = self._get_project_for_write()
        if not project:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'project': 'Project is required.'})
        if not user_can_manage_project_documents(self.request.user, project):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You cannot manage documents for this project.')

    def create(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        from rest_framework.response import Response

        self._assert_can_manage()
        project = self._get_project_for_write()
        if not project:
            raise ValidationError({'project': 'Project is required.'})

        uploaded_files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not uploaded_files:
            raise ValidationError({'files': 'At least one file is required.'})

        title = (request.data.get('title') or '').strip()
        if not title:
            if len(uploaded_files) == 1:
                name = uploaded_files[0].name
                title = name.rsplit('.', 1)[0] if '.' in name else name
            else:
                raise ValidationError({'title': 'Enter a title for this document set.'})

        category = request.data.get('category') or 'other'
        description = (request.data.get('description') or '').strip()
        total_size = sum(f.size for f in uploaded_files)

        document = ProjectDocument.objects.create(
            project=project,
            title=title,
            category=category,
            description=description,
            uploaded_by=request.user,
            file_size_bytes=total_size,
        )
        for uploaded in uploaded_files:
            ProjectDocumentAttachment.objects.create(
                document=document,
                file=uploaded,
                file_size_bytes=uploaded.size,
                original_name=uploaded.name,
            )

        serializer = self.get_serializer(document)
        return Response(serializer.data, status=201)

    def update(self, request, *args, **kwargs):
        self._assert_can_manage()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._assert_can_manage()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_can_manage()
        instance = self.get_object()
        for attachment in instance.attachments.all():
            if attachment.file:
                attachment.file.delete(save=False)
        if instance.file:
            instance.file.delete(save=False)
        return super().destroy(request, *args, **kwargs)
