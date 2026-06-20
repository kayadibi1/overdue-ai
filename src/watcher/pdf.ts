import { extractText, getDocumentProxy } from 'unpdf';

/** Extract text from PDF bytes (pages merged, whitespace collapsed). Never throws → '' on failure. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join(' ') : text).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}
