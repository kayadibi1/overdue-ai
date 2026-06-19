# M4 Runbook — Hosting & domain go-live

Bring `overduetracker.org` live on newbox, behind Cloudflare/AOP, deployed by the `deploy-newbox.yml` Action. Do these in order. (Claude can drive the Cloudflare + box steps; the **Caddy edit needs explicit sign-off** since the box also serves `sidaraslanoglu.com` + `emersus.ai`.)

## 1. Cloudflare (dashboard / browser)
- The zone `overduetracker.org` already exists (registered via Cloudflare Registrar).
- **DNS:** add `A  overduetracker.org → 37.27.242.32`, **Proxied** (orange cloud). (Add `www` CNAME → apex if desired.)
- **SSL/TLS:** mode **Full (strict)**.
- **Authenticated Origin Pulls:** enable for the zone (matches the other vhosts).
- **Origin Certificate:** issue one covering `overduetracker.org` (and `*.overduetracker.org`); save the cert + key for the box.

## 2. Box — `ssh newbox` (root@37.27.242.32)
- Create the deploy user + web root:
  ```bash
  useradd -m -s /bin/bash deploy 2>/dev/null || true
  mkdir -p /var/www/overdue && chown -R deploy:deploy /var/www/overdue
  ```
- Install the deploy **public** key into `/home/deploy/.ssh/authorized_keys` (ideally `command="rsync --server -logDtprze.iLsfxC . /var/www/overdue/",no-pty,no-port-forwarding` restricted).
- Install the Origin cert + key (e.g. `/etc/ssl/overduetracker/origin.pem` / `.key`).
- **Caddy vhost** (apply only with sign-off — `caddy validate` then `systemctl reload caddy`):
  ```
  overduetracker.org {
    root * /var/www/overdue
    file_server
    handle /api/subscribe* { reverse_proxy 127.0.0.1:8788 }
    # TLS + Authenticated Origin Pulls: MIRROR the working block from the
    # existing sidaraslanoglu.com / emersus.ai vhost rather than this comment.
  }
  ```
  **Mirror the existing `tls`/AOP directive from another vhost** (Caddy versions differ); `caddy validate --config /etc/caddy/Caddyfile` before reload.

## 3. GitHub secrets (repo `kayadibi1/overdue-ai`)
- `NEWBOX_DEPLOY_KEY` — the deploy **private** key.
- `NEWBOX_KNOWN_HOSTS` — output of `ssh-keyscan 37.27.242.32`.

## 4. Verify
- `workflow_dispatch` the **Deploy to newbox** Action (or push a code change). It builds + rsyncs `dist/` → `/var/www/overdue/`.
- `https://overduetracker.org` serves the site over Cloudflare/AOP; internal links resolve at the apex; `/feed.xml` shows `overduetracker.org` URLs.
- GitHub Pages (`kayadibi1.github.io/overdue-ai`) still builds as the backup; its canonical points at the apex.
