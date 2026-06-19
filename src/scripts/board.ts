import { liveLabel, regulatoryLabel } from '../lib/status';

const CHIP_LABEL: Record<string, string> = { overdue: 'Overdue', upcoming: 'Upcoming' };

const board = document.getElementById('board');
// Guard against a missing board (e.g. methodology page or partial render): wire nothing.
if (!board) {
  // no-op: the island has nothing to drive
} else {
  const ORIGINAL_ORDER = Array.from(board.querySelectorAll<HTMLElement>('.card')); // server urgency order

  function applyControls(): void {
    const lab = (document.getElementById('filter-lab') as HTMLSelectElement).value;
    const status = (document.getElementById('filter-status') as HTMLSelectElement).value;
    const sort = (document.getElementById('sort') as HTMLSelectElement).value;

    // Reorder ('urgency' restores the original server order)
    const ordered = ORIGINAL_ORDER.slice();
    if (sort === 'lab') ordered.sort((a, b) => (a.dataset.lab ?? '').localeCompare(b.dataset.lab ?? ''));
    else if (sort === 'committed') ordered.sort((a, b) => (b.dataset.committed ?? '').localeCompare(a.dataset.committed ?? '')); // newest first
    ordered.forEach((c) => board!.appendChild(c));

    // Filter
    let visible = 0;
    ORIGINAL_ORDER.forEach((c) => {
      const show = (!lab || c.dataset.lab === lab) && (!status || c.dataset.status === status);
      c.hidden = !show;
      if (show) visible++;
    });
    document.getElementById('empty')!.hidden = visible !== 0;
  }

  function tick(): void {
    const now = Date.now();
    let overdueNow = 0;
    let flipped = false;
    document.querySelectorAll<HTMLElement>('.card').forEach((card) => {
      const deadline = card.dataset.deadline;
      const timer = card.querySelector<HTMLElement>('[data-timer]');
      // Only live (unresolved, dated) cards tick; resolved/none/pending stay static.
      if (!timer || timer.dataset.kind === 'resolved' || timer.dataset.kind === 'none' || !deadline) return;
      const { kind, days } = liveLabel(deadline, now);   // SAME function the build used
      const nEl = timer.querySelector<HTMLElement>('[data-timer-n]');
      const lEl = timer.querySelector<HTMLElement>('[data-timer-l]');
      if (nEl) nEl.textContent = days === 0 ? 'today' : `${days}d`;
      if (lEl) lEl.textContent = kind === 'overdue' ? 'overdue' : 'until due';
      timer.dataset.kind = kind;
      if (kind === 'overdue') overdueNow++;
      // Keep status + chip + colors in sync if a card flips upcoming -> overdue live.
      if (card.dataset.status !== kind) {
        card.dataset.status = kind;
        flipped = true;
        const chip = card.querySelector<HTMLElement>('.chip');
        if (chip) { chip.className = `chip chip--${kind}`; chip.textContent = CHIP_LABEL[kind]; }
        timer.className = timer.className.replace(/card__big--\w+/, `card__big--${kind}`);
        card.className = card.className.replace(/card--(overdue|upcoming|met|missed|partial|pending)/, `card--${kind}`);
      }
    });
    const n = document.querySelector<HTMLElement>('[data-stat-n="overdue"]');
    if (n) n.textContent = String(overdueNow);
    // Tick regulatory countdowns too (separate section; never "overdue").
    document.querySelectorAll<HTMLElement>('[data-reg-timer]').forEach((el) => {
      const d = el.dataset.deadline;
      if (d) el.textContent = regulatoryLabel(d, now).label;
    });
    // If any card flipped status, re-apply controls once so an active status filter stays consistent.
    if (flipped) applyControls();
  }

  ['filter-lab', 'filter-status', 'sort'].forEach((id) =>
    document.getElementById(id)?.addEventListener('change', applyControls));

  // Clickable scorecard: a stat sets the status filter, applies, and scrolls to the board.
  function filterByStat(el: HTMLElement): void {
    const key = el.dataset.filterStatus ?? '';
    const select = document.getElementById('filter-status') as HTMLSelectElement | null;
    if (!select) return;
    select.value = key;
    applyControls();
    document.getElementById('board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll<HTMLElement>('[data-filter-status]').forEach((el) => {
    el.addEventListener('click', () => filterByStat(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filterByStat(el); }
    });
  });

  tick();
  setInterval(tick, 1000);
}
