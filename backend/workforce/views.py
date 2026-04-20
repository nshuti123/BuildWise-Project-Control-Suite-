from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.exceptions import ValidationError
import csv
import io
from django.utils import timezone
from .models import Worker, Attendance, DailyPayroll, PayrollRecord
from .serializers import WorkerSerializer, AttendanceSerializer, DailyPayrollSerializer

class WorkerViewSet(viewsets.ModelViewSet):
    serializer_class = WorkerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Auto-sweep script: Deactivate laborers whose contract has passed
        Worker.objects.filter(is_active=True, end_date__lt=timezone.now().date()).update(is_active=False)
        
        queryset = Worker.objects.all().order_by('first_name', 'last_name')
        project_id = self.request.query_params.get('project', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        if 'file' not in request.FILES:
            return Response({'detail': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        if not file.name.endswith('.csv'):
            return Response({'detail': 'Please upload a CSV file (Excel exported as CSV)'}, status=status.HTTP_400_BAD_REQUEST)
        
        project_id = request.data.get('project')
        if not project_id:
            return Response({'detail': 'Project ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
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
        queryset = Attendance.objects.all().order_by('-date', 'worker__first_name')
        project_id = self.request.query_params.get('project', None)
        date = self.request.query_params.get('date', None)
        
        if project_id is not None:
            queryset = queryset.filter(worker__project_id=project_id)
        if date is not None:
            queryset = queryset.filter(date=date)
            
        return queryset

    def perform_create(self, serializer):
        worker = serializer.validated_data.get('worker')
        date = serializer.validated_data.get('date')
        if DailyPayroll.objects.filter(project_id=worker.project_id, date=date).exists():
            raise ValidationError({'detail': 'You cannot edit attendance of a day where payment was already initiated.'})
        serializer.save()

    def perform_update(self, serializer):
        worker = getattr(serializer.instance, 'worker', None)
        date = getattr(serializer.instance, 'date', None)
        if DailyPayroll.objects.filter(project_id=worker.project_id, date=date).exists():
            raise ValidationError({'detail': 'You cannot edit attendance of a day where payment was already initiated.'})
        serializer.save()

class DailyPayrollViewSet(viewsets.ModelViewSet):
    serializer_class = DailyPayrollSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = DailyPayroll.objects.all().order_by('-date', '-created_at')
        project_id = self.request.query_params.get('project', None)
        date_param = self.request.query_params.get('date', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        if date_param is not None:
            queryset = queryset.filter(date=date_param)
        return queryset

    @action(detail=False, methods=['post'])
    def initiate(self, request):
        project_id = request.data.get('project')
        date = request.data.get('date')
        
        if not project_id or not date:
            return Response({'detail': 'Project and date are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if DailyPayroll.objects.filter(project_id=project_id, date=date).exists():
            return Response({'detail': 'Payroll for this date has already been initiated.'}, status=status.HTTP_400_BAD_REQUEST)
            
        attendances = Attendance.objects.filter(worker__project_id=project_id, date=date, worker__is_active=True)
        if not attendances.exists():
            return Response({'detail': 'No attendance records found for this date.'}, status=status.HTTP_400_BAD_REQUEST)
            
        payroll_run = DailyPayroll.objects.create(
            project_id=project_id,
            date=date,
            initiated_by=request.user,
            status='pending',
            total_amount=0
        )
        
        total = 0
        records = []
        for att in attendances:
            rate = att.worker.daily_rate
            calc_amount = 0
            if att.status == 'present':
                calc_amount = rate
            elif att.status == 'half-day':
                calc_amount = rate / 2
                
            records.append(PayrollRecord(
                payroll_run=payroll_run,
                worker=att.worker,
                attendance=att,
                calculated_amount=calc_amount
            ))
            total += calc_amount
            
        PayrollRecord.objects.bulk_create(records)
        payroll_run.total_amount = total
        payroll_run.save()
        
        return Response(DailyPayrollSerializer(payroll_run).data, status=status.HTTP_201_CREATED)
        
    @action(detail=True, methods=['patch'])
    def review(self, request, pk=None):
        payroll = self.get_object()
        action_status = request.data.get('status')
        if action_status not in ['approved', 'rejected']:
            return Response({'detail': 'Invalid status. Must be approved or rejected.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if payroll.status != 'pending':
            return Response({'detail': 'Only pending payrolls can be reviewed.'}, status=status.HTTP_400_BAD_REQUEST)
            
        payroll.status = action_status
        payroll.approved_by = request.user
        payroll.save()
        
        # Fire Notification to the initiator
        from users.models import Notification
        status_readable = "Approved" if action_status == "approved" else "Rejected"
        Notification.objects.create(
            user=payroll.initiated_by,
            title=f"Payroll Batch {status_readable}",
            message=f"Your payroll batch generated on {payroll.date} for {payroll.total_amount} Rwf was {action_status} by the Accountant.",
            link="/workforce"
        )
        
        return Response(DailyPayrollSerializer(payroll).data)
