import json
import os
from django.core.management.base import BaseCommand
from projects.models import Location
from django.conf import settings

class Command(BaseCommand):
    help = 'Seeds the Rwanda locations into the Location table'

    def handle(self, *args, **kwargs):
        json_path = os.path.join(settings.BASE_DIR, 'rwanda_data.json')
        if not os.path.exists(json_path):
            self.stderr.write("rwanda_data.json not found in BASE_DIR")
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.stdout.write(f"Loaded {len(data)} location rows. Seeding database...")

        locations_to_create = []
        for row in data:
            locations_to_create.append(
                Location(
                    id=row['id'],
                    name=row['name'],
                    level=row['level'],
                    parent_id=row['parent']
                )
            )

        self.stdout.write("Deleting existing locations...")
        Location.objects.all().delete()

        self.stdout.write("Bulk creating locations in batches of 1000...")
        batch_size = 1000
        for i in range(0, len(locations_to_create), batch_size):
            Location.objects.bulk_create(locations_to_create[i:i+batch_size])
            self.stdout.write(f"Seeded {min(i+batch_size, len(locations_to_create))} rows...")

        self.stdout.write(self.style.SUCCESS("Successfully seeded all locations!"))
