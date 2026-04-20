from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkerViewSet, AttendanceViewSet, DailyPayrollViewSet

router = DefaultRouter()
router.register(r'workers', WorkerViewSet, basename='worker')
router.register(r'attendances', AttendanceViewSet, basename='attendance')
router.register(r'payrolls', DailyPayrollViewSet, basename='payroll')

urlpatterns = [
    path('', include(router.urls)),
]
