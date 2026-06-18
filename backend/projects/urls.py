from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, TaskViewSet, LocationViewSet, MilestoneViewSet, ProjectPhaseViewSet, PhaseTaskViewSet, ProjectBaselineViewSet, SubTaskViewSet, BudgetCategoryViewSet, BudgetItemViewSet, TransactionViewSet, GeneratedReportViewSet, ProjectDocumentViewSet, SiteIncidentViewSet

router = DefaultRouter()
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'tasks', TaskViewSet)
router.register(r'subtasks', SubTaskViewSet, basename='subtask')
router.register(r'milestones', MilestoneViewSet, basename='milestone')
router.register(r'phases', ProjectPhaseViewSet, basename='projectphase')
router.register(r'phase-tasks', PhaseTaskViewSet, basename='phasetask')
router.register(r'baselines', ProjectBaselineViewSet, basename='baseline')
router.register(r'budget-categories', BudgetCategoryViewSet, basename='budgetcategory')
router.register(r'budget-items', BudgetItemViewSet, basename='budgetitem')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'generated-reports', GeneratedReportViewSet, basename='generatedreport')
router.register(r'project-documents', ProjectDocumentViewSet, basename='projectdocument')
router.register(r'incidents', SiteIncidentViewSet, basename='siteincident')
router.register(r'', ProjectViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
