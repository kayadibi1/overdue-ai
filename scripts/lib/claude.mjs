import { spawn } from 'node:child_process';

/** Pure. Build the adjudication prompt. */
export function buildPrompt(commitment, artifactText) {
  const oblig = (commitment.sources || []).find((s) => s.role === 'obligation') || commitment.sources?.[0] || {};
  const deadline = commitment.deadline || commitment.triggerText || 'unspecified';
  return [
    `You are adjudicating whether a published artifact satisfies ONE specific, DATED AI-safety commitment.`,
    `Be strict: only the specific dated obligation below counts — not adjacent, earlier, or similar facts.`,
    `COMMITMENT: ${commitment.title}`,
    `LAB: ${commitment.lab}`,
    oblig.quote ? `VERBATIM PROMISE: "${oblig.quote}"` : '',
    `DEADLINE / TRIGGER: ${deadline}${commitment.deadlineBasis === 'derived' && commitment.derivationNote ? ` (derived — ${commitment.derivationNote})` : ''}`,
    `COMMITTED ON: ${commitment.committedOn}`,
    ``,
    `ARTIFACT (extracted text — this may be the LIVE page OR an older ARCHIVED snapshot; judge only what it actually evidences, and note its own date if shown):`,
    (artifactText || '').slice(0, 8000),
    ``,
    `Decide: does this artifact give POSITIVE evidence that THIS specific obligation was fulfilled BY its deadline/trigger?`,
    `Answer "no" if the artifact predates the obligation, only shows an earlier/different action, or does not clearly evidence the specific dated deliverable. Do NOT infer fulfillment from adjacent facts or from the obligation merely existing.`,
    `Respond with ONLY a JSON object, no prose, exactly:`,
    `{"verdict":"met"|"partial"|"no","rationale":"one sentence citing what in the artifact supports this","citation":"the URL or section you relied on"}`,
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
    if (env.CLAUDE_CODE_OAUTH_TOKEN) {
      env.CLAUDE_CODE_OAUTH_TOKEN = env.CLAUDE_CODE_OAUTH_TOKEN.trim();   // strip stray newline/space from the secret (a real 401 cause)
      // Subscription mode: the API-key vars outrank the OAuth token in precedence, so
      // strip them — otherwise an accidentally-set key would bill the metered API.
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
    }
    // Else (no OAuth token): metered mode — leave ANTHROPIC_API_KEY in place (sanctioned
    // for automation). Switching sub→metered is then a pure secret change, no code edit.
    // stdio[0]='ignore' redirects the child's stdin to /dev/null — otherwise `claude`
    // waits ~forever for piped stdin (we pass the prompt as a -p arg, not via stdin).
    // Pin the model + reasoning effort (env-overridable). Default: Opus 4.8 at xhigh
    // effort — a judgment task wants deep reasoning; --effort is the only CLI lever
    // (extended-thinking budget is API-only). Pinning the full ID keeps runs reproducible.
    const model = process.env.CLAUDE_MODEL || 'claude-opus-4-8';
    const effort = process.env.CLAUDE_EFFORT || 'xhigh';
    const child = spawn('claude',
      ['-p', prompt, '--model', model, '--effort', effort, '--output-format', 'json', '--dangerously-skip-permissions'],
      { env, stdio: ['ignore', 'pipe', 'pipe'] });
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
