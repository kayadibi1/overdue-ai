export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 3 || e.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export function mapButtondownResponse(httpStatus, body) {
  if (httpStatus >= 200 && httpStatus < 300) return { status: 'subscribed' };
  if (httpStatus === 400 || httpStatus === 409) {
    const t = JSON.stringify(body ?? '').toLowerCase();
    if (t.includes('already') || t.includes('exist')) return { status: 'already' };
    return { status: 'invalid' };
  }
  return { status: 'error' };
}

// Verified against docs.buttondown.com (2026-06): host api.buttondown.com, field email_address,
// auth "Token <key>", 201 on create, 400 if the subscriber already exists.
export async function subscribe(email, { apiKey, fetchFn = fetch, apiBase = 'https://api.buttondown.com' }) {
  const res = await fetchFn(`${apiBase}/v1/subscribers`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email }),
  });
  let body = null;
  try { body = await res.json(); } catch { /* ignore non-JSON */ }
  return mapButtondownResponse(res.status, body);
}
