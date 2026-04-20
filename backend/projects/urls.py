from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, TaskViewSet, LocationViewSet, MilestoneViewSet, PhaseTaskViewSet

router = DefaultRouter()
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'tasks', TaskViewSet)
router.register(r'milestones', MilestoneViewSet, basename='milestone')
router.register(r'phase-tasks', PhaseTaskViewSet, basename='phasetask')
router.register(r'', ProjectViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
