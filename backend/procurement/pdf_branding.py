"""Shared BuildWise branding for supplier-facing PDF documents."""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

BRAND_ORANGE = colors.HexColor("#f97316")
BRAND_ORANGE_LIGHT = colors.HexColor("#ffedd5")
BRAND_DARK = colors.HexColor("#0f172a")
BRAND_SLATE = colors.HexColor("#64748b")
BORDER = colors.HexColor("#e2e8f0")
ROW_ALT = colors.HexColor("#f8fafc")

MARGIN_X = 50
HEADER_TOP = 52
LOGO_SIZE = 46


def build_logo_drawing(scale=1.0):
    """Vector logo: orange mark + BuildWise wordmark."""
    w = 200 * scale
    h = LOGO_SIZE * scale
    d = Drawing(w, h)

    mark = LOGO_SIZE * scale
    d.add(Rect(
        0, 0, mark, mark, rx=10 * scale, ry=10 * scale,
        fillColor=BRAND_ORANGE, strokeColor=None,
    ))
    d.add(String(
        mark / 2, mark * 0.38, "BW",
        fontSize=17 * scale,
        fillColor=colors.white,
        textAnchor="middle",
        fontName="Helvetica-Bold",
    ))
    d.add(String(
        mark + 12 * scale, mark * 0.62, "BuildWise",
        fontSize=18 * scale,
        fillColor=BRAND_DARK,
        fontName="Helvetica-Bold",
    ))
    d.add(String(
        mark + 12 * scale, mark * 0.22, "Project Control Suite",
        fontSize=8.5 * scale,
        fillColor=BRAND_SLATE,
        fontName="Helvetica",
    ))
    return d


def draw_page_header(canvas, width, height, doc_title, doc_subtitle):
    """Logo top-left; document title aligned right."""
    logo = build_logo_drawing(scale=1.0)
    renderPDF.draw(logo, canvas, MARGIN_X, height - HEADER_TOP - LOGO_SIZE)

    canvas.setFillColor(BRAND_DARK)
    canvas.setFont("Helvetica-Bold", 22)
    canvas.drawRightString(width - MARGIN_X, height - 58, doc_title)

    canvas.setFillColor(BRAND_SLATE)
    canvas.setFont("Helvetica", 11)
    canvas.drawRightString(width - MARGIN_X, height - 78, doc_subtitle)

    canvas.setStrokeColor(BRAND_ORANGE)
    canvas.setLineWidth(2.5)
    canvas.line(MARGIN_X, height - 98, width - MARGIN_X, height - 98)

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_X, height - 102, width - MARGIN_X, height - 102)


def draw_section_title(canvas, y, title):
    canvas.setFillColor(BRAND_DARK)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(MARGIN_X, y, title)


def draw_detail_rows(canvas, width, start_y, fields, row_height=30):
    """Styled label/value rows with alternating backgrounds."""
    label_x = MARGIN_X + 12
    value_x = MARGIN_X + 175
    table_width = width - (MARGIN_X * 2)

    for i, (label, value) in enumerate(fields):
        y_top = start_y - (i * row_height)
        y_bottom = y_top - row_height

        if i % 2 == 0:
            canvas.setFillColor(ROW_ALT)
            canvas.roundRect(
                MARGIN_X, y_bottom + 2,
                table_width, row_height - 2,
                4, fill=1, stroke=0,
            )

        canvas.setFillColor(BRAND_SLATE)
        canvas.setFont("Helvetica-Bold", 10.5)
        canvas.drawString(label_x, y_bottom + 11, label)

        canvas.setFillColor(BRAND_DARK)
        canvas.setFont("Helvetica", 11)
        canvas.drawString(value_x, y_bottom + 11, str(value)[:72])

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(1)
    canvas.roundRect(
        MARGIN_X, start_y - (len(fields) * row_height) + 2,
        table_width, len(fields) * row_height,
        6, fill=0, stroke=1,
    )


def draw_page_footer(canvas, width, footer_text):
    canvas.setFillColor(BRAND_ORANGE_LIGHT)
    canvas.rect(0, 0, width, 36, fill=1, stroke=0)

    canvas.setStrokeColor(BRAND_ORANGE)
    canvas.setLineWidth(2)
    canvas.line(0, 36, width, 36)

    canvas.setFillColor(BRAND_SLATE)
    canvas.setFont("Helvetica-Oblique", 9)
    canvas.drawCentredString(width / 2, 14, footer_text)

    canvas.setFillColor(BRAND_DARK)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(width - MARGIN_X, 14, "www.buildwise.com")
