from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('approvals', '0004_approvalrequest_procurement_reviewer'),
    ]

    operations = [
        migrations.AlterField(
            model_name='approvalrequest',
            name='request_type',
            field=models.CharField(
                choices=[
                    ('material_request', 'Material Request'),
                    ('purchase_order', 'Purchase Order'),
                    ('transaction', 'Transaction'),
                    ('task_complete', 'Task Completion'),
                    ('incident', 'Site Incident'),
                    ('allocation', 'Material Allocation'),
                    ('staff_assignment', 'Staff Assignment'),
                ],
                max_length=50,
            ),
        ),
    ]
