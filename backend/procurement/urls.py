from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SupplierViewSet, MaterialViewSet, PurchaseOrderViewSet, MaterialRequestViewSet

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'materials', MaterialViewSet)
router.register(r'orders', PurchaseOrderViewSet)
router.register(r'requests', MaterialRequestViewSet, basename='material-requests')

urlpatterns = [
    path('', include(router.urls)),
]
