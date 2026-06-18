from rest_framework.routers import SimpleRouter
from .views import ApprovalRequestViewSet

router = SimpleRouter()
router.register(r'', ApprovalRequestViewSet, basename='approval')

urlpatterns = router.urls
