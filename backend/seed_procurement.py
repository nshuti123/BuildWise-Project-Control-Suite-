import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from procurement.models import Supplier, Material

def seed_procurement_data():
    suppliers = [
        {"name": "Dangote Cement", "rating": 4.8},
        {"name": "Steel Works Ltd", "rating": 4.5},
        {"name": "Lagos Sand Dredgers", "rating": 3.9},
        {"name": "BuildRight Supplies", "rating": 4.2},
    ]

    for s_data in suppliers:
        Supplier.objects.get_or_create(name=s_data['name'], defaults={"rating": s_data['rating']})

    materials = [
        {"name": "Portland Cement", "unit": "Bags", "unit_price": 12500, "current_stock": 850, "minimum_stock": 200},
        {"name": "12mm Rebar", "unit": "Tons", "unit_price": 850000, "current_stock": 45, "minimum_stock": 30},
        {"name": "Sharp Sand", "unit": "Trips", "unit_price": 45000, "current_stock": 10, "minimum_stock": 15},
        {"name": "Ceramic Tiles", "unit": "Boxes", "unit_price": 15000, "current_stock": 150, "minimum_stock": 250},
        {"name": "Treated Timber", "unit": "Planks", "unit_price": 4000, "current_stock": 600, "minimum_stock": 200},
    ]

    for m_data in materials:
        Material.objects.get_or_create(name=m_data['name'], defaults=m_data)

    print("Successfully seeded suppliers and materials.")

if __name__ == '__main__':
    seed_procurement_data()
