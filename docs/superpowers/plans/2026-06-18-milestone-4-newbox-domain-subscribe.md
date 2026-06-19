# Milestone 4 — newbox host + domain + inline subscribe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the repo side of M4 — env-driven apex config, a CI rsync deploy workflow, and an inline subscribe (frontend + a small box service → Buttondown) — plus runbooks. Go-live (Cloudflare/box/Buttondown) is executed afterward, not part of this build.

**Architecture:** Astro static (env-driven `site`/`base`: apex `overduetracker.org` by default, `/overdue-ai` Pages backup under `PAGES=1`). A GitHub Action rsyncs `dist/` to newbox. A tiny Node service (`server/subscribe/`) proxies signups to Buttondown with the key server-side; the page fetches it same-origin for inline status. Pure logic is Vitest-tested; I/O glue is build/lint-checked.

**Tech Stack:** Astro 5, TypeScript, Vitest, Node 22 (built-in `http` + global `fetch`, no new deps).

**Spec:** `docs/superpowers/specs/2026-06-18-m4-newbox-domain-subscribe-design.md`

---

### Task 1: Env-driven `site`/`base`

**Files:** Modify `astro.config.mjs`

- [ ] **Step 1: Edit the config**

```js
// @ts-check
import { defineConfig } from 'astro/config';
const onPages = process.env.PAGES === '1';
export default defineConfig({
  output: 'static',
  site: onPages ? 'https://kayadibi1.github.io' : 'https://overduetracker.org',
  base: onPages ? '/overdue-ai' : '/',
});
```

- [ ] **Step 2: Verify both builds + base correctness**

Run: `npm run build` → expected: builds; `grep -o 'href="/[^"]*"' dist/index.html | head` shows root-relative (no `/overdue-ai`), and `head -c 200 dist/feed.xml` shows `https://overduetracker.org/...`.
Run: `PAGES=1 npm run build` → expected: builds; feed shows `https://kayadibi1.github.io/overdue-ai/...`.

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "feat(m4): env-driven site/base (apex default, PAGES=1 backup)"
```

---

### Task 2: Canonical links → always the apex

**Files:** Modify `src/lib/site.ts`, `src/pages/index.astro`, `src/pages/updates.astro`, `src/pages/methodology.astro`

Canonical must always point at `overduetracker.org` (even on the Pages build) so the backup never competes in search.

- [ ] **Step 1: Add the canonical origin constant** to `src/lib/site.ts`:

```ts
export const CANONICAL_ORIGIN = 'https://overduetracker.org';
```

- [ ] **Step 2: Add a canonical `<link>` to each page `<head>`**, with the page's own path:
- `index.astro`: `<link rel="canonical" href={`${CANONICAL_ORIGIN}/`} />`
- `updates.astro`: `<link rel="canonical" href={`${CANONICAL_ORIGIN}/updates`} />`
- `methodology.astro`: `<link rel="canonical" href={`${CANONICAL_ORIGIN}/methodology`} />`

Import `CANONICAL_ORIGIN` from `../lib/site` in each.

- [ ] **Step 3: Build + verify**

Run: `npm run build` → expected: each page's HTML contains `<link rel="canonical" href="https://overduetracker.org/...">`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/site.ts src/pages/index.astro src/pages/updates.astro src/pages/methodology.astro
git commit -m "feat(m4): canonical links pinned to overduetracker.org"
```

---

### Task 3: Deploy workflow (CI rsync to newbox) + Pages backup env

**Files:** Create `.github/workflows/deploy-newbox.yml`; Modify `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the newbox deploy workflow**

```yaml
name: Deploy to newbox
on:
  push: { branches: [main], paths-ignore: ['.watcher/**', 'docs/**', '**.md'] }
  workflow_dispatch:
