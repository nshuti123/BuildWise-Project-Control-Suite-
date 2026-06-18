from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0030_projectphase_start_end_dates'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='status_is_manual',
            field=models.BooleanField(
                default=False,
                help_text='When true, automatic status rules do not overwrite this project.',
            ),
        ),
    ]
