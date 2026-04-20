from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Project, Task, Location, Milestone, PhaseTask
from .serializers import ProjectSerializer, TaskSerializer, LocationSerializer, MilestoneSerializer, PhaseTaskSerializer

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

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.role == 'site-engineer':
            queryset = queryset.filter(site_engineer=user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(manager=self.request.user)

    @action(detail=False, methods=['get'])
    def site_engineers(self, request):
        from users.models import CustomUser
        from users.serializers import CustomUserSerializer
        engineers = CustomUser.objects.filter(role='site-engineer', is_active=True)
        serializer = CustomUserSerializer(engineers, many=True, context={'request': request})
        return Response(serializer.data)

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().order_by('-created_at')
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Task.objects.all().order_by('-created_at')
        elif user.role == 'project-manager':
            from django.db.models import Q
            return Task.objects.filter(Q(project__manager=user) | Q(assigned_to=user)).distinct().order_by('-created_at')
        elif user.role == 'site-engineer':
            from django.db.models import Q
            return Task.objects.filter(Q(project__site_engineer=user) | Q(assigned_to=user)).distinct().order_by('-created_at')
        else:
            return Task.objects.filter(assigned_to=user).order_by('-created_at')

    def _check_deadlines(self, queryset):
        from datetime import date, timedelta
        from users.models import Notification
        
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        active_tasks = queryset.exclude(status='completed').exclude(date__isnull=True)
        for task in active_tasks:
            if not task.assigned_to:
                continue
                
            if task.date < today and not task.reminded_overdue:
                desc_text = f"\n\nDetails: {task.description}" if task.description else ""
                Notification.objects.create(
                    user=task.assigned_to,
                    title="Task Overdue!",
                    message=f"Critical: Your task '{task.title}' is overdue (Deadline was {task.date}).{desc_text}",
                    link="/tasks"
                )
                task.reminded_overdue = True
                task.save(update_fields=['reminded_overdue'])
                
            elif (task.date == today or task.date == tomorrow) and not task.reminded_due_soon and not task.reminded_overdue:
                desc_text = f"\n\nDetails: {task.description}" if task.description else ""
                Notification.objects.create(
                    user=task.assigned_to,
                    title="Task Due Soon",
                    message=f"Urgent: Your task '{task.title}' is due on {task.date}.{desc_text}",
                    link="/tasks"
                )
                task.reminded_due_soon = True
                task.save(update_fields=['reminded_due_soon'])

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        self._check_deadlines(self.get_queryset())
        return response

    def perform_create(self, serializer):
        if 'assigned_to' not in serializer.validated_data:
            serializer.save(assigned_to=self.request.user)
        else:
            serializer.save()

    @action(detail=False, methods=['get'], url_path='my-tasks')
    def my_tasks(self, request):
        user = request.user
        tasks = Task.objects.filter(assigned_to=user).order_by('date', 'time_str')
        self._check_deadlines(tasks)
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)

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

class PhaseTaskViewSet(viewsets.ModelViewSet):
    queryset = PhaseTask.objects.all().order_by('start_date')
    serializer_class = PhaseTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset
