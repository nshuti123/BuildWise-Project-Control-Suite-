from decimal import Decimal

FIELD_REQUISITION_STOCK_MESSAGE = (
    'The requested quantity exceeds available warehouse stock. '
    'Please contact the Procurement department to arrange additional materials.'
)


def quantity_exceeds_warehouse_stock(material, quantity_requested) -> bool:
    if material is None or quantity_requested is None:
        return False
    return Decimal(str(material.current_stock)) < Decimal(str(quantity_requested))
