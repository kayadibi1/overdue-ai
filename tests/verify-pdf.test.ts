import { describe, it, expect } from 'vitest';
import { isPdfUrl } from '../src/watcher/pdf';

describe('isPdfUrl', () => {
  it('is true for a plain .pdf URL', () => {
    expect(isPdfUrl('https://x/a.pdf')).toBe(true);
  });

  it('is true for an uppercase .PDF URL', () => {
    expect(isPdfUrl('https://x/a.PDF')).toBe(true);
  });

  it('is true for a .pdf URL with a query string', () => {
    expect(isPdfUrl('https://x/a.pdf?v=1')).toBe(true);
  });

  it('is true for a .pdf URL with a fragment', () => {
    expect(isPdfUrl('https://x/a.pdf#p2')).toBe(true);
  });

  it('is false for an .html URL', () => {
    expect(isPdfUrl('https://x/a.html')).toBe(false);
  });

  it('is false for a "pdf-guide" path (no .pdf extension)', () => {
    expect(isPdfUrl('https://x/pdf-guide')).toBe(false);
  });

  it('is false when .pdf is followed by another extension', () => {
    expect(isPdfUrl('https://x/a.pdf.html')).toBe(false);
  });
});
