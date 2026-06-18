from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0011_materialrequest_rejection_notes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='materialrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending Approval'),
                    ('po_approved', 'Procurement Approved'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('cancelled', 'Cancelled'),
                    ('ordered', 'Ordered'),
                    ('fulfilled', 'Fulfilled'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
