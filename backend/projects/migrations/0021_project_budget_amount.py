from django.db import migrations, models
from decimal import Decimal, InvalidOperation
import re


def _parse_budget_to_decimal(budget_str):
    if budget_str is None:
        return None
    s = str(budget_str).strip()
    if not s:
        return None

    s = re.sub(r"(?i)\brwf\b", "", s)
    s = s.replace(" ", "")

    m = re.match(r"^([+-]?[\d,]*\.?\d*)([kKmMbB]?)$", s)
    if not m:
        s2 = re.sub(r"[^0-9,.\-kKmMbB]", "", s)
        m = re.match(r"^([+-]?[\d,]*\.?\d*)([kKmMbB]?)$", s2)
        if not m:
            return None
    num_part, suffix = m.group(1), m.group(2)
    if not num_part:
        return None

    num_part = num_part.replace(",", "")
    try:
        n = Decimal(num_part)
    except (InvalidOperation, ValueError):
        return None

    mult = Decimal(1)
    if suffix:
        suffix = suffix.upper()
        if suffix == "K":
            mult = Decimal(1_000)
        elif suffix == "M":
            mult = Decimal(1_000_000)
        elif suffix == "B":
            mult = Decimal(1_000_000_000)

    return (n * mult).quantize(Decimal("0.01"))


def forwards(apps, schema_editor):
    Project = apps.get_model("projects", "Project")
    for p in Project.objects.all().only("id", "budget", "budget_amount"):
        if p.budget_amount is not None:
            continue
        parsed = _parse_budget_to_decimal(p.budget)
        if parsed is not None:
            Project.objects.filter(id=p.id).update(budget_amount=parsed)


def backwards(apps, schema_editor):
    # Keep existing budget strings; just clear numeric field.
    Project = apps.get_model("projects", "Project")
    Project.objects.all().update(budget_amount=None)


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0020_remove_subtask_required_role_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="budget_amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True),
        ),
        migrations.RunPython(forwards, backwards),
    ]

