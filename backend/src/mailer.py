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


def _event_notification_html(event: dict) -> str:
    """Render the EventCard as email-safe HTML (without its iframe/actions)."""
    title = str(event.get("title", event.get("name", "Campus update")))
    tag = str(event.get("tag", ""))
    tag_labels = {
        "free food": "Free food",
        "free merch": "Free merch",
        "discounts": "Discounts",
        "career development": "Career development",
    }
    description = str(event.get("description", ""))
    lat = event.get("latitude", event.get("lat", ""))
    lon = event.get("longitude", event.get("lon", ""))
    location = f"{lat}, {lon}"
    maps_url = f"https://www.google.com/maps?q={escape(str(lat), quote=True)},{escape(str(lon), quote=True)}"
    confirmed = bool(event.get("confirmed", True))

    def metadata(label: str, value: str) -> str:
        return f'<span style="display:inline-block;margin:0 8px 5px 0;color:#718097;font-size:12px;">{escape(label)} {escape(value)}</span>'

    meta = metadata("Posted", str(event["created_at"])) if event.get("created_at") else ""
    if event.get("expires_at"):
        meta += metadata("Ends", str(event["expires_at"]))

    return f"""
<div style="width:100%;box-sizing:border-box;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#203047;">
  <div style="max-width:560px;margin:0 auto;padding:24px;background:#fff;border:1px solid #d9e2f0;border-radius:16px;box-shadow:0 10px 30px rgba(36,61,100,.09);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <span style="color:#32a879;font-size:11px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;">
        <span style="display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;background:#32a879;"></span>{'Confirmed' if confirmed else 'Needs confirmation'}
      </span>
      {f'<span style="display:inline-block;padding:6px 11px;border-radius:999px;background:#e2ebff;color:#315ba8;font-size:12px;font-weight:800;">{escape(tag_labels.get(tag, tag))}</span>' if tag else ''}
    </div>
    <h1 style="margin:0 0 10px;font-size:24px;line-height:1.35;color:#203047;">{escape(title)}</h1>
    {f'<p style="margin:0 0 16px;color:#526176;font-size:14px;line-height:1.6;white-space:pre-line;">{escape(description)}</p>' if description else ''}
    <p style="margin:0 0 9px;color:#65748a;font-size:12px;">📍 {escape(location)}</p>
    <p style="margin:12px 0 16px;"><a href="{maps_url}" style="display:inline-block;padding:10px 14px;border-radius:9px;background:#315ba8;color:#fff;font-size:13px;font-weight:700;text-decoration:none;">Open in Google Maps →</a></p>
    <div style="padding-top:13px;border-top:1px solid #dce4f0;">{meta}</div>
  </div>
</div>""".strip()


def send_event_notification_emails(recipients: list[dict], event: dict) -> None:
    """Notify users whose selected tags match a newly confirmed event."""
    if not recipients:
        return

    title = str(event.get("title", event.get("name", "Campus update")))
    tag = str(event.get("tag", ""))
    description = str(event.get("description", ""))
    lat = event.get("latitude", event.get("lat", ""))
    lon = event.get("longitude", event.get("lon", ""))
    location = f"{lat}, {lon}"
    subject = f"Confirmed ZotHacks update: {title}"
    html_event = _event_notification_html(event)
    with _smtp_connection() as conn:
        for recipient in recipients:
            email = recipient.get("email")
            if not email:
                continue
            recipient_name = str(recipient.get("name") or "Anteater")
            plain = f"Hi {recipient_name},\n\n{title} ({tag}) was confirmed near {location}.\n{description}\n\nGoogle Maps: https://www.google.com/maps?q={lat},{lon}"
            html = f'<p style="font-family:Arial,sans-serif;color:#203047;">Hi <strong>{escape(recipient_name)}</strong>,</p>{html_event}'
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
