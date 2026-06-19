"""Email delivery transport for Overdue's subscription mail.

Transport is pluggable and **never blocks the run**:
  - if SMTP_HOST/SMTP_USER/SMTP_PASS are all set and there's a real recipient ->
    send via SMTP+STARTTLS (Resend: smtp.resend.com, user 'resend', pass = key);
  - otherwise (or on send failure) -> dry-run: write the full RFC822 message to
    out/email/<slug>.eml so it is inspectable and testable without creds.
Stdlib only (email, smtplib).

Ported verbatim (transport-only) from dc-frontier-events/notify.py.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage


def deliver(msg: EmailMessage, out_dir: str, slug: str) -> tuple[str, str]:
    """Return (mode, target): ("sent", recipient) or ("dry-run", eml_path).
    `slug` names the dry-run .eml. SMTP send goes to msg["To"] (the actual
    recipient), enabling per-recipient transactional mail."""
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    pw = os.environ.get("SMTP_PASS")
    to = msg.get("To")
    # Send when SMTP is configured and there's a real recipient.
    real_to = bool(to) and not str(to).endswith("@localhost")
    if host and user and pw and real_to:
        try:
            port = int(os.environ.get("SMTP_PORT", "587"))
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls()
                s.login(user, pw)
                s.send_message(msg)
            return ("sent", to)
        except Exception as e:  # never block the run on a send failure
            print(f"[notify] SMTP send failed ({e!r}); falling back to dry-run.")

    email_dir = os.path.join(out_dir, "email")
    os.makedirs(email_dir, exist_ok=True)
    path = os.path.join(email_dir, f"{slug}.eml")
    with open(path, "wb") as f:
        f.write(msg.as_bytes())
    return ("dry-run", path)
