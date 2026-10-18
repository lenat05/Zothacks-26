"""
mailer.py — Email verification via smtplib.

Usage (from api.py signup route):
    from mailer import send_verification_email
    send_verification_email(email=body.email, name=body.name)

Required environment variables:
    SMTP_HOST     e.g. smtp.gmail.com
    SMTP_PORT     e.g. 587
    SMTP_USER     sender address / login
    SMTP_PASS     app password or SMTP password
    SMTP_FROM     "From" display name + address, e.g. "ZotHacks <no-reply@uci.edu>"
    APP_BASE_URL  e.g. https://yourdomain.com  (used to build the verify link)
"""

import os
import secrets
import smtplib
from html import escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr

# tokens stored in-memory — swap for DB-backed store when persistence is needed
_pending: dict[str, str] = {}  # token -> email


def _smtp_connection() -> smtplib.SMTP:
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", 587))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]

    conn = smtplib.SMTP(host, port)
    conn.ehlo()
    conn.starttls()
    conn.login(user, password)
    return conn


def _build_email(to: str, name: str, verify_url: str) -> MIMEMultipart:
    smtp_user = os.environ["SMTP_USER"]
    display_name, sender_address = parseaddr(os.environ.get("SMTP_FROM", ""))
    if "@" not in sender_address:
        sender_address = smtp_user
    sender = formataddr((display_name or "ZotHacks", sender_address))
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your ZotHacks account"
    msg["From"] = sender
    msg["To"] = to

    plain = (
        f"Hi {name},\n\n"
        f"Click the link below to verify your email:\n{verify_url}\n\n"
        "If you didn't sign up, ignore this email."
    )
    html_name = escape(name)
    html_url = escape(verify_url, quote=True)
    html = (
        f"<p>Hi <strong>{html_name}</strong>,</p>"
        f"<p><a href='{html_url}'>Verify your email</a></p>"
        "<p>If you didn't sign up, ignore this email.</p>"
    )

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


def send_verification_email(email: str, name: str) -> str:
    """
    Generate a verification token, store it, and email the verify link.
    Returns the token (so the caller can persist it to the DB if needed).
    """
    token = secrets.token_urlsafe(32)
    _pending[token] = email

    base_url = os.environ.get("APP_BASE_URL", "http://localhost:8000")
    verify_url = f"{base_url}/api/verify-email?token={token}"

    msg = _build_email(to=email, name=name, verify_url=verify_url)
    with _smtp_connection() as conn:
        conn.sendmail(msg["From"], [email], msg.as_string())

    return token


def send_event_notification_emails(recipients: list[dict], event: dict) -> None:
    """Notify users whose selected tags match a newly confirmed event."""
    if not recipients:
        return

    title = event.get("title", event.get("name", "Campus update"))
    tag = event.get("tag", "")
    description = event.get("description", "")
    location = f"{event.get('latitude', event.get('lat', ''))}, {event.get('longitude', event.get('lon', ''))}"
    subject = f"Confirmed ZotHacks update: {title}"
    with _smtp_connection() as conn:
        for recipient in recipients:
            email = recipient.get("email")
            if not email:
                continue
            name = escape(str(recipient.get("name") or "Anteater"))
            plain = f"Hi {recipient.get('name') or 'Anteater'},\n\n{title} ({tag}) was confirmed near {location}.\n{description}"
            html = f"<p>Hi <strong>{name}</strong>,</p><p><strong>{escape(title)}</strong> ({escape(tag)}) was confirmed near {escape(location)}.</p><p>{escape(description)}</p>"
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = _sender()
            msg["To"] = email
            msg.attach(MIMEText(plain, "plain"))
            msg.attach(MIMEText(html, "html"))
            conn.sendmail(msg["From"], [email], msg.as_string())


def _sender() -> str:
    smtp_user = os.environ["SMTP_USER"]
    display_name, sender_address = parseaddr(os.environ.get("SMTP_FROM", ""))
    return formataddr((display_name or "ZotHacks", sender_address if "@" in sender_address else smtp_user))


def verify_token(token: str) -> str | None:
    """
    Consume a verification token. Returns the associated email, or None if invalid.
    Call this from the GET /api/verify-email route.
    """
    return _pending.pop(token, None)
