from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0024_project_procurement_officer_project_site_accountant_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='project_accountant',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'role': 'accountant'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='finance_lead_projects',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
