// DOM-only island for /c/<id>: copy the citation text to the clipboard.
// Guarded so a node import (tests) is a harmless no-op. No pure logic lives here.
if (typeof document !== 'undefined') {
  const btn = document.querySelector<HTMLButtonElement>('[data-cite-copy]');
  const text = document.querySelector<HTMLElement>('[data-cite-text]');
  if (btn && text) {
    btn.addEventListener('click', async () => {
      const value = text.textContent ?? '';
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Clipboard API unavailable (insecure context / denied): fall back to a selection.
        const range = document.createRange();
        range.selectNodeContents(text);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      const original = btn.textContent;
      btn.textContent = 'Copied';
      btn.disabled = true;
      window.setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 1500);
    });
  }
}
