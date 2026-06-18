from django.contrib import admin
from .models import Project, Task, Location, Milestone, PhaseTask, ProjectBaseline, PhaseTaskBaseline, SubTask, BudgetCategory, BudgetItem, Transaction

# Register your models here.
admin.site.register(Project)
admin.site.register(Task)
admin.site.register(Location)
admin.site.register(Milestone)
admin.site.register(PhaseTask)
admin.site.register(ProjectBaseline)
admin.site.register(PhaseTaskBaseline)
admin.site.register(SubTask)
admin.site.register(BudgetCategory)
admin.site.register(BudgetItem)
admin.site.register(Transaction)
