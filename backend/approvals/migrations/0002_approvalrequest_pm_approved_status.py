from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('approvals', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='approvalrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('pm_approved', 'PM Approved'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
