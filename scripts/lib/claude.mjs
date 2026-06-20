import { spawn } from 'node:child_process';

/** Pure. Build the adjudication prompt. */
export function buildPrompt(commitment, artifactText) {
  const oblig = (commitment.sources || []).find((s) => s.role === 'obligation') || commitment.sources?.[0] || {};
  return [
    `You are adjudicating whether a published artifact satisfies a specific dated AI-safety commitment.`,
    `COMMITMENT: ${commitment.title}`,
    `LAB: ${commitment.lab}`,
    oblig.quote ? `VERBATIM PROMISE: "${oblig.quote}"` : '',
    `ARTIFACT (extracted text, may be truncated):`,
    (artifactText || '').slice(0, 8000),
    ``,
    `Does the artifact satisfy the promise? Respond with ONLY a JSON object, no prose, exactly:`,
    `{"verdict":"met"|"partial"|"no","rationale":"one sentence","citation":"the URL or section you relied on"}`,
  ].filter(Boolean).join('\n');
}

/** Pure. Parse the `claude -p --output-format json` envelope, then the model's inner JSON. Returns {verdict,rationale,citation} or null. */
export function parseVerdict(stdout) {
  try {
    const env = JSON.parse(stdout);
    const text = typeof env?.result === 'string' ? env.result : stdout;
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const v = JSON.parse(m[0]);
    if (!v || (v.verdict !== 'met' && v.verdict !== 'partial' && v.verdict !== 'no')) return null;
    return { verdict: v.verdict, rationale: String(v.rationale ?? ''), citation: String(v.citation ?? '') };
  } catch {
    return null;
  }
}

/** IO. Run claude headless, subscription-billed, hardened. Resolves {ok:true, raw} or {ok:false, reason}. Never throws. */
export function runClaude(prompt, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;     // both outrank CLAUDE_CODE_OAUTH_TOKEN in precedence — strip so the SUB pays
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', ['-p', prompt, '--output-format', 'json', '--dangerously-skip-permissions'], { env });
    let out = '', err = '';
    const tail = () => (err || out || '').replace(/\s+/g, ' ').trim().slice(-600);
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve({ ok: false, reason: 'timeout', detail: tail() }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, reason: 'spawn-error', detail: String(e) }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 || /authentication_failed|401|invalid.*token/i.test(out + err))
        return resolve({ ok: false, reason: `exit-${code}`, detail: tail() });
      resolve({ ok: true, raw: out });
    });
  });
}
