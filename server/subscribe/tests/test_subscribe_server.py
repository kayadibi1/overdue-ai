import json

from subscribe_server import Deps, RateLimiter, route
from subscribers import SubscriberStore


def _deps(tmp_path):
    """Real subscriber store + recording fake send callbacks."""
    sent = {"verify": [], "welcome": []}
    store = SubscriberStore(str(tmp_path / "subs.db"))
    deps = Deps(
        store=store,
        send_verify=lambda email, token: sent["verify"].append((email, token)),
        send_welcome=lambda email, tok: sent["welcome"].append((email, tok)),
        rate=RateLimiter(max_hits=100, window_s=3600),
    )
    return deps, sent


def _json(resp):
    return json.loads(resp.body if isinstance(resp.body, str) else resp.body.decode("utf-8"))


# -- /api/subscribe (JSON) ----------------------------------------------------

def test_subscribe_sends_verify_and_returns_subscribed(tmp_path):
    deps, sent = _deps(tmp_path)
    r = route("POST", "/api/subscribe", {}, {"email": "a@b.co"}, "1.1.1.1", deps, 1000.0)
    assert r.status == 200
    assert _json(r) == {"status": "subscribed"}
    assert len(sent["verify"]) == 1 and sent["verify"][0][0] == "a@b.co"
    deps.store.close()


def test_subscribe_invalid_email_no_send(tmp_path):
    deps, sent = _deps(tmp_path)
    r = route("POST", "/api/subscribe", {}, {"email": "garbage"}, "1.1.1.1", deps, 1000.0)
    assert _json(r) == {"status": "invalid"}
    assert sent["verify"] == []
    deps.store.close()


def test_subscribe_honeypot_silently_succeeds_without_sending(tmp_path):
    deps, sent = _deps(tmp_path)
    form = {"email": "bot@b.co", "website": "http://spam"}   # honeypot filled
    r = route("POST", "/api/subscribe", {}, form, "1.1.1.1", deps, 1000.0)
    assert _json(r) == {"status": "subscribed"}              # indistinguishable
    assert sent["verify"] == []                              # nothing actually done
    assert deps.store.count() == 0
    deps.store.close()


def test_subscribe_already_verified_is_enumeration_safe(tmp_path):
    deps, sent = _deps(tmp_path)
    deps.store.verify(deps.store.subscribe("a@b.co").token)  # already verified
    sent["verify"].clear()
    r_existing = route("POST", "/api/subscribe", {}, {"email": "a@b.co"}, "1.1.1.1", deps, 1000.0)
    r_new = route("POST", "/api/subscribe", {}, {"email": "new@b.co"}, "1.1.1.1", deps, 1000.0)
    assert _json(r_existing) == _json(r_new) == {"status": "subscribed"}  # indistinguishable
    # only the brand-new email actually triggered a verify send (no leak that a@b.co exists)
    assert sent["verify"] == [("new@b.co", sent["verify"][-1][1])]
    deps.store.close()


def test_subscribe_rate_limit_blocks_after_max(tmp_path):
    deps, sent = _deps(tmp_path)
    deps.rate.max_hits = 3
    for _ in range(3):
        assert route("POST", "/api/subscribe", {}, {"email": "a@b.co"}, "9.9.9.9", deps, 5.0).status != 429
    blocked = route("POST", "/api/subscribe", {}, {"email": "a@b.co"}, "9.9.9.9", deps, 5.0)
    assert blocked.status == 429
    # a different IP is unaffected
    assert route("POST", "/api/subscribe", {}, {"email": "a@b.co"}, "8.8.8.8", deps, 5.0).status != 429
    deps.store.close()


# -- /api/verify (HTML form pages, POST mutates) ------------------------------

def test_verify_get_is_a_form_with_no_side_effects(tmp_path):
    # A bare GET (mail scanner / prefetch) must NOT confirm; it only shows a form.
    deps, sent = _deps(tmp_path)
    token = deps.store.subscribe("a@b.co").token
    r = route("GET", "/api/verify", {"token": token}, {}, "1.1.1.1", deps, 1000.0)
    assert r.status == 200
    assert "<form" in r.body.lower() and 'method="post"' in r.body.lower()
    assert token in r.body                                    # token carried in form
    assert sent["welcome"] == []                              # nothing happened
    assert deps.store.status_of("a@b.co") == "pending"
    deps.store.close()


def test_verify_post_confirms_and_sends_welcome(tmp_path):
    deps, sent = _deps(tmp_path)
    token = deps.store.subscribe("a@b.co").token
    r = route("POST", "/api/verify", {"token": token}, {}, "1.1.1.1", deps, 1000.0)
    assert r.status == 200 and "subscribed" in r.body.lower()
    assert len(sent["welcome"]) == 1 and sent["welcome"][0][0] == "a@b.co"
    assert deps.store.status_of("a@b.co") == "verified"
    deps.store.close()


def test_verify_post_twice_sends_welcome_once(tmp_path):
    deps, sent = _deps(tmp_path)
    token = deps.store.subscribe("a@b.co").token
    route("POST", "/api/verify", {"token": token}, {}, "1.1.1.1", deps, 1000.0)
    r2 = route("POST", "/api/verify", {"token": token}, {}, "1.1.1.1", deps, 1000.0)
    assert "already confirmed" in r2.body.lower()
    assert len(sent["welcome"]) == 1            # not re-sent
    deps.store.close()


def test_verify_post_bad_token(tmp_path):
    deps, sent = _deps(tmp_path)
    r = route("POST", "/api/verify", {"token": "nope"}, {}, "1.1.1.1", deps, 1000.0)
    assert r.status == 400 and "didn" in r.body.lower()
    assert sent["welcome"] == []
    deps.store.close()


# -- /api/unsubscribe (HTML form pages, POST mutates) -------------------------

def test_unsubscribe_get_is_a_form_with_no_side_effects(tmp_path):
    deps, sent = _deps(tmp_path)
    v = deps.store.verify(deps.store.subscribe("a@b.co").token)
    r = route("GET", "/api/unsubscribe", {"token": v.unsub_token}, {}, "1.1.1.1", deps, 1000.0)
    assert r.status == 200 and "<form" in r.body.lower()
    assert deps.store.status_of("a@b.co") == "verified"       # GET did NOT unsubscribe
    deps.store.close()


def test_unsubscribe_post_idempotent_page(tmp_path):
    deps, sent = _deps(tmp_path)
    v = deps.store.verify(deps.store.subscribe("a@b.co").token)
    r = route("POST", "/api/unsubscribe", {"token": v.unsub_token}, {}, "1.1.1.1", deps, 1000.0)
    assert r.status == 200 and "unsubscribed" in r.body.lower()
    assert deps.store.status_of("a@b.co") == "unsubscribed"
    # unknown token still shows the same confirmation (no info leak)
    r2 = route("POST", "/api/unsubscribe", {"token": "nope"}, {}, "1.1.1.1", deps, 1000.0)
    assert r2.status == 200 and "unsubscribed" in r2.body.lower()
    deps.store.close()


# -- misc ---------------------------------------------------------------------

def test_unknown_path_404(tmp_path):
    deps, sent = _deps(tmp_path)
    assert route("GET", "/api/wat", {}, {}, "1.1.1.1", deps, 1000.0).status == 404
    # wrong method on a real path
    assert route("GET", "/api/subscribe", {}, {}, "1.1.1.1", deps, 1000.0).status == 404
    deps.store.close()
