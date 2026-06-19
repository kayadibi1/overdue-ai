export function statusMessage(status: string): string {
  switch (status) {
    case 'subscribed': return '✓ Thanks — check your inbox to confirm.';
    case 'already': return "You're already subscribed.";
    case 'invalid': return 'Please enter a valid email.';
    default: return 'Something went wrong — please try again.';
  }
}

// Progressive enhancement: intercept submit, POST same-origin, render inline status.
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
