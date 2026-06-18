from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0008_siteinventory_materialallocation'),
    ]

    operations = [
        migrations.AlterField(
            model_name='materialrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending Approval'),
                    ('pm_approved', 'PM Approved'),
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
