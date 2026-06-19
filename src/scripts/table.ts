// DOM-only island for /table: per-column sort + lab/status/text filters + reset.
// No pure logic lives here (it would be unit-tested elsewhere); guarded so a
// node import (tests) is a harmless no-op.
if (typeof document !== 'undefined') {
  const table = document.getElementById('ctable') as HTMLTableElement | null;
  const tbody = table?.querySelector('tbody');
  if (table && tbody) {
    const ORIGINAL = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr')); // server urgency order

    // Map a sort key to the row dataset field it reads.
    const FIELD: Record<string, string> = {
      lab: 'lab', title: 'title', category: 'category',
      committed: 'committed', deadline: 'deadline', status: 'status',
    };
    let sortKey = '';
    let asc = true;

    function applyFilter(): void {
      const lab = (document.getElementById('ctable-lab') as HTMLSelectElement).value;
      const status = (document.getElementById('ctable-status') as HTMLSelectElement).value;
      const q = (document.getElementById('ctable-q') as HTMLInputElement).value.trim().toLowerCase();
      let visible = 0;
      ORIGINAL.forEach((tr) => {
        const matchesQ = !q
          || (tr.dataset.title ?? '').toLowerCase().includes(q)
          || (tr.dataset.category ?? '').toLowerCase().includes(q);
        const show = (!lab || tr.dataset.lab === lab) && (!status || tr.dataset.status === status) && matchesQ;
        tr.hidden = !show;
        if (show) visible++;
      });
      const empty = document.getElementById('ctable-empty');
      if (empty) empty.hidden = visible !== 0;
    }

    function applySort(): void {
      const ordered = ORIGINAL.slice();   // empty sortKey restores the server urgency order
      if (sortKey) {
        const field = FIELD[sortKey];
        ordered.sort((a, b) => {
          const av = a.dataset[field] ?? '';
          const bv = b.dataset[field] ?? '';
          const cmp = av.localeCompare(bv);
          return asc ? cmp : -cmp;
        });
      }
      ordered.forEach((tr) => tbody!.appendChild(tr));
    }

    table.querySelectorAll<HTMLElement>('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort ?? '';
        if (sortKey === key) asc = !asc;
        else { sortKey = key; asc = true; }
        applySort();
      });
    });

    ['ctable-lab', 'ctable-status'].forEach((id) =>
      document.getElementById(id)?.addEventListener('change', applyFilter));
    document.getElementById('ctable-q')?.addEventListener('input', applyFilter);
    document.getElementById('ctable-reset')?.addEventListener('click', () => {
      (document.getElementById('ctable-lab') as HTMLSelectElement).value = '';
      (document.getElementById('ctable-status') as HTMLSelectElement).value = '';
      (document.getElementById('ctable-q') as HTMLInputElement).value = '';
      sortKey = '';
      asc = true;
      applySort();   // restore server order
      applyFilter();
    });
  }
}
