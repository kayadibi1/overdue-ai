# Overdue — Frontier AI Safety Commitment Tracker

**Which dated frontier-AI-safety commitments are being kept — and which are overdue right now?**

A static, source-cited board of specific, dated safety commitments by frontier AI labs. Each row shows a status (Met / Missed / Partial / Overdue / Upcoming / Pending), a **live timer** (counts up if overdue, down if upcoming), and one evidence link.

## Why this exists
Existing trackers cover one collective deadline (The Midas Project's Seoul Tracker) or compare policy documents (METR). None tracks *many* individual dated promises across all labs with a live overdue counter and per-row evidence. This does — honestly: rulings are judgment calls, every row is sourced, and disputable ones are flagged. Not the first accountability project; see Methodology for prior work it builds on.

## Run it
```bash
npm install
npm run dev      # http://localhost:4321/overdue-ai
npm test         # pure-logic + data-integrity tests
npm run build
```

## How it's built
Astro (static) + TypeScript. Pure logic in `src/lib/status.ts` is imported by both the build and one client island, so server HTML and live timers never diverge. Data is a typed array in `src/data/commitments.ts`, also published as open JSON at `/commitments.json`.

MIT licensed.
