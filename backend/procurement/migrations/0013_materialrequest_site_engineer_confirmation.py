from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('procurement', '0012_materialrequest_cancelled_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='materialrequest',
            name='site_engineer_confirmed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='materialrequest',
            name='site_engineer_confirmed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='material_requests_confirmed',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
