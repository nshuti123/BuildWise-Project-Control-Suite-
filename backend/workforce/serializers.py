from rest_framework import serializers
from .models import Worker, Attendance, DailyPayroll, PayrollRecord


class WorkerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Worker
        fields = "__all__"

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"


class AttendanceSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_role = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = "__all__"

    def get_worker_name(self, obj):
        return f"{obj.worker.first_name} {obj.worker.last_name}"

    def get_worker_role(self, obj):
        return obj.worker.get_role_display()


class PayrollRecordSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_role = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRecord
        fields = "__all__"

    def get_worker_name(self, obj):
        return f"{obj.worker.first_name} {obj.worker.last_name}"

    def get_worker_role(self, obj):
        return obj.worker.get_role_display()


class DailyPayrollSerializer(serializers.ModelSerializer):
    records = PayrollRecordSerializer(many=True, read_only=True)
    initiated_by_name = serializers.SerializerMethodField()
    site_confirmed_by_name = serializers.SerializerMethodField()
    accountant_approved_by_name = serializers.SerializerMethodField()
    director_finance_approved_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    finance_approval_progress = serializers.SerializerMethodField()

    class Meta:
        model = DailyPayroll
        fields = "__all__"

    def get_initiated_by_name(self, obj):
        return (
            obj.initiated_by.full_name or obj.initiated_by.username
            if obj.initiated_by
            else "Unknown"
        )

    def get_site_confirmed_by_name(self, obj):
        u = obj.site_confirmed_by
        return u.full_name or u.username if u else None

    def get_accountant_approved_by_name(self, obj):
        u = obj.accountant_approved_by
        return u.full_name or u.username if u else None

    def get_director_finance_approved_by_name(self, obj):
        u = obj.director_finance_approved_by
        return u.full_name or u.username if u else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else None

    def get_rejected_by_name(self, obj):
        u = obj.rejected_by
        return u.full_name or u.username if u else None

    def get_finance_approval_progress(self, obj):
        return {
            "accountant": bool(obj.accountant_approved_by_id),
            "director_finance": bool(obj.director_finance_approved_by_id),
        }
