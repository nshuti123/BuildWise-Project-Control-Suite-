from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_pending_status(apps, schema_editor):
    DailyPayroll = apps.get_model("workforce", "DailyPayroll")
    DailyPayroll.objects.filter(status="pending").update(status="awaiting_site_engineer")


class Migration(migrations.Migration):

    dependencies = [
        ("workforce", "0003_worker_end_date_worker_start_date"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="dailypayroll",
            name="accountant_approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="accountant_approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="accountant_approved_payrolls",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="director_finance_approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="director_finance_approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="df_approved_payrolls",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="rejected_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="rejected_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="rejected_payrolls",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="rejection_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="site_confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="dailypayroll",
            name="site_confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="site_confirmed_payrolls",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="dailypayroll",
            name="status",
            field=models.CharField(
                choices=[
                    ("awaiting_site_engineer", "Awaiting Site Engineer"),
                    ("awaiting_finance", "Awaiting Finance Approval"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("paid", "Paid"),
                    ("pending", "Pending Approval"),
                ],
                default="awaiting_site_engineer",
                max_length=32,
            ),
        ),
        migrations.RunPython(migrate_pending_status, migrations.RunPython.noop),
    ]
