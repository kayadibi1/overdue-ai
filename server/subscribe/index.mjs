import { createServer } from 'node:http';
import { normalizeEmail, subscribe } from './subscribe.mjs';

const PORT = Number(process.env.PORT || 8788);
const API_KEY = process.env.BUTTONDOWN_API_KEY;
const MAX_BODY = 4096;

if (!API_KEY) { console.error('BUTTONDOWN_API_KEY is required'); process.exit(1); } // fail fast → systemd marks it failed

function send(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.startsWith('/api/subscribe')) return send(res, 404, { status: 'error' });
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('error', () => {});                    // swallow post-destroy noise
  req.on('data', (c) => {
    if (aborted) return;                        // guard every chunk once over the cap
    size += c.length;                           // c is a Buffer → byte length
    if (size > MAX_BODY) { aborted = true; send(res, 413, { status: 'error' }); req.destroy(); }
    else chunks.push(c);
  });
  req.on('end', async () => {
    if (aborted) return;
    try {
      const email = normalizeEmail(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}').email);
      if (!email) return send(res, 422, { status: 'invalid' });
      send(res, 200, await subscribe(email, { apiKey: API_KEY }));
    } catch {
      send(res, 400, { status: 'error' });
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`subscribe service on 127.0.0.1:${PORT}`));
