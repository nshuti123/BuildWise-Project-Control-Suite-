import io

from django.conf import settings
from django.core.mail import EmailMessage
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from .pdf_branding import (
    MARGIN_X,
    draw_detail_rows,
    draw_page_footer,
    draw_page_header,
    draw_section_title,
)


def email_po_to_supplier(purchase_order):
    """Email the PO PDF to the supplier. Raises if the supplier has no email."""
    supplier = purchase_order.supplier
    if not supplier or not getattr(supplier, 'email', None):
        raise ValueError(
            f'Supplier "{getattr(supplier, "name", "Unknown")}" has no email address.'
        )

    pdf_bytes = generate_po_pdf(purchase_order)
    subject = f"New Purchase Order: {purchase_order.po_number}"
    body = (
        f"Hello {supplier.name},\n\n"
        f"Please find attached the new Purchase Order ({purchase_order.po_number}) "
        f"from BuildWise Procurement.\n\nThank you,\nThe BuildWise Team"
    )
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'procurement@buildwise.local')
    email = EmailMessage(subject, body, from_email, [supplier.email])
    email.attach(f"{purchase_order.po_number}.pdf", pdf_bytes, 'application/pdf')
    email.send(fail_silently=False)


def generate_po_pdf(purchase_order):
    """Professional purchase order PDF for the supplier."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    draw_page_header(
        p, width, height,
        doc_title="PURCHASE ORDER",
        doc_subtitle="Official procurement document",
    )

    draw_section_title(p, height - 130, "Order Details")

    quantity = float(purchase_order.quantity)
    unit_price = float(getattr(purchase_order.material, "unit_price", 0) or 0)
    total_cost = float(purchase_order.total_amount or (quantity * unit_price))

    fields = [
        ("PO Number", purchase_order.po_number),
        ("Order Date", purchase_order.order_date.strftime("%Y-%m-%d") if purchase_order.order_date else "N/A"),
        ("Supplier", purchase_order.supplier.name),
        ("Material", purchase_order.material.name),
        ("Quantity", f"{quantity:,.2f} {purchase_order.material.unit}"),
        ("Unit Price", f"Rwf {unit_price:,.2f}"),
        ("Total Amount", f"Rwf {total_cost:,.2f}"),
    ]
    if purchase_order.delivery_date:
        fields.insert(2, ("Expected Delivery", purchase_order.delivery_date.strftime("%Y-%m-%d")))
    if getattr(purchase_order, "project", None):
        fields.append(("Project", purchase_order.project.name))

    draw_detail_rows(p, width, height - 155, fields, row_height=32)

    p.setFillColor(colors.HexColor("#64748b"))
    p.setFont("Helvetica", 10)
    p.drawString(
        MARGIN_X,
        height - 155 - (len(fields) * 32) - 24,
        "Please confirm receipt of this purchase order and advise on delivery schedule.",
    )

    draw_page_footer(
        p, width,
        "This is an automatically generated Purchase Order from the BuildWise Platform.",
    )

    p.showPage()
    p.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_payment_proof_pdf(purchase_order, transaction, approved_by=None):
    """Payment proof PDF emailed to the supplier after finance approval."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    approver_name = "Finance Department"
    approver_role = ""
    if approved_by:
        approver_name = (
            f"{approved_by.first_name} {approved_by.last_name}".strip()
            or approved_by.username
        )
        if hasattr(approved_by, "get_role_display"):
            approver_role = approved_by.get_role_display()

    draw_page_header(
        p, width, height,
        doc_title="PAYMENT PROOF",
        doc_subtitle="Official payment confirmation",
    )

    draw_section_title(p, height - 130, "Payment Details")

    amount = float(transaction.amount or purchase_order.total_amount or 0)
    payment_date = transaction.transaction_date.strftime("%Y-%m-%d")
    project_name = (
        purchase_order.project.name if getattr(purchase_order, "project", None) else "N/A"
    )

    approver_display = approver_name
    if approver_role:
        approver_display = f"{approver_name} ({approver_role})"

    fields = [
        ("PO Number", purchase_order.po_number),
        ("Supplier", purchase_order.supplier.name),
        ("Project", project_name),
        ("Material", purchase_order.material.name),
        ("Quantity", f"{float(purchase_order.quantity):,.2f} {purchase_order.material.unit}"),
        ("Amount Paid", f"Rwf {amount:,.2f}"),
        ("Payment Date", payment_date),
        ("Approved By", approver_display),
        ("Transaction Ref", f"TXN-{transaction.id}"),
        ("Status", "PAID"),
    ]

    draw_detail_rows(p, width, height - 155, fields, row_height=30)

    # Paid stamp
    stamp_y = height - 155 - (len(fields) * 30) - 50
    p.saveState()
    p.setStrokeColor(colors.HexColor("#16a34a"))
    p.setLineWidth(3)
    p.roundRect(width - MARGIN_X - 130, stamp_y, 120, 42, 8, fill=0, stroke=1)
    p.setFillColor(colors.HexColor("#16a34a"))
    p.setFont("Helvetica-Bold", 16)
    p.drawCentredString(width - MARGIN_X - 70, stamp_y + 14, "PAID")
    p.restoreState()

    draw_page_footer(
        p, width,
        "BuildWise finance has approved payment for the referenced purchase order.",
    )

    p.showPage()
    p.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
