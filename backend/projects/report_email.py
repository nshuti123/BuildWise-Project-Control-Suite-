"""Shared helpers for emailing BuildWise reports with optional custom attachments."""

from django.conf import settings
from django.core.mail import EmailMessage


CUSTOM_ATTACHMENT_HELP = (
    "You can attach your own supporting files (contracts, drawings, photos, etc.) "
    "using the \"Add custom attachments\" section when sending a report by email. "
    "Those files are delivered together with the generated BuildWise report PDF."
)


def send_report_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    report_bytes: bytes | None = None,
    report_filename: str | None = None,
    report_mimetype: str = 'application/pdf',
    extra_attachments=None,
    from_email=None,
) -> None:
    """Send email with optional generated report + user-supplied attachments."""
    from_email = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
    email = EmailMessage(subject, body, from_email, [to_email])

    if report_bytes and report_filename:
        email.attach(report_filename, report_bytes, report_mimetype)

    if extra_attachments:
        for uploaded in extra_attachments:
            content = uploaded.read()
            email.attach(
                uploaded.name,
                content,
                getattr(uploaded, 'content_type', None) or 'application/octet-stream',
            )

    email.send(fail_silently=False)


def build_report_email_body(
    *,
    exporter_name: str,
    report_label: str,
    project_name: str | None = None,
    custom_message: str = '',
    verify_url: str | None = None,
    include_attachment_help: bool = True,
) -> str:
    project_part = f' for "{project_name}"' if project_name else ''
    body = (
        f"Hello,\n\n"
        f"{exporter_name} shared the {report_label}{project_part} from BuildWise.\n\n"
    )
    if custom_message:
        body += f"{custom_message.strip()}\n\n"
    if include_attachment_help:
        body += f"Note: {CUSTOM_ATTACHMENT_HELP}\n\n"
    if verify_url:
        body += (
            f"You can verify the attached BuildWise report by scanning the QR code on the PDF "
            f"or visiting:\n{verify_url}\n\n"
        )
    body += "Regards,\nBuildWise Project Control Suite"
    return body