permissions: { contents: read }
concurrency: { group: deploy-newbox, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build      # default env → apex site/base
      - name: Deploy dist/ to newbox
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "${{ secrets.NEWBOX_DEPLOY_KEY }}" > ~/.ssh/id_deploy
          chmod 600 ~/.ssh/id_deploy
          printf '%s\n' "${{ secrets.NEWBOX_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          rsync -az --delete -e "ssh -i ~/.ssh/id_deploy -o StrictHostKeyChecking=yes" dist/ deploy@37.27.242.32:/var/www/overdue/
```

- [ ] **Step 2: Make the Pages workflow build the backup base**

In `deploy.yml`, set `env: { PAGES: '1' }` on the `npm run build` step (so the Pages artifact uses `/overdue-ai`). Leave the rest as-is.

- [ ] **Step 3: Lint the YAML**

Run: `npx --yes yaml-lint .github/workflows/deploy-newbox.yml || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-newbox.yml'))"`
Expected: valid YAML.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-newbox.yml .github/workflows/deploy.yml
git commit -m "ci(m4): rsync deploy to newbox; Pages backup builds with PAGES=1"
```

---

### Task 4: Subscribe service — pure logic (TDD)

**Files:** Create `server/subscribe/subscribe.mjs`, `server/subscribe/package.json`, `tests/subscribe.test.ts`

- [ ] **Step 1: Write failing tests** (`tests/subscribe.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest';
import { normalizeEmail, mapButtondownResponse, subscribe } from '../server/subscribe/subscribe.mjs';

describe('normalizeEmail', () => {
  it('trims + lowercases valid emails', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('rejects junk, missing dot, oversize, non-strings', () => {
    expect(normalizeEmail('nope')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('x'.repeat(250) + '@y.com')).toBeNull();
    expect(normalizeEmail(42 as unknown as string)).toBeNull();
  });
});

describe('mapButtondownResponse', () => {
  it('maps created/already/invalid/error', () => {
    expect(mapButtondownResponse(201, {}).status).toBe('subscribed');
    expect(mapButtondownResponse(400, { detail: 'already subscribed' }).status).toBe('already');
    expect(mapButtondownResponse(400, { detail: 'Enter a valid email address.' }).status).toBe('invalid');
    expect(mapButtondownResponse(500, {}).status).toBe('error');
  });
});

describe('subscribe', () => {
  it('POSTs to Buttondown with the token + email and maps the result', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 201, json: async () => ({}) });
    const res = await subscribe('a@b.com', { apiKey: 'KEY', fetchFn });
    expect(res.status).toBe('subscribed');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toMatch(/\/v1\/subscribers$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Token KEY');
    expect(JSON.parse(init.body).email_address).toBe('a@b.com');
  });
});
```

- [ ] **Step 2: Run; verify fail**

Run: `npx vitest run tests/subscribe.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** (`server/subscribe/subscribe.mjs`)

```js
export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 3 || e.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export function mapButtondownResponse(httpStatus, body) {
  if (httpStatus >= 200 && httpStatus < 300) return { status: 'subscribed' };
  if (httpStatus === 400 || httpStatus === 409) {
    const t = JSON.stringify(body ?? '').toLowerCase();
    if (t.includes('already') || t.includes('exist')) return { status: 'already' };
    return { status: 'invalid' };
  }
  return { status: 'error' };
}

// NOTE: implementer verifies the current Buttondown host (api.buttondown.email vs api.buttondown.com)
// and the subscriber field name (email_address) against current docs before go-live.
export async function subscribe(email, { apiKey, fetchFn = fetch, apiBase = 'https://api.buttondown.email' }) {
  const res = await fetchFn(`${apiBase}/v1/subscribers`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email }),
  });
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return mapButtondownResponse(res.status, body);
}
```

And `server/subscribe/package.json`:
```json
{ "name": "overdue-subscribe", "private": true, "type": "module", "version": "1.0.0" }
```

- [ ] **Step 4: Run; verify pass**

Run: `npx vitest run tests/subscribe.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server/subscribe/subscribe.mjs server/subscribe/package.json tests/subscribe.test.ts
git commit -m "feat(m4): subscribe service core (normalize/map/subscribe) + tests"
```

---

### Task 5: Subscribe service — HTTP glue

**Files:** Create `server/subscribe/index.mjs`

- [ ] **Step 1: Implement the server**

```js
import { createServer } from 'node:http';
import { normalizeEmail, subscribe } from './subscribe.mjs';

const PORT = Number(process.env.PORT || 8788);
const API_KEY = process.env.BUTTONDOWN_API_KEY;
const MAX_BODY = 4096;

function send(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.startsWith('/api/subscribe')) return send(res, 404, { status: 'error' });
  let body = '';
  let aborted = false;
  req.on('data', (c) => {
    body += c;
    if (body.length > MAX_BODY) { aborted = true; send(res, 413, { status: 'error' }); req.destroy(); }
  });
  req.on('end', async () => {
    if (aborted) return;
    try {
      const email = normalizeEmail(JSON.parse(body || '{}').email);
      if (!email) return send(res, 422, { status: 'invalid' });
      if (!API_KEY) return send(res, 500, { status: 'error' });
      send(res, 200, await subscribe(email, { apiKey: API_KEY }));
    } catch {
      send(res, 400, { status: 'error' });
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`subscribe service on 127.0.0.1:${PORT}`));
```

