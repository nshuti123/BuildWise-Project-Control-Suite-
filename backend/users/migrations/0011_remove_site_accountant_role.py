from django.db import migrations, models


def site_accountants_to_foreman(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    CustomUser.objects.filter(role='site-accountant').update(role='site-foreman')


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_announcement'),
        ('projects', '0027_remove_project_site_accountant'),
    ]

    operations = [
        migrations.RunPython(site_accountants_to_foreman, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'System Admin'),
                    ('managing-director', 'Managing Director'),
                    ('director-finance', 'Director of Finance'),
                    ('technical-director', 'Technical Director'),
                    ('accountant', 'Accountant'),
                    ('project-manager', 'Project Manager'),
                    ('procurement-officer', 'Procurement Officer'),
                    ('site-engineer', 'Site Engineer'),
                    ('site-foreman', 'Site Foreman'),
                    ('subcontractor', 'Subcontractor'),
                    ('safety-officer', 'Safety Officer'),
                    ('client', 'Client'),
                ],
                default='site-engineer',
                max_length=50,
            ),
        ),
    ]
