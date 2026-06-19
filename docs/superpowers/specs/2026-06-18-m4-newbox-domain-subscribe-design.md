# Milestone 4 — newbox host + custom domain + inline subscribe (Design)

**Date:** 2026-06-18
**Status:** Approved (brainstorm) → spec for review
**Depends on:** M3 (the feed + updates log the email layer consumes). Domain `overduetracker.org` (registering).

## Goal

Put Overdue on its own domain, served from newbox behind Cloudflare/AOP, with an **inline** email subscribe (no redirect) that proxies to Buttondown. Two phases, each independently shippable:

- **Phase A — Hosting & domain:** site live at `https://overduetracker.org`, deployed by CI rsync to newbox.
- **Phase B — Inline subscribe:** a small box service proxies signups to Buttondown; the page shows inline status.

## Decisions (from brainstorm)

1. **Deploy = GitHub Action → rsync over SSH.** CI builds `dist/` and rsyncs it to newbox; Caddy serves static files. The box runs no build toolchain. Needs one dedicated SSH **deploy key** (private key as a GH secret).
2. **Host = newbox + Caddy**, behind the existing Cloudflare proxy + Authenticated Origin Pulls + ufw lockdown. The new vhost inherits that hardening.
3. **Subscribe = a small Node service on the box**, behind Caddy `reverse_proxy /api/subscribe`, holding the Buttondown API key in a **root-only env file**. Frontend `fetch('/api/subscribe')` is **same-origin** → no CORS, no redirect, inline status.
4. **Cutover = `overduetracker.org` canonical**; keep the GitHub Pages build as a backup (env-driven base).

## Architecture

```
push main ─► GH Action: npm build (SITE=overduetracker.org, base=/) 
            └─ rsync dist/ ──ssh deploy key──► newbox:/var/www/overdue
                                                   │
  Cloudflare (overduetracker.org, proxied, AOP) ──► Caddy vhost
                                                   ├─ file_server  (static site)
                                                   └─ /api/subscribe ─► localhost:8788 (Node svc) ─► Buttondown API
browser: subscribe form ──fetch POST /api/subscribe──► inline "✓ check your inbox"
/feed.xml ──► Buttondown RSS→email (Buttondown polls the feed)
```

---

## Phase A — Hosting & domain

### A1. Astro config — env-driven base/site (`astro.config.mjs`, modify)

Apex domain has **no base path**, so internal links must switch from `/overdue-ai/...` to `/...`. The M3 base-aware helpers (`joinUrl`/`absUrl`/`withBase`) already handle an empty base, so this is a config change, not a code rewrite.

```js
const onPages = process.env.PAGES === '1';
export default defineConfig({
  output: 'static',
  site: onPages ? 'https://kayadibi1.github.io' : 'https://overduetracker.org',
  base: onPages ? '/overdue-ai' : '/',
});
```

Add `<link rel="canonical">` per page pointing at the `overduetracker.org` URL (via `absUrl`), so the Pages backup never competes in search.

### A2. Newbox deploy workflow (`.github/workflows/deploy-newbox.yml`, create)

`on: push: { branches: [main], paths-ignore: ['.watcher/**','docs/**','**.md'] }` + `workflow_dispatch`. Steps: checkout → setup-node 22 → `npm ci` → `npm test` → `npm run build` (default env → apex) → add the deploy key from `secrets.NEWBOX_DEPLOY_KEY` to ssh-agent + `secrets.NEWBOX_KNOWN_HOSTS` → `rsync -az --delete dist/ deploy@newbox:/var/www/overdue/`. `concurrency: deploy-newbox`.

The existing `deploy.yml` (Pages) stays as the backup, building with `env: PAGES: '1'`.

### A3. Manual runbook (user — box + Cloudflare; documented in `docs/runbooks/m4-hosting.md`)

1. **DNS:** Cloudflare → `overduetracker.org` A record → `37.27.242.32`, **proxied**.
2. **Origin cert / AOP:** ensure the CF Origin cert presented by newbox covers `overduetracker.org` (add to the SAN list or issue a new origin cert); confirm AOP + the ufw CF-only rules apply to the new vhost.
3. **Deploy key:** `ssh-keygen` a dedicated keypair; add the **public** key to `deploy@newbox` `authorized_keys` (ideally `command=`-restricted to rsync); put the **private** key in GH secret `NEWBOX_DEPLOY_KEY`, and `NEWBOX_KNOWN_HOSTS` from `ssh-keyscan`.
4. **Caddy vhost** (manual — CI never touches Caddy):
   ```
   overduetracker.org {
     root * /var/www/overdue
     file_server
     handle /api/subscribe* { reverse_proxy localhost:8788 }
     # behind Cloudflare: AOP client-cert verification as on the other vhosts
   }
   ```
5. Create `/var/www/overdue`, owned by `deploy`.

**Phase A done when:** `https://overduetracker.org` serves the current site through Cloudflare/AOP, and a push redeploys it.

---

## Phase B — Inline subscribe

### B1. Subscribe service (`server/subscribe/`, create)

A small Node HTTP service (the box gets Node installed — one dependency; flagged below). Pure, testable logic separated from I/O:

