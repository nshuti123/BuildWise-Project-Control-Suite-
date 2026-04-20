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
    SystemLogListView,
    SystemMetricsView,
    NotificationViewSet,
    MessageViewSet,
)

router = SimpleRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'messages', MessageViewSet, basename='message')

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('request-reset/', RequestPasswordResetView.as_view(), name='request_reset'),
    path('verify-reset/', VerifyPasswordResetView.as_view(), name='verify_reset'),
    path('system-logs/', SystemLogListView.as_view(), name='system_logs'),
    path('system-metrics/', SystemMetricsView.as_view(), name='system_metrics'),
    path('', include(router.urls)),
    path('', UserListView.as_view(), name='user_list_create'),
    path('<int:pk>/', UserDetailView.as_view(), name='user_detail'),
]
