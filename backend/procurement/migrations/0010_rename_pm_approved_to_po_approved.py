from django.db import migrations, models


def forwards(apps, schema_editor):
    MaterialRequest = apps.get_model('procurement', 'MaterialRequest')
    MaterialRequest.objects.filter(status='pm_approved').update(status='po_approved')


def backwards(apps, schema_editor):
    MaterialRequest = apps.get_model('procurement', 'MaterialRequest')
    MaterialRequest.objects.filter(status='po_approved').update(status='pm_approved')


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0009_materialrequest_pm_approved_status'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='materialrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending Approval'),
                    ('po_approved', 'Procurement Approved'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('ordered', 'Ordered'),
                    ('fulfilled', 'Fulfilled'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
