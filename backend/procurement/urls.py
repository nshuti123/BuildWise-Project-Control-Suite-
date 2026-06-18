from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SupplierViewSet, MaterialViewSet, PurchaseOrderViewSet, MaterialRequestViewSet, SiteInventoryViewSet, MaterialAllocationViewSet

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'materials', MaterialViewSet)
router.register(r'orders', PurchaseOrderViewSet)
router.register(r'requests', MaterialRequestViewSet, basename='material-requests')
router.register(r'site-inventory', SiteInventoryViewSet, basename='site-inventory')
router.register(r'allocations', MaterialAllocationViewSet, basename='material-allocations')

urlpatterns = [
    path('', include(router.urls)),
]
