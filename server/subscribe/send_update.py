"""Send-on-publish: mail a new updates-log entry to confirmed subscribers.

Reads a deployed updates.json (the prerendered {updates: [...]} the site emits,
rsynced to the box), picks the newest entry (or a given --id), renders the update
email, and sends it to every confirmed subscriber with their own one-click
unsubscribe link.

Idempotent: a `sent_updates(id)` table in the subscribers DB records each update id
that has been delivered, so a re-run (e.g. CI firing again) never double-sends.
--dry-run lists the recipients without sending and without marking the id sent.

Run on the box from /opt/overdue-subscribe:
    python3 -m send_update --latest --updates /var/www/overdue/updates.json
    python3 -m send_update --id 2026-06-18-launch
    python3 -m send_update --latest --dry-run
SMTP_* + SITE_ORIGIN come from /etc/overdue-subscribe.env (sourced by the caller).
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from urllib.parse import quote

from emailer import deliver_message, render_update
from subscribers import SubscriberStore

DEFAULT_UPDATES_PATH = "/var/www/overdue/updates.json"
DEFAULT_DB_PATH = "data/subscribers.db"

_SENT_DDL = """
CREATE TABLE IF NOT EXISTS sent_updates (
  id TEXT PRIMARY KEY,
  sent_at TEXT
);
"""


def load_updates(path: str) -> list[dict]:
    """Read the deployed updates.json -> the list under the "updates" key (already
    sorted newest-first by the site endpoint)."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    updates = data.get("updates", []) if isinstance(data, dict) else data
    return updates if isinstance(updates, list) else []


def pick_update(updates: list[dict], update_id: str | None = None) -> dict | None:
    """The entry to send: the one matching update_id, else the newest (first, since
    the file is emitted newest-first)."""
    if update_id:
        for u in updates:
            if str(u.get("id")) == update_id:
                return u
        return None
    return updates[0] if updates else None


def _already_sent(conn: sqlite3.Connection, update_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM sent_updates WHERE id=?", (update_id,)).fetchone()
    return row is not None


def _mark_sent(conn: sqlite3.Connection, update_id: str, now_iso: str) -> None:
    conn.execute("INSERT OR IGNORE INTO sent_updates (id, sent_at) VALUES (?,?)",
                 (update_id, now_iso))
    conn.commit()


def send_update(updates_path: str, db_path: str, out_dir: str = "out",
                update_id: str | None = None, dry_run: bool = False) -> list[str]:
    """Render the chosen update and send it to confirmed subscribers. Returns the
    list of recipient emails (those a message was prepared for). Idempotent: a
    real (non-dry-run) send records the update id so a re-run is a no-op. A dry-run
    never marks the id sent, so a later real send still goes out."""
    updates = load_updates(updates_path)
    update = pick_update(updates, update_id)
    if update is None:
        print(f"[send_update] no matching update (id={update_id!r}); nothing to do.")
        return []
    uid = str(update.get("id", ""))

    store = SubscriberStore(db_path)
    store.conn.executescript(_SENT_DDL)
    store.conn.commit()
    try:
        if not dry_run and _already_sent(store.conn, uid):
            print(f"[send_update] update {uid!r} already sent; skipping (idempotent).")
            return []

        recipients = list(store.confirmed())   # [(email, unsub_token), ...]
        base = os.environ.get("SITE_ORIGIN", "https://overduetracker.org").rstrip("/")

        sent_to: list[str] = []
        for email, unsub_token in recipients:
            unsub = f"{base}/api/unsubscribe?token={quote(unsub_token)}"
            if dry_run:
                print(f"[send_update] (dry-run) would send {uid!r} to {email}")
                sent_to.append(email)
                continue
            subject, text, html = render_update(update, unsub)
            slug = "".join(c if c.isalnum() else "-" for c in f"update-{uid}-{email}")[:60]
            deliver_message(email, subject, text, html, out_dir=out_dir,
                            slug=slug, list_unsubscribe=unsub)
            sent_to.append(email)

        if not dry_run:
            from datetime import datetime, timezone
            _mark_sent(store.conn, uid, datetime.now(timezone.utc).isoformat())
            print(f"[send_update] sent {uid!r} to {len(sent_to)} confirmed subscriber(s).")
        return sent_to
    finally:
        store.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mail an updates-log entry to confirmed subscribers.")
    parser.add_argument("--updates", default=DEFAULT_UPDATES_PATH,
                        help=f"path to the deployed updates.json (default {DEFAULT_UPDATES_PATH})")
    parser.add_argument("--db", default=DEFAULT_DB_PATH,
                        help=f"subscribers DB path (default {DEFAULT_DB_PATH})")
    parser.add_argument("--out-dir", default="out", help="dry-run .eml output dir")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--latest", action="store_true",
                       help="send the newest entry (default if no --id)")
    group.add_argument("--id", dest="update_id", default=None,
                       help="send a specific update id")
    parser.add_argument("--dry-run", action="store_true",
                        help="list recipients without sending or marking sent")
    args = parser.parse_args(argv)

    recipients = send_update(args.updates, args.db, out_dir=args.out_dir,
                             update_id=args.update_id, dry_run=args.dry_run)
    if args.dry_run:
        for r in recipients:
            print(r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
