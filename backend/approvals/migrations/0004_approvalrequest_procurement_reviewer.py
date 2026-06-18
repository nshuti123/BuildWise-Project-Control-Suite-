from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('approvals', '0003_rename_pm_approved_to_po_approved'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='approvalrequest',
            name='procurement_reviewer',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='approval_requests_procurement_reviewed',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='approvalrequest',
            name='procurement_reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