- [ ] **Step 2: Syntax-check**

Run: `node --check server/subscribe/index.mjs` → expected: no output (valid).

- [ ] **Step 3: Commit**

```bash
git add server/subscribe/index.mjs
git commit -m "feat(m4): subscribe service HTTP glue (localhost, body cap, JSON)"
```

---

### Task 6: Subscribe frontend — status logic (TDD) + script + component

**Files:** Create `src/scripts/subscribe.ts`, `src/components/Subscribe.astro`; Modify `tests/subscribe.test.ts`

- [ ] **Step 1: Write failing test** (append to `tests/subscribe.test.ts`)

```ts
import { statusMessage } from '../src/scripts/subscribe';
describe('statusMessage', () => {
  it('maps each status to copy, with a safe default', () => {
    expect(statusMessage('subscribed')).toMatch(/check your inbox/i);
    expect(statusMessage('already')).toMatch(/already/i);
    expect(statusMessage('invalid')).toMatch(/valid email/i);
    expect(statusMessage('boom')).toMatch(/something went wrong/i);
  });
});
```

- [ ] **Step 2: Run; verify fail**

Run: `npx vitest run tests/subscribe.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/scripts/subscribe.ts`

```ts
export function statusMessage(status: string): string {
  switch (status) {
    case 'subscribed': return '✓ Thanks — check your inbox to confirm.';
    case 'already': return "You're already subscribed.";
    case 'invalid': return 'Please enter a valid email.';
    default: return 'Something went wrong — please try again.';
  }
}

// progressive enhancement: intercept submit, POST same-origin, render inline status.
// Guarded so importing this module in the (DOM-less) Vitest node env doesn't throw —
// only `statusMessage` is unit-tested; the wiring runs only in the browser.
if (typeof document !== 'undefined') {
  const form = document.querySelector<HTMLFormElement>('form[data-subscribe]');
  if (form) {
    const out = form.querySelector<HTMLElement>('[data-status]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = new FormData(form).get('email');
      if (out) out.textContent = '…';
      try {
        const r = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const j = await r.json().catch(() => ({ status: 'error' }));
        if (out) out.textContent = statusMessage(j.status);
      } catch {
        if (out) out.textContent = statusMessage('error');
      }
    });
  }
}
```

- [ ] **Step 4: Run; verify pass**

Run: `npx vitest run tests/subscribe.test.ts` → PASS.

