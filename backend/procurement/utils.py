import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

def generate_po_pdf(purchase_order):
    """
    Generates a professional PDF document for a Purchase Order
    and returns it as a byte stream (io.BytesIO).
    """
    buffer = io.BytesIO()
    
    # Create the PDF object, using the buffer as its "file."
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 24)
    p.drawString(50, height - 70, "BUILDWISE PROCUREMENT")
    
    p.setFont("Helvetica", 12)
    p.setFillColor(colors.dimgrey)
    p.drawString(50, height - 90, "Automated Purchase Order Document")
    
    # Draw a line
    p.setStrokeColor(colors.grey)
    p.line(50, height - 110, width - 50, height - 110)
    
    # Details section
    p.setFillColor(colors.black)
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, height - 150, "Purchase Order Details")
    
    p.setFont("Helvetica", 12)
    
    # Gather info
    po_number = purchase_order.po_number
    supplier_name = purchase_order.supplier.name
    material_name = purchase_order.material.name
    quantity = float(purchase_order.quantity)
    unit_price = float(purchase_order.material.unit_price) if hasattr(purchase_order.material, 'unit_price') else 0.0
    total_cost = quantity * unit_price
    
    # Draw information table (manually positioned)
    start_y = height - 190
    line_spacing = 30
    
    fields = [
        ("PO Number:", po_number),
        ("Date:", purchase_order.order_date.strftime("%Y-%m-%d") if hasattr(purchase_order, 'order_date') else "N/A"),
        ("Supplier:", supplier_name),
        ("Material Requested:", material_name),
        ("Quantity:", f"{quantity:,.2f} {purchase_order.material.unit}"),
        ("Unit Price:", f"Rwf {unit_price:,.2f}"),
        ("Total Estimated Cost:", f"Rwf {total_cost:,.2f}"),
    ]
    
    for i, (label, val) in enumerate(fields):
        y_pos = start_y - (i * line_spacing)
        
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y_pos, label)
        
        p.setFont("Helvetica", 12)
        p.drawString(200, y_pos, str(val))
        
        # Draw a faint border for rows
        p.setStrokeColor(colors.whitesmoke)
        p.line(50, y_pos - 10, width - 50, y_pos - 10)

    # Footer
    p.setFont("Helvetica-Oblique", 10)
    p.setFillColor(colors.grey)
    p.drawString(50, 50, "This is an automatically generated Purchase Order from the BuildWise Platform.")
    
    # Close the PDF object cleanly, and we're done.
    p.showPage()
    p.save()
    
    # Get the value of the BytesIO buffer and return it
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
