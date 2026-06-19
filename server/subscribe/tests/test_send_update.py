import json

from send_update import load_updates, pick_update, send_update
from subscribers import SubscriberStore


def _write_updates(path, entries):
    path.write_text(json.dumps({"updates": entries}))
    return str(path)


_ENTRIES = [
    {"id": "2026-06-18-launch", "date": "2026-06-18", "title": "Overdue launches",
     "body": "A tracker of frontier-AI safety commitments."},
    {"id": "2026-06-10-early", "date": "2026-06-10", "title": "Earlier note",
     "body": "An earlier update."},
]


def _store_with(tmp_path, verified, pending=()):
    db = str(tmp_path / "subs.db")
    s = SubscriberStore(db)
    for e in verified:
        s.verify(s.subscribe(e).token)
    for e in pending:
        s.subscribe(e)
    return s, db


def test_load_updates_and_pick_latest(tmp_path):
    path = _write_updates(tmp_path / "updates.json", _ENTRIES)
    updates = load_updates(path)
    assert pick_update(updates)["id"] == "2026-06-18-launch"    # newest (file order)


def test_pick_update_by_id(tmp_path):
    path = _write_updates(tmp_path / "updates.json", _ENTRIES)
    updates = load_updates(path)
    assert pick_update(updates, update_id="2026-06-10-early")["id"] == "2026-06-10-early"
    assert pick_update(updates, update_id="nope") is None


def test_dry_run_targets_only_verified(tmp_path):
    path = _write_updates(tmp_path / "updates.json", _ENTRIES)
    s, db = _store_with(tmp_path, verified=["a@b.co", "c@d.co"], pending=["p@e.co"])
    s.close()
    recipients = send_update(path, db, out_dir=str(tmp_path / "out"), dry_run=True)
    assert sorted(recipients) == ["a@b.co", "c@d.co"]          # pending excluded


def test_idempotent_only_sends_once_per_id(tmp_path):
    path = _write_updates(tmp_path / "updates.json", _ENTRIES)
    s, db = _store_with(tmp_path, verified=["a@b.co", "c@d.co"])
    s.close()
    first = send_update(path, db, out_dir=str(tmp_path / "out"))
    assert sorted(first) == ["a@b.co", "c@d.co"]               # sent the first time
    second = send_update(path, db, out_dir=str(tmp_path / "out"))
    assert second == []                                        # already sent -> no-op


def test_dry_run_does_not_mark_sent(tmp_path):
    path = _write_updates(tmp_path / "updates.json", _ENTRIES)
    s, db = _store_with(tmp_path, verified=["a@b.co"])
    s.close()
    send_update(path, db, out_dir=str(tmp_path / "out"), dry_run=True)
    # a real send after the dry-run still goes out (dry-run never marks idempotent)
    real = send_update(path, db, out_dir=str(tmp_path / "out"))
    assert real == ["a@b.co"]


def test_select_specific_id(tmp_path):
    path = _write_updates(tmp_path / "updates.json", _ENTRIES)
    s, db = _store_with(tmp_path, verified=["a@b.co"])
    s.close()
    recipients = send_update(path, db, out_dir=str(tmp_path / "out"),
                             update_id="2026-06-10-early")
    assert recipients == ["a@b.co"]
    # the other (latest) id is still unsent and can go out
    latest = send_update(path, db, out_dir=str(tmp_path / "out"))
    assert latest == ["a@b.co"]