- `normalizeEmail(raw): string | null` — trim/lowercase; return null if not a plausible email (basic RFC-ish check); reject > 254 chars.
- `mapButtondownResponse(status, bodyJson): { status: 'subscribed'|'already'|'invalid'|'error', code }` — map Buttondown's API responses (201 created; 400 already-subscribed/invalid; others → error).
- `handler(req)` — POST only, JSON `{ email }`, body-size cap (e.g. 4 KB), calls the Buttondown subscribers API (`POST .../v1/subscribers` — implementer verifies the current base host: `api.buttondown.email` vs `api.buttondown.com`) with `Authorization: Token ${BUTTONDOWN_API_KEY}` (from env), returns JSON. No secret ever reaches the client.

Vitest unit tests for `normalizeEmail` + `mapButtondownResponse` (no network).

### B2. Subscribe frontend (`src/components/Subscribe.astro` + `src/scripts/subscribe.ts`, create)

Progressive-enhancement form (the site already ships a client island, so first-party JS is in-pattern):

- `<form action="/api/subscribe" method="post">` with an `<input type="email" required>` and a status `<span aria-live="polite">`.
- `subscribe.ts` intercepts submit → `fetch('/api/subscribe', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({email})})` → renders inline status from the JSON (`✓ check your inbox` / `already subscribed` / `enter a valid email` / `something went wrong`). No navigation. Same-origin → no CORS.
- Placed in the footer, on `/updates`, and in the homepage **Follow** block (replacing the "email coming soon" note from M3).

### B3. Manual runbook (user — box + Buttondown; `docs/runbooks/m4-subscribe.md`)

1. **Buttondown:** create the account; copy the API key into a **root-only** env file on the box (e.g. `/etc/overdue-subscribe.env`, `chmod 600`); enable **RSS-to-email** pointed at `https://overduetracker.org/feed.xml`.
2. **Node on box:** install Node 22 (one apt/nvm step).
3. **systemd** unit `overdue-subscribe.service` running the service on `localhost:8788` with `EnvironmentFile=/etc/overdue-subscribe.env`; enable + start. (`docs/runbooks` includes the unit file.)
4. Reload Caddy (the `/api/subscribe` route from Phase A).

**Phase B done when:** submitting the form on `overduetracker.org` adds the address in Buttondown and shows inline success without navigating; a new updates-log entry → feed → Buttondown email.

---

## Security

- **Buttondown API key** lives only in the box env file (root-only), reached server-side; never in the repo or client. The page only ever talks to same-origin `/api/subscribe`.
- **Deploy key** is dedicated, ideally `command=`-restricted; private key only in GH secrets.
- **Origin** stays locked to Cloudflare (AOP + ufw); the new vhost inherits it. CF WAF/rate-limit already front the origin — add a light in-service guard on `/api/subscribe` (per-IP cap) only if needed.
- Subscribe input is validated/normalized and body-size capped; service accepts POST + JSON only.

## Testing

- Vitest: `normalizeEmail` (valid/invalid/oversize/normalization) and `mapButtondownResponse` (created/already/invalid/error). No network.
- `npm run build` green for both apex and `PAGES=1` (link/base correctness).
- Manual E2E: deploy → site on domain (Phase A); subscribe → inline ✓ + appears in Buttondown (Phase B).

## File structure

**Create:** `.github/workflows/deploy-newbox.yml` · `server/subscribe/{index.mjs,subscribe.mjs,package.json}` · `tests/subscribe.test.ts` · `src/components/Subscribe.astro` · `src/scripts/subscribe.ts` · `docs/runbooks/m4-hosting.md` · `docs/runbooks/m4-subscribe.md`
**Modify:** `astro.config.mjs` (env base/site) · `deploy.yml` (PAGES=1) · pages `<head>` (canonical) · `index.astro`/`updates.astro`/footer (Subscribe block) · `CHANGELOG.md` (M4 entry, in the same commit) · `README.md`

## Execution — who does what

Most of these I can execute directly; the runbooks double as the written record of exactly what was applied.

- **Cloudflare (I drive via the logged-in browser):** add the `overduetracker.org` DNS A record → `37.27.242.32` (proxied), set SSL/TLS mode to Full (strict), enable **Authenticated Origin Pulls** for the zone, and issue an **Origin Certificate** covering the host. Optionally mirror the hireme WAF/rate-limit rules.
- **Box / newbox (I apply over `ssh newbox`):** install the deploy public key in `authorized_keys`, install Node, drop the systemd unit + root-only env file, create `/var/www/overdue`. **The Caddy vhost change requires your explicit OK each time** — the box also serves `sidaraslanoglu.com` + `emersus.ai`, so I'll `caddy validate` and do a careful reload, but you sign off before it's applied.
- **GitHub (I do):** add the `NEWBOX_DEPLOY_KEY` + `NEWBOX_KNOWN_HOSTS` secrets.
- **You (identity/billing):** create the **Buttondown** account (I can drive the browser through setup with you, but it's tied to your email + billing). You may prefer to install the Origin cert's private key on the box yourself rather than hand it to me.

Go-live order: build the repo side first (this gauntlet), *then* execute the above end-to-end so DNS only flips once the box is actually serving.

## Risks / tradeoffs

- **Box becomes a dependency** for the tracker (vs zero-maintenance Pages). Mitigation: Pages backup stays building; the box only adds a tiny static vhost + one small service.
- **New runtime on the box** (Node for the subscribe service) — one more thing to patch. Alternative considered: a Cloudflare Worker for `/api/subscribe` (no box runtime) — rejected because you chose box-hosted; revisitable if box upkeep grates.
- **Base-path switch** (`/overdue-ai` → `/`) could break links if mis-set. Mitigation: env-driven, and the M3 base-aware helpers + a build check cover it.
- **Secrets footprint grows** (deploy key + Buttondown key). Both are scoped and server-side.
