from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0010_rename_pm_approved_to_po_approved'),
    ]

    operations = [
        migrations.AddField(
            model_name='materialrequest',
            name='rejection_notes',
            field=models.TextField(
                blank=True,
                help_text='Reason returned to the requester when this requisition is rejected.',
            ),
        ),
    ]