(Note: the DOM-wiring lines below the export aren't exercised by the test; the pure `statusMessage` is. The wiring runs only in the browser.)

- [ ] **Step 5: Create the component** `src/components/Subscribe.astro`

```astro
---
import { absUrl } from '../lib/urls';
---
<form class="subscribe" data-subscribe action={absUrl('/api/subscribe')} method="post">
  <label>Get updates by email
    <input type="email" name="email" required placeholder="you@example.com" autocomplete="email" />
  </label>
  <button type="submit">Subscribe</button>
  <span class="subscribe__status" data-status aria-live="polite"></span>
</form>
<script>import '../scripts/subscribe.ts';</script>
```

- [ ] **Step 6: Commit**

```bash
git add src/scripts/subscribe.ts src/components/Subscribe.astro tests/subscribe.test.ts
git commit -m "feat(m4): inline subscribe frontend (statusMessage tested) + component"
```

---

### Task 7: Wire Subscribe into the site

**Files:** Modify `src/pages/index.astro`, `src/pages/updates.astro`

- [ ] **Step 1: Homepage** — import `Subscribe` and place it in the Follow block, replacing the "email coming soon" note:

In `index.astro` frontmatter: `import Subscribe from '../components/Subscribe.astro';`
Replace the Follow `<p>...email coming soon</p>` with: keep the All-updates/RSS links, then `<Subscribe />`.

- [ ] **Step 2: `/updates`** — import and add `<Subscribe />` near the top "Follow via RSS" link.

- [ ] **Step 3: Build + verify**

Run: `npm run build` → expected: builds; `grep -c 'data-subscribe' dist/index.html dist/updates/index.html` shows the form on both; the form `action` is `/api/subscribe`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/updates.astro
git commit -m "feat(m4): place Subscribe on homepage Follow block + /updates"
```

---

### Task 8: Runbooks (the go-live record)

**Files:** Create `docs/runbooks/m4-hosting.md`, `docs/runbooks/m4-subscribe.md`

- [ ] **Step 1: `m4-hosting.md`** — exact steps + snippets:
  - Cloudflare (browser): DNS `A overduetracker.org → 37.27.242.32` proxied; SSL/TLS = Full (strict); enable Authenticated Origin Pulls; issue an Origin Certificate covering `overduetracker.org`.
  - Box (`ssh newbox`): create `deploy` user + `/var/www/overdue` (owned by deploy); add the deploy **public** key to `~deploy/.ssh/authorized_keys` (ideally `command="rsync --server ..."`-restricted); install the Origin cert; the **Caddy vhost** block (below) — *applied only with the user's OK*, `caddy validate` then reload.
    ```
    overduetracker.org {
      root * /var/www/overdue
      file_server
      handle /api/subscribe* { reverse_proxy 127.0.0.1:8788 }
      tls /etc/ssl/overduetracker/origin.pem /etc/ssl/overduetracker/origin.key {
        client_auth { mode require_and_verify; trust_pool file /etc/ssl/cloudflare/authenticated_origin_pull_ca.pem }
      }
    }
    ```
  - GitHub: add secrets `NEWBOX_DEPLOY_KEY` (private), `NEWBOX_KNOWN_HOSTS` (`ssh-keyscan 37.27.242.32`).
  - Verify: push → Action rsyncs → `https://overduetracker.org` serves the site.

- [ ] **Step 2: `m4-subscribe.md`** — exact steps:
  - Buttondown (user): create account; copy API key to `/etc/overdue-subscribe.env` (`BUTTONDOWN_API_KEY=...`, `chmod 600`, root-only); enable RSS-to-email → `https://overduetracker.org/feed.xml`.
  - Box: install Node 22; copy `server/subscribe/` (or git-pull); systemd unit:
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
  - `systemctl enable --now overdue-subscribe`; reload Caddy (route from hosting runbook).
  - Verify: submit the form on the live site → inline ✓ + the address appears in Buttondown.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/m4-hosting.md docs/runbooks/m4-subscribe.md
git commit -m "docs(m4): hosting + subscribe go-live runbooks"
```

---

### Task 9: README + CHANGELOG (changelog with the wave — the binding fix)

**Files:** Modify `README.md`, `CHANGELOG.md`

- [ ] **Step 1: README** — update the Follow section: email subscribe now real; note the site is moving to `overduetracker.org`.

- [ ] **Step 2: CHANGELOG** — newest-first `## 2026-06-18 · M4 — custom domain + newbox host + inline subscribe (repo side)`, bullets: env-driven apex config + canonical; rsync deploy workflow (+ Pages backup under PAGES=1); subscribe service (normalize/map/subscribe, tested) + HTTP glue; inline subscribe frontend (statusMessage tested) on homepage + /updates; go-live runbooks. Note go-live (Cloudflare/box/Buttondown) executed separately.

- [ ] **Step 3: Full test + both builds green**

Run: `npm test` → all pass. `npm run build` and `PAGES=1 npm run build` → both succeed.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(m4): README + CHANGELOG for M4 repo side"
```

---

## Self-Review checklist (run before building)

- Spec coverage: env base/site ✅(T1) · canonical ✅(T2) · deploy workflow + Pages backup ✅(T3) · subscribe service ✅(T4,T5) · subscribe frontend ✅(T6,T7) · runbooks ✅(T8) · changelog-with-wave ✅(T9).
- Type/contract consistency: `{status}` shape returned by service (`subscribed|already|invalid|error`) matches `statusMessage` cases and the frontend `j.status`. `subscribe()` signature matches the test and `index.mjs` call. Form `action` = `/api/subscribe`, Caddy `handle /api/subscribe*` and service route agree (`127.0.0.1:8788`).
- No placeholders: every code step is real; the only deferred verification (Buttondown host + field name) is explicitly called out for the implementer to confirm against current docs.
