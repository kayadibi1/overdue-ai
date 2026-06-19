import email
from email import policy

from emailer import (
    build_message,
    deliver_message,
    render_update,
    render_verify,
    render_welcome,
)


def test_render_verify_returns_subject_text_html():
    subject, text, html = render_verify("a@b.co", "https://x/api/verify?token=tok")
    assert subject and text and html
    assert "https://x/api/verify?token=tok" in text
    assert "https://x/api/verify?token=tok" in html


def test_render_welcome_returns_subject_text_html_with_unsub():
    unsub = "https://x/api/unsubscribe?token=u"
    subject, text, html = render_welcome("a@b.co", unsub)
    assert subject and text and html
    assert unsub in text and unsub in html


def test_render_update_contains_title_and_unsubscribe_url():
    update = {
        "id": "2026-06-18-launch",
        "date": "2026-06-18",
        "title": "Overdue launches",
        "body": "A tracker of the public safety commitments frontier AI labs made.",
    }
    unsub = "https://x/api/unsubscribe?token=u"
    subject, text, html = render_update(update, unsub)
    assert "Overdue launches" in subject or "Overdue launches" in html
    assert "Overdue launches" in text and "Overdue launches" in html
    assert unsub in text and unsub in html


def test_build_message_sets_list_unsubscribe_reply_to_and_from(monkeypatch):
    monkeypatch.setenv("SMTP_FROM", "Overdue <updates@mail.overduetracker.org>")
    monkeypatch.setenv("SMTP_REPLY_TO", "hello@overduetracker.org")
    unsub = "https://x/api/unsubscribe?token=u"
    msg = build_message("a@b.co", "Subject here", "plain", "<p>html</p>",
                        list_unsubscribe=unsub)
    assert msg["List-Unsubscribe"] == f"<{unsub}>"
    assert msg["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert msg["Reply-To"] == "hello@overduetracker.org"
    assert msg["From"] == "Overdue <updates@mail.overduetracker.org>"
    assert "<" in msg["From"]                       # has a display name
    assert msg["To"] == "a@b.co"
    assert msg["Message-ID"] and msg["Date"]


def test_build_message_from_gets_display_name_when_bare(monkeypatch):
    monkeypatch.setenv("SMTP_FROM", "updates@mail.overduetracker.org")
    msg = build_message("a@b.co", "S", "t", "<p>h</p>")
    assert "<updates@mail.overduetracker.org>" in msg["From"]


def test_no_reply_to_or_list_unsub_when_unset(monkeypatch):
    monkeypatch.delenv("SMTP_REPLY_TO", raising=False)
    msg = build_message("a@b.co", "S", "t", "<p>h</p>")   # no list_unsubscribe
    assert msg["Reply-To"] is None
    assert msg["List-Unsubscribe"] is None
    assert msg["List-Unsubscribe-Post"] is None


def test_deliver_message_dryrun_writes_eml_and_sends_nothing(tmp_path, monkeypatch):
    for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS"):
        monkeypatch.delenv(k, raising=False)
    out = str(tmp_path / "out")
    unsub = "https://x/api/unsubscribe?token=u"
    mode, target = deliver_message("a@b.co", "Subject", "plain body",
                                   "<p>html body</p>", out_dir=out,
                                   slug="welcome-abc", list_unsubscribe=unsub)
    assert mode == "dry-run"
    eml_path = tmp_path / "out" / "email" / "welcome-abc.eml"
    assert eml_path.exists()
    parsed = email.message_from_bytes(eml_path.read_bytes(), policy=policy.default)
    assert parsed["To"] == "a@b.co"
    assert parsed["List-Unsubscribe"] == f"<{unsub}>"
    html = parsed.get_body(preferencelist=("html",)).get_content()
    assert "html body" in html
    text = parsed.get_body(preferencelist=("plain",)).get_content()
    assert "plain body" in text
