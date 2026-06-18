from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0028_projectphase_phasetask_project_phase'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('category', models.CharField(
                    choices=[
                        ('construction_permit', 'Construction Permit'),
                        ('architectural_plan', 'Architectural Plans'),
                        ('structural_plan', 'Structural / Engineering Plans'),
                        ('contract', 'Contracts & Agreements'),
                        ('environmental', 'Environmental / EIA'),
                        ('survey', 'Survey & Geotechnical'),
                        ('other', 'Other Supporting Document'),
                    ],
                    default='other',
                    max_length=50,
                )),
                ('description', models.TextField(blank=True)),
                ('file', models.FileField(upload_to='project_documents/%Y/%m/')),
                ('file_size_bytes', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='projects.project')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_project_documents', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
