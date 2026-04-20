from rest_framework import serializers
from .models import Worker, Attendance, DailyPayroll, PayrollRecord

class WorkerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Worker
        fields = '__all__'

class AttendanceSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_role = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = '__all__'

    def get_worker_name(self, obj):
        return f"{obj.worker.first_name} {obj.worker.last_name}"

    def get_worker_role(self, obj):
        return obj.worker.get_role_display()

class PayrollRecordSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_role = serializers.SerializerMethodField()
    
    class Meta:
        model = PayrollRecord
        fields = '__all__'
        
    def get_worker_name(self, obj):
        return f"{obj.worker.first_name} {obj.worker.last_name}"
        
    def get_worker_role(self, obj):
        return obj.worker.get_role_display()

class DailyPayrollSerializer(serializers.ModelSerializer):
    records = PayrollRecordSerializer(many=True, read_only=True)
    initiated_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyPayroll
        fields = '__all__'
        
    def get_initiated_by_name(self, obj):
        return obj.initiated_by.full_name if obj.initiated_by else "Unknown"

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else None
