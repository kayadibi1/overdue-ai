# Why I built Overdue — and how it differs from the trackers that already exist

Frontier AI labs have made a lot of dated safety promises. Responsible Scaling Policies and Frontier Safety Frameworks with version commitments. The Seoul Frontier AI Safety Commitments. The 2023 White House voluntary commitments. Preparedness frameworks with specific thresholds. Self-imposed deadlines announced in blog posts.

The obvious question — *are they keeping them?* — turns out to be surprisingly hard to answer at a glance. The promises are scattered across dozens of PDFs and pages, each with its own deadline, and "we'll publish X by date Y" quietly slips by with no one keeping score.

So I built **Overdue**: a board of specific, dated commitments the labs themselves made or signed, each with a status (met / missed / partial), a **live deadline clock** that counts down if a promise is upcoming and counts up once it's *overdue*, and one source per row. Government laws like the EU AI Act are tracked separately, as countdowns — they're not promises a lab made, so they're never scored kept or broken.

## How it differs (because I didn't build this in a vacuum)

There's good work in this space already, and Overdue is meant to complement it, not replace it:

- **[The Midas Project's Seoul Tracker](https://www.seoul-tracker.org/)** is excellent — but it grades *one* collective deadline (the Seoul red-line pledge). Its [Watchtower](https://www.themidasproject.com/watchtower) catches quiet policy edits.
- **[AI Lab Watch](https://ailabwatch.org/)** compiled the broadest commitment list anywhere — but it's been unmaintained since September 2025.
- **[FLI's AI Safety Index](https://futureoflife.org/)** and **[SaferAI](https://www.safer-ai.org/)** grade overall safety *posture*, not whether each dated promise was kept.

None of them is a *live, per-promise deadline clock across all the regimes at once*. That's the gap Overdue fills — and it's the part I most care about keeping current.

## How it stays current

The failure mode for a tracker like this is rot: it goes stale, then wrong, then abandoned. So Overdue has a **weekly watcher** — a GitHub Action that diffs the labs' policy pages and the regulatory timelines and opens an issue when something moves or a deadline comes due. The board gets reviewed because the robot pokes me, not because I remember to look.

## What it's not

Not the first accountability project. Not a scorecard of "who's safest." Rulings are judgment calls, every row carries a public source, and genuinely disputable ones are flagged as contested.

## Follow along

- **The tracker:** https://kayadibi1.github.io/overdue-ai/
- **Methodology & prior work:** /methodology
- **RSS:** /feed.xml — every update lands there. Email subscribe is coming next.

If you spot an error, the dataset is open JSON and corrections are one GitHub issue away.
