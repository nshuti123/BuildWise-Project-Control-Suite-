from django.core.management.base import BaseCommand

from users.audit import backfill_report_logs, purge_mock_system_logs


class Command(BaseCommand):
    help = 'Remove demo system logs and backfill real report-generation audit entries.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show how many rows would change without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        removed = purge_mock_system_logs(dry_run=dry_run)
        backfilled = backfill_report_logs(dry_run=dry_run)

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'Dry run: would remove {removed} mock log(s) and backfill {backfilled} report log(s).'
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f'Removed {removed} mock log(s) and backfilled {backfilled} report log(s).'
            )
        )
