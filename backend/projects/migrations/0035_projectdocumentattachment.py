from django.db import migrations, models
import django.db.models.deletion


def migrate_legacy_files_to_attachments(apps, schema_editor):
    ProjectDocument = apps.get_model('projects', 'ProjectDocument')
    ProjectDocumentAttachment = apps.get_model('projects', 'ProjectDocumentAttachment')
    for doc in ProjectDocument.objects.all():
        if not doc.file:
            continue
        ProjectDocumentAttachment.objects.create(
            document_id=doc.id,
            file=doc.file,
            file_size_bytes=doc.file_size_bytes or 0,
            original_name=doc.file.name.split('/')[-1],
        )


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0034_alter_generatedreport_report_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='projectdocument',
            name='file',
            field=models.FileField(blank=True, null=True, upload_to='project_documents/%Y/%m/'),
        ),
        migrations.CreateModel(
            name='ProjectDocumentAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='project_documents/%Y/%m/')),
                ('file_size_bytes', models.PositiveIntegerField(default=0)),
                ('original_name', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='projects.projectdocument')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.RunPython(migrate_legacy_files_to_attachments, migrations.RunPython.noop),
    ]
