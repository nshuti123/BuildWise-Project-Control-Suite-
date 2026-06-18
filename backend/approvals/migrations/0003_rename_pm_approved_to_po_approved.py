from django.db import migrations, models


def forwards(apps, schema_editor):
    ApprovalRequest = apps.get_model('approvals', 'ApprovalRequest')
    ApprovalRequest.objects.filter(status='pm_approved').update(status='po_approved')


def backwards(apps, schema_editor):
    ApprovalRequest = apps.get_model('approvals', 'ApprovalRequest')
    ApprovalRequest.objects.filter(status='po_approved').update(status='pm_approved')


class Migration(migrations.Migration):

    dependencies = [
        ('approvals', '0002_approvalrequest_pm_approved_status'),
        ('procurement', '0009_materialrequest_pm_approved_status'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='approvalrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('po_approved', 'Procurement Approved'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
