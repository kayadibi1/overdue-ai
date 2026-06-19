# Code-review remediation — Implementation Plan

**Goal:** Fix the findings from the 2026-06-19 comprehensive review. TDD the logic fixes; strengthen tests; low-risk doc/CI fixes. Keep all 45 vitest + 38 pytest green; both builds green; deploy.

## Fixes (by severity)

### HIGH
1. **`src/lib/status.ts` `relativeTime`** — resolved trigger-commitments (deadline null) return `null` → card shows "awaiting {triggerText}" beside a Met/Missed chip (~10 live rows). Gate the resolved branch on `resolvedOn` alone; with no deadline emit `{label: 'resolved {resolvedOn}', kind:'resolved', days:0}`. TEST first (resolved trigger → non-null resolved label).

### MED
2. **`src/lib/status.ts` `sortByUrgency`** — resolved tie-break `db-da` is `NaN` for two `deadline:null` rows. Use finite fallback (`deadline?parseUTC:0`), then `resolvedOn` desc, then `id`. TEST: two resolved trigger rows sort deterministically.
3. **`tests/data.test.ts`** — strengthen: `evidenceUrl` must be http(s) + hostname-with-dot; apply `isRealUtcDate` to `committedOn`/`deadline`/`resolvedOn`/`lastChecked`; `resolvedOn` set ⟺ `resolution` set; `resolvedOn >= committedOn`. Run — if any real data row fails, fix the data.
4. **`src/pages/table.astro` + `src/scripts/table.ts`** — sortable `<th>` are mouse-only. Wrap the header label in `<button type="button" data-sort=...>`; move the click+keyboard handling to the buttons; add `scope="col"`.
5. **`.github/workflows/deploy-newbox.yml`** — `rsync --delete` blast radius: add `--exclude='.well-known/'` + a "CI-managed dir" comment.
6. **`docs/runbooks/m4-hosting.md`** — drop the `command="rsync…"` forced-command instruction (it would break the send-on-publish SSH which shares the key); install the deploy key unrestricted (matches live), note the tradeoff.
7. **`docs/runbooks/m4-subscribe.md`** — add a "SUPERSEDED by m5-email.md (service is Python, not Node)" banner.

### LOW
8. **`src/lib/feed.ts` `escapeXml`** — strip XML-1.0-illegal control chars.
9. **`src/pages/feed.xml.ts`** — build feed `siteUrl`/`feedUrl` from `CANONICAL_ORIGIN` so the Pages-backup feed points readers at the apex (apex build unaffected).
10. **`src/pages/updates.astro`** — commitment refs link to `/c/{id}` (every commitment has that page) instead of `/#commitment-{id}` (lab-only anchor).

### Test additions
11. **`tests/m6.test.ts`** — `commitmentsByLab` (only lab-track, grouped). **`tests/status.test.ts`** — `relativeTime` "resolved early" + "resolved on time"; `regulatoryLabel` singular-day boundary.
12. **`server/subscribe/tests/`** — `build_message`/`valid_email` reject header-injection (CR/LF); the read-path rate limiter trips.

## Verify
`npm test` (45→more) + `pytest server/subscribe -q` (38→more) green; `npm run build` + `PAGES=1 npm run build` green; spot-check a resolved trigger card on the live site after deploy. CHANGELOG entry in the same wave.
