from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0026_taskprogressphoto'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='project',
            name='site_accountant',
        ),
    ]
