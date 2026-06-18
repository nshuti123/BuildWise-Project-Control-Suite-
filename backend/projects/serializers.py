from rest_framework import serializers
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
from .phase_services import next_phase_order
from users.serializers import CustomUserSerializer
from workforce.serializers import WorkerSerializer
from django.db.models import Sum
from decimal import Decimal
from django.utils import timezone
from workforce.models import Worker

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'

class ProjectSerializer(serializers.ModelSerializer):
    manager_details = CustomUserSerializer(source='manager', read_only=True)
    site_engineer_details = CustomUserSerializer(source='site_engineer', read_only=True)
    project_accountant_details = CustomUserSerializer(source='project_accountant', read_only=True)
    procurement_officer_details = CustomUserSerializer(source='procurement_officer', read_only=True)
    site_foreman_details = CustomUserSerializer(source='site_foreman', read_only=True)
    subcontractor_details = CustomUserSerializer(source='subcontractors', many=True, read_only=True)
    location_details = LocationSerializer(source='location', read_only=True)

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ('manager',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if not request:
            return

        from users.models import CustomUser
        from users.services import (
            user_can_assign_project_manager,
            user_has_full_access,
            user_has_technical_oversight,
        )

        if user_can_assign_project_manager(request.user) and 'manager' in self.fields:
            self.fields['manager'].read_only = False
            pm_qs = CustomUser.objects.filter(role='project-manager', is_active=True)
            if user_has_technical_oversight(request.user) and not user_has_full_access(
                request.user
            ):
                pm_qs = pm_qs.filter(reports_to=request.user)
            self.fields['manager'].queryset = pm_qs

        if 'site_engineer' in self.fields:
            self.fields['site_engineer'].queryset = CustomUser.objects.filter(
                role='site-engineer', is_active=True
            )

        if 'location' in self.fields:
            self.fields['location'].queryset = Location.objects.all()

    def validate(self, data):
        """
        Keep compatibility with legacy string budgets while preferring numeric `budget_amount`.
        If client sends `budget` but not `budget_amount`, we parse it into `budget_amount`.
        """
        budget_amount = data.get('budget_amount', getattr(self.instance, 'budget_amount', None))
        budget_str = data.get('budget', getattr(self.instance, 'budget', None))

        if budget_amount in ("", None) and budget_str:
            from .services import parse_project_budget_to_decimal
            parsed = parse_project_budget_to_decimal(budget_str)
            if parsed is not None:
                data['budget_amount'] = parsed

        request = self.context.get('request')
        if request and self.instance is None:
            from users.services import (
                user_can_create_project,
                resolve_project_manager_for_assignment,
            )
            if user_can_create_project(request.user):
                manager = data.get('manager')
                if hasattr(manager, 'id'):
                    manager = manager.id
                    data['manager'] = manager
                if manager is None and hasattr(request, 'data'):
                    raw = request.data.get('manager')
                    if raw not in (None, ''):
                        try:
                            manager = int(raw)
                            data['manager'] = manager
                        except (TypeError, ValueError):
                            pass
                if manager is not None and not resolve_project_manager_for_assignment(
                    request.user, manager
                ):
                    raise serializers.ValidationError({
                        'manager': 'Select a project manager who reports to the Technical Director.',
                    })

        if request and self.instance is not None and 'manager' in data:
            from users.services import (
                user_can_assign_project_manager,
                resolve_project_manager_for_assignment,
            )
            manager = data.get('manager')
            if hasattr(manager, 'id'):
                manager = manager.id
                data['manager'] = manager
            if user_can_assign_project_manager(request.user):
                if not resolve_project_manager_for_assignment(request.user, manager):
                    raise serializers.ValidationError({
                        'manager': 'Invalid project manager for assignment.',
                    })
            else:
                data.pop('manager', None)

        return data

class SubTaskSerializer(serializers.ModelSerializer):
    assigned_to_details = WorkerSerializer(source='assigned_to', many=True, read_only=True)

    class Meta:
        model = SubTask
        fields = '__all__'

    def validate(self, data):
        assigned_to = data.get('assigned_to', None)
        if assigned_to is None:
            return data

        today = timezone.now().date()
        workers = Worker.objects.filter(id__in=[w.id for w in assigned_to] if hasattr(assigned_to, "__iter__") else [])
        invalid = workers.filter(
            start_date__isnull=True
        ) | workers.filter(
            end_date__isnull=True
        ) | workers.filter(
            end_date__lt=today
        ) | workers.filter(
            start_date__gt=today
        )
        if invalid.exists():
            names = ", ".join(f"{w.first_name} {w.last_name}".strip() for w in invalid[:5])
            raise serializers.ValidationError({
                "assigned_to": f"Cannot assign workers without an active contract (start/end dates must exist and include today). Invalid: {names}"
            })
        return data

class TaskProgressPhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskProgressPhoto
        fields = [
            "id",
            "task",
            "image",
            "image_url",
            "caption",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = ["task", "uploaded_by", "created_at", "image_url", "uploaded_by_name"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.full_name or obj.uploaded_by.username
        return None


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_details = serializers.SerializerMethodField()
    task_progress = serializers.SerializerMethodField()
    can_update_status = serializers.SerializerMethodField()
    status_lock_reason = serializers.SerializerMethodField()
    phase_task_details = serializers.SerializerMethodField()
    project_details = ProjectSerializer(source='project', read_only=True)
    subtasks = SubTaskSerializer(many=True, read_only=True)
    progress_photos = TaskProgressPhotoSerializer(many=True, read_only=True)
    photo_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'priority', 'status', 'location', 'date', 'time_str',
            'project', 'created_at', 'updated_at', 'assigned_to_details', 'project_details',
            'subtasks', 'phase_task', 'phase_task_details', 'required_skills', 'task_progress',
            'can_update_status', 'status_lock_reason', 'progress_photos', 'photo_count',
        ]
        read_only_fields = ()

    def validate(self, data):
        # We allow status updates even if dependencies aren't strictly met, 
        # as the frontend will handle warnings and manual overrides.
        if data.get('status') == 'completed' or (self.instance and getattr(self.instance, 'status', None) == 'completed' and 'status' not in data):
            # Check if transitioning to or staying in completed state
            if self.instance and self.instance.subtasks.filter(is_completed=False).exists():
                if data.get('status') == 'completed':
                    raise serializers.ValidationError({"status": "Cannot mark task as complete while it has incomplete subtasks."})
        return data

    def get_photo_count(self, obj):
        return obj.progress_photos.count()

    def get_assigned_to_details(self, obj):
        # Include both workers assigned directly to the task and workers
        # assigned through subtasks, then deduplicate by worker id.
        workers_by_id = {}

        for worker in obj.assigned_to.all():
            workers_by_id[worker.id] = worker

        for st in obj.subtasks.all():
            for worker in st.assigned_to.all():
                workers_by_id[worker.id] = worker

        return WorkerSerializer(
            list(workers_by_id.values()),
            many=True,
            context=self.context
        ).data

    def get_task_progress(self, obj):
        from .services import calculate_task_progress
        return calculate_task_progress(obj)

    def get_can_update_status(self, obj):
        if obj.phase_task and obj.phase_task.depends_on and obj.phase_task.depends_on.status != 'completed':
            return False

        return True

    def get_status_lock_reason(self, obj):
        if obj.phase_task and obj.phase_task.depends_on and obj.phase_task.depends_on.status != 'completed':
            return f"Dependency locked! Complete '{obj.phase_task.depends_on.phase}' first."
        return ""

    def get_phase_task_details(self, obj):
        if not obj.phase_task:
            return None
        depends_on = obj.phase_task.depends_on
        return {
            "id": obj.phase_task.id,
            "phase": obj.phase_task.phase,
            "task_name": obj.phase_task.task_name,
            "depends_on_phase": depends_on.phase if depends_on else None,
            "depends_on_task_name": depends_on.task_name if depends_on else None,
        }

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = '__all__'


class ProjectPhaseSerializer(serializers.ModelSerializer):
    task_count = serializers.SerializerMethodField()
    duration_days = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPhase
        fields = [
            'id', 'project', 'name', 'description', 'order',
            'start_date', 'end_date', 'duration_days',
            'is_standard', 'task_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ('created_at', 'updated_at')

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_duration_days(self, obj):
        if obj.start_date and obj.end_date:
            return (obj.end_date - obj.start_date).days + 1
        return None

    def validate(self, data):
        from .phase_services import (
            validate_phase_date_range,
            validate_phase_sequence,
            validate_tasks_fit_phase,
        )

        instance = getattr(self, 'instance', None)
        project = data.get('project') or (instance.project if instance else None)
        order = data.get('order', instance.order if instance else None)
        start = data.get('start_date', instance.start_date if instance else None)
        end = data.get('end_date', instance.end_date if instance else None)

        if order is None and project:
            from .phase_services import next_phase_order
            order = next_phase_order(project)

        validate_phase_date_range(start, end)
        if project:
            validate_phase_sequence(
                project,
                order,
                start,
                end,
                exclude_phase_id=instance.pk if instance else None,
            )
        if instance:
            validate_tasks_fit_phase(instance, start, end)
        return data

    def create(self, validated_data):
        from .phase_services import next_phase_order, suggest_phase_start

        project = validated_data.get('project')
        if project and not validated_data.get('order'):
            validated_data['order'] = next_phase_order(project)

        if project and not validated_data.get('start_date'):
            validated_data['start_date'] = suggest_phase_start(
                project, validated_data['order']
            )
        if (
            project
            and validated_data.get('start_date')
            and not validated_data.get('end_date')
        ):
            from datetime import timedelta
            validated_data['end_date'] = validated_data['start_date'] + timedelta(days=13)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        from .phase_services import apply_phase_update

        return apply_phase_update(instance, validated_data)


class PhaseTaskSerializer(serializers.ModelSerializer):
    assigned_to_details = WorkerSerializer(source='assigned_to', many=True, read_only=True)
    project_phase_name = serializers.CharField(source='project_phase.name', read_only=True)

    class Meta:
        model = PhaseTask
        fields = '__all__'

    def validate(self, data):
        project = data.get('project') or getattr(self.instance, 'project', None)
        project_phase = data.get('project_phase')
        phase_name = data.get('phase')

        if project_phase and project and project_phase.project_id != project.id:
            raise serializers.ValidationError({
                'project_phase': 'Phase must belong to the same project.',
            })

        if project_phase:
            data['phase'] = project_phase.name
        elif phase_name and project:
            project_phase, _ = ProjectPhase.objects.get_or_create(
                project=project,
                name=phase_name.strip(),
                defaults={'order': next_phase_order(project)},
            )
            data['project_phase'] = project_phase
            data['phase'] = project_phase.name
        elif not phase_name and not getattr(self.instance, 'phase', None):
            raise serializers.ValidationError({
                'project_phase': 'Select a phase or enter a phase name.',
            })

        project_phase = data.get('project_phase') or getattr(self.instance, 'project_phase', None)
        start_date = data.get('start_date', getattr(self.instance, 'start_date', None))
        duration = data.get(
            'duration_working_days',
            getattr(self.instance, 'duration_working_days', 1) or 1,
        )
        if project_phase and start_date:
            from .phase_services import validate_task_against_phase
            validate_task_against_phase(project_phase, start_date, duration)

        assigned_to = data.get('assigned_to', None)
        if assigned_to is None:
            return data

        today = timezone.now().date()
        workers = Worker.objects.filter(id__in=[w.id for w in assigned_to] if hasattr(assigned_to, "__iter__") else [])
        invalid = workers.filter(
            start_date__isnull=True
        ) | workers.filter(
            end_date__isnull=True
        ) | workers.filter(
            end_date__lt=today
        ) | workers.filter(
            start_date__gt=today
        )
        if invalid.exists():
            names = ", ".join(f"{w.first_name} {w.last_name}".strip() for w in invalid[:5])
            raise serializers.ValidationError({
                "assigned_to": f"Cannot assign workers without an active contract (start/end dates must exist and include today). Invalid: {names}"
            })
        return data

class PhaseTaskBaselineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhaseTaskBaseline
        fields = '__all__'

class ProjectBaselineSerializer(serializers.ModelSerializer):
    baseline_tasks = PhaseTaskBaselineSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectBaseline
        fields = '__all__'


# =====================================================
# BUDGET & COST CONTROL SERIALIZERS
# =====================================================

class BudgetCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetCategory
        fields = '__all__'


class BudgetItemSerializer(serializers.ModelSerializer):
    category_details = BudgetCategorySerializer(source='category', read_only=True)
    variance = serializers.ReadOnlyField()
    variance_percent = serializers.ReadOnlyField()

    class Meta:
        model = BudgetItem
        fields = '__all__'

    def validate(self, data):
        """
        Enforce that budget allocations (sum of planned_amount for a project) cannot exceed the Project budget.

        This runs on both create and update.
        """
        project = data.get('project', getattr(self.instance, 'project', None))
        planned_amount = data.get('planned_amount', getattr(self.instance, 'planned_amount', None))

        if not project or planned_amount is None:
            return data

        # Prefer numeric project.budget_amount; fallback to parsing legacy string budget
        project_budget = getattr(project, 'budget_amount', None)
        if project_budget is None:
            from .services import parse_project_budget_to_decimal
            project_budget = parse_project_budget_to_decimal(getattr(project, 'budget', None))
        if not project_budget or project_budget <= 0:
            # If project budget is not set/unparseable, don't block allocations.
            return data

        qs = BudgetItem.objects.filter(project=project)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)

        allocated_other = qs.aggregate(total=Sum('planned_amount'))['total'] or Decimal('0')
        new_total = (allocated_other + Decimal(planned_amount)).quantize(Decimal("0.01"))

        if new_total > project_budget:
            remaining = (project_budget - allocated_other).quantize(Decimal("0.01"))
            raise serializers.ValidationError({
                "planned_amount": (
                    f"Planned allocations cannot exceed the project budget. "
                    f"Project budget: {project_budget:,.2f} Rwf, "
                    f"already allocated: {allocated_other:,.2f} Rwf, "
                    f"remaining: {remaining:,.2f} Rwf."
                )
            })

        return data


class TransactionSerializer(serializers.ModelSerializer):
    category_details = BudgetCategorySerializer(source='category', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = Transaction
        fields = '__all__'

    def validate(self, data):
        status = data.get('status', getattr(self.instance, 'status', None))
        project = data.get('project', getattr(self.instance, 'project', None))
        category = data.get('category', getattr(self.instance, 'category', None))
        
        # Validate when marking as approved (or creating approved)
        if status == 'approved' and (not self.instance or self.instance.status != 'approved'):
            if project and category:
                amount = data.get('amount', getattr(self.instance, 'amount', 0))
                budget_item = data.get('budget_item', getattr(self.instance, 'budget_item', None))
                from .services import check_budget_limit
                check_budget_limit(
                    project,
                    category.name,
                    amount,
                    budget_item=budget_item,
                )
                
        return data

class GeneratedReportSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)

    class Meta:
        model = GeneratedReport
        fields = '__all__'
        read_only_fields = ('created_by',)


class ProjectDocumentAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDocumentAttachment
        fields = [
            'id', 'file', 'file_url', 'file_name', 'file_size_bytes',
            'original_name', 'created_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

    def get_file_name(self, obj):
        if obj.original_name:
            return obj.original_name
        if not obj.file:
            return None
        return obj.file.name.split('/')[-1]


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    attachments = serializers.SerializerMethodField()
    file_count = serializers.SerializerMethodField()
    total_size_bytes = serializers.SerializerMethodField()
    # Legacy single-file fields (first attachment)
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDocument
        fields = [
            'id', 'project', 'title', 'category', 'category_display',
            'description', 'attachments', 'file_count', 'total_size_bytes',
            'file_url', 'file_name', 'file_size_bytes',
            'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = (
            'uploaded_by', 'file_size_bytes', 'created_at', 'updated_at',
            'attachments', 'file_count', 'total_size_bytes', 'file_url', 'file_name',
        )

    def _attachment_list(self, obj):
        items = list(obj.attachments.all())
        if items:
            return items
        if obj.file:
            return [obj]
        return []

    def get_attachments(self, obj):
        att_serializer = ProjectDocumentAttachmentSerializer(
            obj.attachments.all(), many=True, context=self.context,
        )
        if att_serializer.data:
            return att_serializer.data
        if obj.file:
            request = self.context.get('request')
            url = request.build_absolute_uri(obj.file.url) if request else obj.file.url
            return [{
                'id': None,
                'file_url': url,
                'file_name': obj.file.name.split('/')[-1],
                'file_size_bytes': obj.file_size_bytes,
                'original_name': obj.file.name.split('/')[-1],
                'created_at': obj.created_at,
            }]
        return []

    def get_file_count(self, obj):
        count = obj.attachments.count()
        if count:
            return count
        return 1 if obj.file else 0

    def get_total_size_bytes(self, obj):
        from django.db.models import Sum
        total = obj.attachments.aggregate(s=Sum('file_size_bytes'))['s']
        if total:
            return total
        return obj.file_size_bytes or 0

    def get_file_url(self, obj):
        first = obj.attachments.first()
        if first and first.file:
            request = self.context.get('request')
            return request.build_absolute_uri(first.file.url) if request else first.file.url
        if obj.file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def get_file_name(self, obj):
        first = obj.attachments.first()
        if first:
            return first.original_name or (first.file.name.split('/')[-1] if first.file else None)
        if obj.file:
            return obj.file.name.split('/')[-1]
        return None

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.full_name or obj.uploaded_by.username


class SiteIncidentSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()
    project_name = serializers.ReadOnlyField(source='project.name')

    class Meta:
        model = SiteIncident
        fields = '__all__'
        read_only_fields = ['reported_by', 'date_reported']

    def get_reported_by_name(self, obj):
        return f"{obj.reported_by.first_name} {obj.reported_by.last_name}".strip() or obj.reported_by.username

    def update(self, instance, validated_data):
        from django.utils import timezone

        new_status = validated_data.get('status', instance.status)
        if new_status == 'resolved' and instance.status != 'resolved':
            validated_data.setdefault('date_resolved', timezone.now())
        elif new_status == 'open' and instance.status == 'resolved':
            validated_data['date_resolved'] = None
        return super().update(instance, validated_data)
