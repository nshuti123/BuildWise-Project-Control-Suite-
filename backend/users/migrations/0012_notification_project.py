from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0024_project_procurement_officer_project_site_accountant_and_more'),
        ('users', '0011_remove_site_accountant_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='project',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='projects.project',
            ),
        ),
    ]
