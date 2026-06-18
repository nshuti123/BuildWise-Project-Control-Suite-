import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.audit import backfill_report_logs, purge_mock_system_logs


def sync_logs():
    removed = purge_mock_system_logs()
    backfilled = backfill_report_logs()
    print(f'Removed {removed} mock log(s); backfilled {backfilled} report log(s).')


if __name__ == "__main__":
    sync_logs()
