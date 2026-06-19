# M4 Runbook — Inline subscribe go-live

> **⚠️ SUPERSEDED — historical only.** Overdue runs its **own** Python double-opt-in email
> service (Resend SMTP), not Buttondown. Use **[`m5-email.md`](./m5-email.md)** for the live
> setup. This file is kept only as a record of the original Buttondown plan; do not follow it.

Stand up the subscribe proxy on newbox so the on-site form adds subscribers to Buttondown with inline status. Do Phase A (hosting) first.

## 1. Buttondown (you — ties to your email + billing)
- Create the account at buttondown.com.
- Copy the API key into a root-only env file on the box:
  ```bash
  printf 'BUTTONDOWN_API_KEY=%s\n' '<key>' > /etc/overdue-subscribe.env
  chmod 600 /etc/overdue-subscribe.env
  ```
- Enable **RSS-to-email** pointed at `https://overduetracker.org/feed.xml` (so each new updates-log entry emails subscribers).

## 2. Box — deploy the service (`ssh newbox`)
- Install Node 22 (e.g. via NodeSource or nvm); confirm `node -v`.
- Deploy the service to a fixed path:
  ```bash
  mkdir -p /opt/overdue-subscribe
  # from your Mac checkout:
  rsync -az server/subscribe/ root@37.27.242.32:/opt/overdue-subscribe/
  ```
  (Re-run this rsync whenever `server/subscribe/` changes, then `systemctl restart overdue-subscribe`.)
- systemd unit `/etc/systemd/system/overdue-subscribe.service` (`ExecStart` matches `/opt/overdue-subscribe/index.mjs`):
  ```ini
  [Unit]
  Description=Overdue subscribe proxy
  After=network.target
  [Service]
  EnvironmentFile=/etc/overdue-subscribe.env
  Environment=PORT=8788
  ExecStart=/usr/bin/node /opt/overdue-subscribe/index.mjs
  User=www-data
  Restart=on-failure
  [Install]
  WantedBy=multi-user.target
  ```
- Enable + start, then reload Caddy (the `/api/subscribe` route from the hosting runbook):
  ```bash
  systemctl daemon-reload && systemctl enable --now overdue-subscribe
  systemctl status overdue-subscribe   # should be active; fails fast if the API key is missing
  systemctl reload caddy
  ```

## 3. Verify
- `curl -fsS -XPOST https://overduetracker.org/api/subscribe -H 'content-type: application/json' -d '{"email":"you+test@example.com"}'` → `{"status":"subscribed"}` (or `already`).
- Submit the form on the live site → inline “✓ check your inbox”, no navigation.
- The address appears in Buttondown; a new `updates.ts` entry → feed → Buttondown email.
