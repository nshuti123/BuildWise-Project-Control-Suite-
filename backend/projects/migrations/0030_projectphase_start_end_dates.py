from datetime import date, timedelta

from django.db import migrations, models


def backfill_phase_dates(apps, schema_editor):
    ProjectPhase = apps.get_model('projects', 'ProjectPhase')
    Project = apps.get_model('projects', 'Project')

    for project in Project.objects.all():
        phases = list(
            ProjectPhase.objects.filter(project_id=project.id).order_by('order', 'id')
        )
        if not phases:
            continue
        today = date.today()
        days_each = 14
        current = today
        for phase in phases:
            if phase.start_date and phase.end_date:
                current = phase.end_date + timedelta(days=1)
                continue
            phase.start_date = current
            phase.end_date = current + timedelta(days=days_each - 1)
            phase.save(update_fields=['start_date', 'end_date'])
            current = phase.end_date + timedelta(days=1)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0029_projectdocument'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectphase',
            name='start_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='projectphase',
            name='end_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_phase_dates, migrations.RunPython.noop),
    ]
