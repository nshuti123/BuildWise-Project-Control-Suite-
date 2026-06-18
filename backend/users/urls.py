from django.urls import path, include
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from .views import (
    CustomTokenObtainPairView,
    UserProfileView,
    UserListView,
    UserDetailView,
    RequestPasswordResetView,
    VerifyPasswordResetView,
    SendReportEmailView,
    SystemLogListView,
    SystemMetricsView,
    NotificationViewSet,
    MessageViewSet,
    AnnouncementViewSet,
    MessageRecipientsView,
    OrgChartView,
    SubordinatesView,
)

router = SimpleRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('request-reset/', RequestPasswordResetView.as_view(), name='request_reset'),
    path('verify-reset/', VerifyPasswordResetView.as_view(), name='verify_reset'),
    path('send-report-email/', SendReportEmailView.as_view(), name='send_report_email'),
    path('system-logs/', SystemLogListView.as_view(), name='system_logs'),
    path('system-metrics/', SystemMetricsView.as_view(), name='system_metrics'),
    path('org-chart/', OrgChartView.as_view(), name='org_chart'),
    path('subordinates/', SubordinatesView.as_view(), name='subordinates'),
    path('message-recipients/', MessageRecipientsView.as_view(), name='message_recipients'),
    path('', include(router.urls)),
    path('', UserListView.as_view(), name='user_list_create'),
    path('<int:pk>/', UserDetailView.as_view(), name='user_detail'),
]
