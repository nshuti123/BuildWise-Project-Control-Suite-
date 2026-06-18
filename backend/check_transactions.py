import os
import django
import sys

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "buildwise.settings")
django.setup()

from projects.models import Transaction
from procurement.models import PurchaseOrder

print("--- RECENT PURCHASE ORDERS ---")
for po in PurchaseOrder.objects.order_by('-created_at')[:5]:
    print(f"PO {po.po_number}: status={po.status}, project={po.project_id}, amount={po.total_amount}")

print("\n--- RECENT TRANSACTIONS ---")
for tx in Transaction.objects.order_by('-transaction_date', '-id')[:10]:
    print(f"Tx {tx.id}: project={tx.project_id}, status={tx.status}, amount={tx.amount}, desc={tx.description}")
