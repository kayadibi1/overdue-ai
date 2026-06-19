# Overdue — Frontier AI Safety Commitment Tracker

**Are frontier AI labs keeping the dated safety promises *they* made — and which are overdue right now?**

A static, source-cited board of specific, dated safety promises **the labs themselves made or signed** (RSP/Preparedness/Frontier-Safety milestones, the Seoul and White House voluntary commitments). Each row shows a status (Met / Missed / Partial / Overdue / Upcoming / Pending), a **live timer** (counts up if overdue, down if upcoming), and one evidence link. Government **laws** (e.g. the EU AI Act) are tracked separately, beneath the board, as countdown-only *regulatory milestones* — never scored kept or broken.

## Why this exists
Existing trackers cover one collective deadline (The Midas Project's Seoul Tracker) or compare policy documents (METR). None tracks *many* individual dated promises across all labs with a live overdue counter and per-row evidence. This does — honestly: rulings are judgment calls, every row is sourced, and disputable ones are flagged. Not the first accountability project; see Methodology for prior work it builds on.

## Follow
Changes are posted to an on-site **updates log** (`/updates`), an **RSS feed** (`/feed.xml`), and **email** (subscribe form on the site). Email is **our own** double-opt-in list — a small Python service on the box (SQLite + verify/unsubscribe) sending through **Resend SMTP** from a verified subdomain with one-click `List-Unsubscribe`; no SaaS owns the list. The site is served at **overduetracker.org** (a self-hosted box behind Cloudflare); the `kayadibi1.github.io/overdue-ai` Pages build stays as a backup.

## Run it
```bash
npm install
npm run dev      # http://localhost:4321/  (apex base; PAGES=1 builds the /overdue-ai backup)
npm test         # pure-logic + data-integrity tests
npm run build
```

## Explore & reuse
Beyond the homepage card board, the site offers:
- **Per-commitment pages** (`/c/<id>`) — each with a status timeline (committed → due → evaluated → ruling), the surfaced ruling rationale, the source, an "as of" date, and a ready-to-paste citation.
- **Per-lab report cards** (`/labs/<slug>`) — each lab's commitments with its status counts and a kept-rate (`met ÷ resolved`, shown with the underlying counts).
- **An explore table** (`/table`) — every commitment, sortable by any column and filterable by lab / status / text.
- **A corrections log** (`/corrections`) — when a ruling changes or an error is fixed, it's recorded here.
- **Open data downloads** — `/commitments.json` and `/commitments.csv`.

## How it's built
Astro (static) + TypeScript. Pure logic in `src/lib/status.ts` is imported by both the build and one client island, so server HTML and live timers never diverge. Data is a typed array in `src/data/commitments.ts`, also published as open JSON at `/commitments.json` and CSV at `/commitments.csv`.

## Licenses
The **code** is MIT licensed (see `LICENSE`). The **dataset** (`src/data/*`, `/commitments.json`, `/commitments.csv`) is licensed **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (see `LICENSE-DATA`) — republish freely with attribution.
