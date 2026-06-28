# M5 Runbook — Own email system go-live

Replace M4's Buttondown proxy with Overdue's own pipeline: a Python `subscribe_server` on newbox (SQLite double opt-in) sending through **Resend SMTP** from a verified subdomain. Do the M4 hosting runbook first (the box, Cloudflare/AOP, and the deploy user already exist). The **Caddy edit needs explicit sign-off** since the box also serves other production vhosts.

## 1. Resend + DNS (reuse the existing account)
- In the existing Resend account, **Add Domain** → `overduetracker.org`, using the send subdomain **`mail.overduetracker.org`** (isolates sending reputation from the apex).
- Resend emits **SPF, DKIM, and DMARC** records for that subdomain. Add them in **Cloudflare** (DNS, on the `overduetracker.org` zone) exactly as Resend shows, then click **Verify** in Resend until all three are green.
- Create/copy a **Resend API key** (this becomes `SMTP_PASS` below).

## 2. Box — env file (`ssh newbox`, root-only)
Create `/etc/overdue-subscribe.env` (chmod 600 — replaces the M4 Buttondown env):
```bash
cat > /etc/overdue-subscribe.env <<'EOF'
SMTP_HOST=smtp.resend.com
SMTP_USER=resend
SMTP_PASS=<resend API key>
SMTP_FROM=Overdue <updates@mail.overduetracker.org>
SMTP_REPLY_TO=
SITE_ORIGIN=https://overduetracker.org
EOF
chmod 600 /etc/overdue-subscribe.env
```
- `SMTP_FROM` carries the display name (`Overdue <...>`); the emailer uses it as-is.
- `SMTP_REPLY_TO` is optional — set it to a real forwarding alias if you want replies to land somewhere; leave blank to omit the `Reply-To` header.
- If `SMTP_*` is unset/blank the service degrades to **dry-run** (writes `.eml` files instead of sending), so a misconfigured key never silently drops mail — it just doesn't send.

## 3. Box — deploy the service (`ssh newbox`)
- Ensure Python 3.11+ is present: `python3 --version`.
- Deploy the package to a fixed path (no pip deps — stdlib only):
  ```bash
  mkdir -p /opt/overdue-subscribe
  # from your Mac checkout:
  rsync -az server/subscribe/ root@<newbox IP>:/opt/overdue-subscribe/
  ```
  (Re-run this rsync whenever `server/subscribe/` changes, then `systemctl restart overdue-subscribe`.) The flat layout + absolute imports mean it runs as `python3 -m subscribe_server` from `/opt/overdue-subscribe`.
- The SQLite store lives at `/opt/overdue-subscribe/data/subscribers.db` (created on first run; `data/` is auto-created). Keep it in your backups — **this is the list; no SaaS holds it.**
- systemd unit `/etc/systemd/system/overdue-subscribe.service`:
  ```ini
  [Unit]
  Description=Overdue subscribe server (SQLite double opt-in + Resend SMTP)
  After=network.target
  [Service]
  WorkingDirectory=/opt/overdue-subscribe
  EnvironmentFile=/etc/overdue-subscribe.env
  Environment=SUBSCRIBE_HOST=127.0.0.1
  Environment=SUBSCRIBE_PORT=8788
  ExecStart=/usr/bin/python3 -m subscribe_server
  User=www-data
  Restart=on-failure
  [Install]
  WantedBy=multi-user.target
  ```
- Enable + start:
  ```bash
  systemctl daemon-reload && systemctl enable --now overdue-subscribe
  systemctl status overdue-subscribe   # active; listening on 127.0.0.1:8788
  ```

## 4. Box — Caddy (apply only with sign-off)
The service answers all three API paths, so the route widens from `/api/subscribe*` (M4) to `/api/*`:
```
overduetracker.org {
  root * /var/www/overdue
  file_server
  handle /api/* { reverse_proxy 127.0.0.1:8788 }
  # TLS + Authenticated Origin Pulls + trusted_proxies (Cloudflare ranges):
  # MIRROR the working block from the existing production
  # vhost (so Cf-Connecting-Ip is trusted for the rate limiter).
}
```
`caddy validate --config /etc/caddy/Caddyfile` before `systemctl reload caddy`.

## 5. Send-on-publish
- CI (`deploy-newbox.yml`) deploys `dist/` (including `dist/updates.json`) to `/var/www/overdue/`, then — **only when the push changed `src/data/updates.ts`** — SSHes the box and runs:
  ```bash
  cd /opt/overdue-subscribe && set -a && . /etc/overdue-subscribe.env && set +a \
    && python3 -m send_update --latest --updates /var/www/overdue/updates.json
  ```
  Idempotent: a `sent_updates(id)` row in `subscribers.db` means a re-run never double-sends the same entry.
- Manual send / preview:
  ```bash
  # dry-run: list recipients, send nothing, mark nothing
  python3 -m send_update --latest --dry-run
  # a specific entry
  python3 -m send_update --id 2026-06-18-launch
  ```

## 6. Verify (lands in inbox — the whole point)
- `curl -fsS -XPOST https://overduetracker.org/api/subscribe -H 'content-type: application/json' -d '{"email":"you+test@example.com"}'` → `{"status":"subscribed"}`.
- The **verify email arrives in your inbox, not spam** (check spam if not — it means DKIM/SPF/DMARC isn't fully green in step 1). Click the link → confirm **form** → submit (POST) → "you're in" page → **welcome email** arrives.
- `GET https://overduetracker.org/api/verify?token=...` in a browser shows a form and does **not** confirm on its own (state changes are POST-only).
- Publish a new `src/data/updates.ts` entry → CI fires the send step → the confirmed list receives the update email with a one-click **Unsubscribe** (Gmail/Apple render the native control via `List-Unsubscribe`).
- Click Unsubscribe → removed from the send list; re-subscribing restarts double opt-in.
