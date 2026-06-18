from django.db import migrations, models
import django.db.models.deletion


def link_existing_phase_tasks(apps, schema_editor):
    ProjectPhase = apps.get_model('projects', 'ProjectPhase')
    PhaseTask = apps.get_model('projects', 'PhaseTask')
    order_by_project: dict[int, int] = {}

    for task in PhaseTask.objects.all().order_by('project_id', 'id'):
        if not task.phase:
            continue
        pid = task.project_id
        order_by_project.setdefault(pid, 0)
        phase_obj, created = ProjectPhase.objects.get_or_create(
            project_id=pid,
            name=task.phase,
            defaults={'order': order_by_project[pid] + 1},
        )
        if created:
            order_by_project[pid] += 1
        task.project_phase_id = phase_obj.id
        task.save(update_fields=['project_phase_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0027_remove_project_site_accountant'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectPhase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True)),
                ('order', models.PositiveSmallIntegerField(default=0)),
                ('is_standard', models.BooleanField(default=False, help_text='True when created from the 13-phase construction template.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='phases', to='projects.project')),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('project', 'name')},
            },
        ),
        migrations.AddField(
            model_name='phasetask',
            name='project_phase',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tasks', to='projects.projectphase'),
        ),
        migrations.RunPython(link_existing_phase_tasks, migrations.RunPython.noop),
    ]
