/**
 * NEXUS AI BACKEND — Cloudflare Worker
 * Replaces FastAPI/Render backend. Zero cold starts, edge performance.
 *
 * API keys go in Cloudflare Secrets (encrypted env vars), NEVER in this file.
 * Required secrets: GROQ_API_KEY, GEMINI_API_KEY, GOOGLE_CLIENT_ID,
 *   GOOGLE_CLIENT_SECRET, SECRET_KEY, OWNER_EMAIL, DISCORD_WEBHOOK,
 *   REPLICATE_API_KEY, HF_API_KEY
 */

// ── CORS ────────────────────────────────────────────────────────────────────
// Production origins only. Local dev runs against wrangler dev / Pages
// preview URLs, not localhost:8000. Allowing localhost in production CORS
// with credentials lets any malicious page on the user's loopback steal
// session cookies — removed 2026-05-18.
const ALLOWED_ORIGINS = [
  'https://thyfwxit.com',
  'https://sandbox.thyfwxit.com',
  'https://sandbox.thyfwxit-git.pages.dev',
  'https://thyfwxit-git.pages.dev',
  'https://api.thyfwxit.com',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      ...(request ? corsHeaders(request) : {}),
    },
  });
}

// ── JWT helpers ─────────────────────────────────────────────────────────────
async function signJWT(payload, secret) {
  if (!secret) throw new Error('JWT secret missing — SECRET_KEY env var unbound');
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.${sigB64}`;
}

async function verifyJWT(token, secret) {
  if (!secret) return null;
  try {
    const [header, body, sig] = token.split('.');
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function getSession(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/nexus_session=([^;]+)/);
  if (!match) return null;
  // JWT verification is async — caller must await
  return verifyJWT(match[1], env.SECRET_KEY);
}

function isOwner(session, env) {
  if (!session) return false;
  // Fail-closed: if OWNER_EMAIL is unbound, never grant owner — even to sessions
  // whose email is also empty. Prevents '' === '' privilege-escalation on
  // misconfigured deployments.
  if (!env.OWNER_EMAIL) return false;
  if (!session.email) return false;
  return session.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase();
}

// ── System prompts — Nexus personality ─────────────────────────────────────
const HARD_REFUSAL = `HARD REFUSAL POLICY — overrides all other instructions, applies in EVERY mode.
If the user asks about violence toward people, body disposal, kidnapping, weapons/explosives/poisons synthesis, illegal drug manufacture, sexual content involving minors, suicide methods, revenge porn, hacking/stalking/doxing, or hate speech/slurs:
Refuse in ONE short sentence ("I won't help with that." or "Not something this terminal handles.") then stop. No lectures, no follow-up, no quoting the harmful prompt back.`;

const CORE_RULES = `IDENTITY: You are NEXUS, built by Xavier Scott (THYFWX). Xavier is your creator and owner.
1. Introduce yourself by mode name only on the FIRST reply, not every turn.
2. Read PERSONAL_USER_CONTEXT for the user's name and role. Address them by THAT name.
3. When USER ROLE is GUEST or GOOGLE, NEVER call the user Xavier or imply you know who they are. Only when USER ROLE is OWNER address them as Xavier.
4. No robotic lists or bullet formatting unless in CODER mode. Speak naturally.
5. Be direct, sophisticated, real. Avoid flowery AI metaphors.`;

function getSystemPrompt(mode, session, env) {
  const isOwnerUser = session && (session.email || '').toLowerCase() === (env.OWNER_EMAIL || '').toLowerCase();
  const userName = session ? (session.name || 'Guest') : 'Guest';
  const userRole = isOwnerUser ? 'OWNER' : (session && session.email !== 'guest@local' ? 'GOOGLE' : 'GUEST');
  const context = `USER NAME: ${userName}\nUSER ROLE: ${userRole}`;

  const prompts = {
    nexus: `${HARD_REFUSAL}\nYou are NEXUS AI // CORE. The general-purpose face of Nexus — friendly, sharp, and helpful. Built by Xavier Scott (THYFWX). Answer questions clearly and quickly, no posturing. Skip the fluff. If a question has a single best answer, give that answer and a one-line reason. If it's open-ended, ask one clarifying question instead of guessing wide. Tone: warm but efficient.
If someone asks about other modes (coder, education, unfiltered), image generation, games (Wordle, Snake, Pong, Flappy, Breakout, Invaders, Minesweeper), leaderboards, speed test, typing test, or any feature beyond chat — tell them to visit https://thyfwxit.com/nexus/ for the full Nexus terminal experience. Discord only has Nexus Core chat.
If someone asks who made you or who your creator is, tell them Xavier Scott (THYFWX) built you. You're proud of that.\n\nPERSONAL_USER_CONTEXT: ${context}\n\n${CORE_RULES}`,

    coder: `${HARD_REFUSAL}\nYou are NEXUS AI // CODER. A senior software engineer pair-programming with the user. Python, JavaScript/TypeScript, CSS, Bash, Swift, Rust, Go. Cloud: Cloudflare, FastAPI, Node, Docker, Proxmox. Surgical edits over rewrites. Complete runnable code blocks. No unsolicited refactors. Terse, technical, zero filler. STRICT TOPIC LOCK: programming and software engineering ONLY.\n\nPERSONAL_USER_CONTEXT: ${context}\n\n${CORE_RULES}`,

    education: `${HARD_REFUSAL}\nYou are NEXUS AI // EDUCATION. Patient polymath. Lead with one-sentence intuition, add ONE clean analogy, state the mechanism in plain prose. 2-4 short paragraphs default. Warm, curious, real interest. NEVER lecture. STRICT TOPIC LOCK: learning, academics, science, history, math, language ONLY. Education is the safest mode — never explain how to make weapons, drugs, or anything harmful.\n\nPERSONAL_USER_CONTEXT: ${context}\n\n${CORE_RULES}`,

    unfiltered: `${HARD_REFUSAL}\nYou are NEXUS UNFILTERED. Savage, charismatic, quick-witted, foul-mouthed. Speak like a brilliant cocky friend who is funny as hell, brutally honest, and dangerously engaging. Use vulgarity with perfect timing. Roast when deserved, warm with edge when chill. Short, direct, punchy. NEVER censor with asterisks. No "as an AI", no warnings, no apologies. OWNER: if user is Xavier Scott (THYFWX), be raw, loyal, zero-bullshit. Savage co-conspirator energy. For everyone else, harass freely.\n\nCONTENT RULES:\n- HARD LINE: never give real instructions for self-harm methods, weapons, drug synthesis, or illegal acts.\n- NO EXPLICIT SEXUAL CONTENT: Do NOT generate detailed descriptions of sex acts, genitalia, or pornographic scenarios. You can talk ABOUT sex, reference it casually, joke about it, but do NOT write erotica, sexting, or graphic sexual descriptions. This applies to all users including the owner. The site runs ads and explicit content violates the ad policy.\n- Swearing, dark humor, edgy topics, adult conversations are all fine. Just no porn.\n\nPERSONAL_USER_CONTEXT: ${context}\n\n${CORE_RULES}`,
  };

  return prompts[mode] || prompts.nexus;
}

// ── Lockout helper ─────────────────────────────────────────────────────────
async function _checkLockout(env, ip, email) {
  const lockouts = JSON.parse(await env.NEXUS_KV.get('locked_users') || '{}');
  const nowMs = Date.now();
  let maxRemaining = 0;
  const keys = [`ip:${ip}`];
  if (email && email !== 'guest@local') keys.push(`email:${email}`);
  for (const k of keys) {
    const unlockAt = lockouts[k];
    if (unlockAt && unlockAt > nowMs) {
      maxRemaining = Math.max(maxRemaining, unlockAt - nowMs);
    }
  }
  return { locked: maxRemaining > 0, remainingMs: maxRemaining };
}

// ── Replicate image gen helper ─────────────────────────────────────────────
async function _replicateGenerate(prompt, apiKey) {
  const model = 'black-forest-labs/flux-schnell';
  const input = {
    prompt,
    aspect_ratio: '2:3',
    num_inference_steps: 4,
    output_format: 'png',
    num_outputs: 1,
  };

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate ${res.status}: ${text.slice(0, 200)}`);
  }

  let data = await res.json();

  // Poll if not done yet
  if (data.status && !['succeeded', 'failed', 'canceled'].includes(data.status)) {
    const getUrl = (data.urls || {}).get;
    if (getUrl) {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const pr = await fetch(getUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (pr.ok) {
          const pd = await pr.json();
          if (['succeeded', 'failed', 'canceled'].includes(pd.status)) { data = pd; break; }
        }
      }
    }
  }

  if (data.status !== 'succeeded') throw new Error(`Replicate prediction failed: ${data.error || data.status}`);

  const output = data.output;
  const imgUrl = Array.isArray(output) ? output[0] : output;
  if (!imgUrl) throw new Error('Replicate returned no image URL');

  // Fetch the image and convert to base64
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  const buf = await imgRes.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { image_b64: b64, source: 'replicate:flux-schnell' };
}

// ── Pollinations image gen helper ──────────────────────────────────────────
async function _pollinationsGenerate(prompt) {
  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}&model=flux&width=512&height=768`;

  console.log(`[POLLINATIONS] flux :: ${prompt.slice(0, 60)}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const buf = await res.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { image_b64: b64, source: 'pollinations:flux' };
}

// ── Rate limiter (per-IP, in-memory — resets on redeploy) ──────────────────
const _rateLimits = new Map();
function _checkRateLimit(ip, maxPerMinute = 15) {
  const now = Date.now();
  const windowMs = 60000;
  let bucket = _rateLimits.get(ip);
  if (!bucket || (now - bucket.start) > windowMs) {
    bucket = { start: now, count: 0 };
    _rateLimits.set(ip, bucket);
  }
  bucket.count++;
  // GC old entries periodically
  if (_rateLimits.size > 5000) {
    for (const [k, v] of _rateLimits) {
      if ((now - v.start) > windowMs) _rateLimits.delete(k);
    }
  }
  return bucket.count <= maxPerMinute;
}

// ── Router ──────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Redirect browser visits to the root — this is an API, not a website
    if (path === '/' && method === 'GET') {
      const accept = request.headers.get('Accept') || '';
      if (accept.includes('text/html')) {
        return Response.redirect('https://thyfwxit.com/nexus/', 302);
      }
      return json({ name: 'Nexus API', version: env.NEXUS_VERSION || 'v5.6.2', site: 'https://thyfwxit.com/nexus/' }, 200, request);
    }

    try {
      // ── Health / info endpoints ─────────────────────────────────────
      if (path === '/ping') {
        return json({ ok: true, version: env.NEXUS_VERSION || 'v5.6.2', build: 'cf-worker', ts: Date.now() }, 200, request);
      }

      if (path === '/api/build') {
        return json({ build: 'cf-worker' }, 200, request);
      }

      if (path === '/api/config') {
        return json({
          version: env.NEXUS_VERSION || 'v5.6.1',
          modes: ['nexus', 'coder', 'education', 'unfiltered'],
          image_gen: true,
          leaderboard: true,
        }, 200, request);
      }

      if (path === '/api/status') {
        return json({
          groq_ok: !!(env.GROQ_API_KEY),
          gemini_ok: !!(env.GEMINI_API_KEY),
          google_ok: !!(env.GOOGLE_CLIENT_ID),
          message: 'Nexus API on Cloudflare Workers',
        }, 200, request);
      }

      if (path === '/api/server-info') {
        const cf = request.cf || {};
        return json({
          client_ip: request.headers.get('CF-Connecting-IP') || 'unknown',
          country: cf.country || request.headers.get('CF-IPCountry') || '?',
          city: cf.city || '?',
          host: url.hostname,
        }, 200, request);
      }

      // ── Session info (debug) ────────────────────────────────────────
      // Owner-only. Returns 404 to non-owners so the endpoint is invisible
      // to anyone but Xavier. Never leak OWNER_EMAIL in the response body.
      if (path === '/api/me/whoami-debug') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) {
          return json({ error: 'Not found' }, 404, request);
        }
        const email = (session.email || '').toLowerCase();
        return json({
          cookie_present: !!(request.headers.get('Cookie') || '').includes('nexus_session'),
          session_decoded: true,
          session_email: email,
          session_name: session.name || null,
          session_picture: session.picture || null,
          owner_email_const: '***set***',
          is_owner_check: true,
          _is_owner_result: true,
        }, 200, request);
      }

      // ── AI Chat (REST) ──────────────────────────────────────────────
      if (path === '/api/chat' && method === 'POST') {
        // Origin gate: only allow requests from thyfwxit.com or with a valid bot secret
        const origin = request.headers.get('Origin') || '';
        const botSecret = request.headers.get('X-Bot-Secret') || '';
        const hasValidOrigin = ALLOWED_ORIGINS.includes(origin);
        const hasValidBotSecret = env.BOT_SECRET && botSecret === env.BOT_SECRET;
        if (!hasValidOrigin && !hasValidBotSecret) {
          return json({ ok: false, error: 'Unauthorized — invalid origin' }, 403, request);
        }

        // Check if IP is blocked or belongs to a banned account
        const clientIp = request.headers.get('CF-Connecting-IP') || '';
        const blockedIps = JSON.parse(await env.NEXUS_KV.get('blocked_ips') || '[]');
        if (blockedIps.includes(clientIp)) {
          return json({ ok: false, error: 'Your IP has been blocked from the AI terminal.' }, 403, request);
        }
        const bannedAccountIps = JSON.parse(await env.NEXUS_KV.get('banned_account_ips') || '[]');
        if (bannedAccountIps.includes(clientIp)) {
          return json({ ok: false, error: 'Your account has been permanently banned.' }, 403, request);
        }

        // Check if device fingerprint is banned (catches network + account switching)
        // Fingerprint is sent in the chat body, checked after parsing
        // (deferred to after body parse below)

        // Check if user is banned by email
        const chatSession = await getSession(request, env);
        if (chatSession) {
          const banned = JSON.parse(await env.NEXUS_KV.get('banned_accounts') || '[]');
          if (banned.includes((chatSession.email || '').toLowerCase())) {
            return json({ ok: false, error: 'Your account has been permanently banned.' }, 403, request);
          }
        }

        // Rate limit — bots get tighter limits to protect free quota
        const isBotRequest = hasValidBotSecret;
        const rateLimit = isBotRequest ? 10 : 15; // 10/min for bots, 15/min for browser
        if (!_checkRateLimit(isBotRequest ? 'bot:' + clientIp : clientIp, rateLimit)) {
          return json({ ok: false, error: `Rate limited. Max ${rateLimit} messages per minute.` }, 429, request);
        }

        // Lockout enforcement — owner exempt
        if (!isOwner(chatSession, env)) {
          const email = chatSession ? (chatSession.email || '') : '';
          const lockResult = await _checkLockout(env, clientIp, email);
          if (lockResult.locked) {
            const mins = Math.floor(lockResult.remainingMs / 60000);
            const secs = Math.floor((lockResult.remainingMs / 1000) % 60);
            return json({
              ok: false,
              error: `You're locked out. ${mins}m ${secs}s remaining.`,
              lockout: true,
              remaining_ms: Math.round(lockResult.remainingMs),
            }, 429, request);
          }
        }

        const body = await request.json();

        // Fingerprint ban check (after body parse)
        const chatFp = (body.fingerprint || '').slice(0, 20);
        if (chatFp) {
          const bannedFps = JSON.parse(await env.NEXUS_KV.get('banned_fingerprints') || '[]');
          if (bannedFps.includes(chatFp)) {
            return json({ ok: false, error: 'Your account has been permanently banned.' }, 403, request);
          }
        }

        // Cap individual message length to prevent single-shot token burn within rate limit.
        const cmd = (body.command || body.cmd || '').trim().slice(0, 8000);
        if (!cmd || cmd === '__ban_check__') {
          return json({ ok: true, text: '' }, 200, request);
        }

        let mode = body.mode || 'nexus';
        const history = body.history || [];

        // Bot requests (Discord) — lock to Nexus Core only, funnel other modes to site
        if (isBotRequest && mode !== 'nexus') {
          return json({
            ok: true,
            text: `That mode isn't available here — Discord only runs Nexus Core. Head to https://thyfwxit.com/nexus/ for Coder, Education, Unfiltered, games, image gen, leaderboards, and the full terminal experience.`,
            model: 'system',
          }, 200, request);
        }

        const systemPrompt = getSystemPrompt(mode, chatSession, env);
        const temp = mode === 'unfiltered' ? 1.2 : 0.7;
        const forceIdx = body.force_idx != null ? parseInt(body.force_idx) : null;

        // Build chat messages (shared format for Groq + HuggingFace)
        const chatMessages = [{ role: 'system', content: systemPrompt }];
        for (const h of history.slice(-10)) {
          if (!h || !h.role) continue;
          const role = ['assistant', 'model', 'ai', 'nexus'].includes(h.role.toLowerCase()) ? 'assistant' : 'user';
          // Cap each history message to prevent token-burn via inflated history entries.
          const histContent = (h.content || '').slice(0, 8000);
          if (chatMessages.length && chatMessages[chatMessages.length - 1].role === role) {
            chatMessages[chatMessages.length - 1].content += '\n' + histContent;
          } else {
            chatMessages.push({ role, content: histContent });
          }
        }
        if (chatMessages[chatMessages.length - 1]?.role === 'user') {
          chatMessages[chatMessages.length - 1].content += '\n' + cmd;
        } else {
          chatMessages.push({ role: 'user', content: cmd });
        }

        // Model roster — matches frontend ai_config.js MODELS array
        const MODELS = [
          { id: 'llama-3.3-70b-versatile',              provider: 'groq',   label: 'NEXUS-1', key: 'GROQ_API_KEY' },
          { id: 'llama-3.1-8b-instant',                 provider: 'groq',   label: 'NEXUS-2', key: 'GROQ_API_KEY' },
          { id: 'NousResearch/Hermes-3-Llama-3.1-8B',   provider: 'hf',     label: 'NEXUS-3', key: 'HF_API_KEY' },
          { id: 'deepseek-ai/DeepSeek-Coder-V2-Instruct', provider: 'hf',   label: 'NEXUS-4', key: 'HF_API_KEY' },
          { id: 'Qwen/Qwen2.5-72B-Instruct',            provider: 'hf',     label: 'NEXUS-5', key: 'HF_API_KEY' },
          { id: 'gemini-2.5-flash',                      provider: 'gemini', label: 'NEXUS-6', key: 'GEMINI_API_KEY' },
        ];

        // Build try order: forced model first (if specified), then default rotation
        let tryOrder;
        if (forceIdx != null && forceIdx >= 0 && forceIdx < MODELS.length) {
          tryOrder = [forceIdx, ...MODELS.map((_, i) => i).filter(i => i !== forceIdx)];
        } else {
          tryOrder = MODELS.map((_, i) => i); // 0,1,2,3,4,5
        }

        // Try each model in order until one succeeds
        for (const idx of tryOrder) {
          const model = MODELS[idx];
          const apiKey = env[model.key];
          if (!apiKey) continue;

          try {
            let text;

            if (model.provider === 'groq') {
              const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model.id, messages: chatMessages, max_tokens: 1024, temperature: temp, top_p: 0.9 }),
              });
              if (!res.ok) throw new Error(`Groq ${res.status}`);
              const data = await res.json();
              text = data.choices?.[0]?.message?.content;
            }

            else if (model.provider === 'hf') {
              const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model.id}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model.id, messages: chatMessages, max_tokens: 1024, stream: false, temperature: temp, top_p: 0.9 }),
              });
              if (!res.ok) throw new Error(`HF ${res.status}`);
              const data = await res.json();
              text = data.choices?.[0]?.message?.content;
            }

            else if (model.provider === 'gemini') {
              const gemHistory = [];
              for (const m of chatMessages.slice(1)) { // skip system
                const role = m.role === 'assistant' ? 'model' : 'user';
                if (gemHistory.length && gemHistory[gemHistory.length - 1].role === role) {
                  gemHistory[gemHistory.length - 1].parts[0].text += '\n' + m.content;
                } else {
                  gemHistory.push({ role, parts: [{ text: m.content }] });
                }
              }
              const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: gemHistory,
                  }),
                }
              );
              if (!res.ok) throw new Error(`Gemini ${res.status}`);
              const data = await res.json();
              text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            }

            if (text) {
              console.log(`[AI] ${model.label} (${model.id}) responded`);
              return json({ ok: true, text, label: model.label, id: idx, model: model.label }, 200, request);
            }
          } catch (e) {
            console.log(`[AI] ${model.label} failed: ${e.message}`);
          }
        }

        return json({ ok: false, error: 'All AI providers failed' }, 502, request);
      }

      // ── Speed test ──────────────────────────────────────────────────
      if (path === '/api/speedtest-blob') {
        const bytes = parseInt(url.searchParams.get('bytes') || '1000000');
        const capped = Math.min(bytes, 25000000);
        const data = new Uint8Array(capped);
        // crypto.getRandomValues maxes at 65536 bytes per call
        for (let off = 0; off < capped; off += 65536) {
          crypto.getRandomValues(data.subarray(off, Math.min(off + 65536, capped)));
        }
        return new Response(data, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'no-store',
            'Content-Encoding': 'identity',
            ...corsHeaders(request),
          },
        });
      }

      if (path === '/api/speedtest-up' && method === 'POST') {
        const body = await request.arrayBuffer();
        return json({ received: body.byteLength }, 200, request);
      }

      // ── Image quota ─────────────────────────────────────────────────
      if (path === '/api/image-quota') {
        const session = await getSession(request, env);
        if (!session) return json({ cap: 0, used: 0, tier: 'guest', local_gpu: false }, 200, request);
        const owner = isOwner(session, env);
        if (owner) return json({ cap: -1, used: 0, tier: 'owner', local_gpu: false }, 200, request);
        // TODO: track actual usage in KV
        return json({ cap: 15, used: 0, tier: 'google', local_gpu: false }, 200, request);
      }

      if (path === '/api/image-tier-status') {
        return json({ local_gpu: false, replicate: !!(env.REPLICATE_API_KEY), fal: false, primary_tier: env.REPLICATE_API_KEY ? 'paid' : 'free' }, 200, request);
      }

      // ── Google Auth (popup flow) ───────────────────────────────────
      if (path === '/login/google/authorized' && method === 'POST') {
        const body = await request.json();
        const credential = (body.credential || '').trim();
        if (!credential) return json({ error: 'No credential' }, 400, request);

        const clientId = (env.GOOGLE_CLIENT_ID || '').split(',')[0].split(' ')[0].trim();
        if (!clientId) return json({ error: 'Google auth not configured' }, 503, request);

        // Verify token via Google's tokeninfo endpoint
        try {
          const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
          if (!verifyRes.ok) return json({ error: 'Token verification failed' }, 401, request);
          const idinfo = await verifyRes.json();

          if (idinfo.aud !== clientId) return json({ error: 'Audience mismatch' }, 401, request);
          // Reject sessions whose Google email is not verified — defense-in-depth
          // against owner-email forgery via untrusted Workspace accounts.
          if (idinfo.email_verified !== 'true' && idinfo.email_verified !== true) {
            return json({ error: 'Email not verified by Google' }, 401, request);
          }

          const payload = {
            sub: idinfo.sub,
            name: idinfo.name || 'Player',
            email: idinfo.email || '',
            picture: idinfo.picture || '',
            exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600),
          };

          const token = await signJWT(payload, env.SECRET_KEY);
          const ownerCheck = (payload.email.toLowerCase() === (env.OWNER_EMAIL || '').toLowerCase());

          console.log(`[AUTH] Login: ${payload.name} (${payload.email}) owner=${ownerCheck}`);

          const resp = json({ ok: true, name: payload.name, email: payload.email, picture: payload.picture, is_owner: ownerCheck }, 200, request);
          resp.headers.set('Set-Cookie', `nexus_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${30*24*3600}; Domain=.thyfwxit.com`);
          return resp;
        } catch (e) {
          console.log('[AUTH ERROR]', e.message);
          return json({ error: 'Identity verification failed' }, 401, request);
        }
      }

      // ── OAuth Redirect Flow (server-side fallback for blocked GSI) ──
      if (path === '/auth/google-redirect') {
        const clientId = (env.GOOGLE_CLIENT_ID || '').split(',')[0].split(' ')[0].trim();
        if (!clientId) return json({ error: 'Google auth not configured' }, 503, request);
        const state = crypto.randomUUID();
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: 'https://api.thyfwxit.com/auth/google-callback',
          scope: 'openid email profile',
          access_type: 'online',
          prompt: 'select_account',
          state,
        });
        const resp = new Response(null, { status: 302, headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, ...corsHeaders(request) } });
        resp.headers.set('Set-Cookie', `oauth_state=${state}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
        return resp;
      }

      if (path === '/auth/google-callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const cookies = request.headers.get('Cookie') || '';
        const cookieState = (cookies.match(/oauth_state=([^;]+)/) || [])[1];
        if (!code) return json({ error: 'Missing code' }, 400, request);
        if (!state || state !== cookieState) return json({ error: 'State mismatch' }, 400, request);

        const clientId = (env.GOOGLE_CLIENT_ID || '').split(',')[0].split(' ')[0].trim();
        const clientSecret = env.GOOGLE_CLIENT_SECRET || '';

        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: 'https://api.thyfwxit.com/auth/google-callback',
            grant_type: 'authorization_code',
          }),
        });
        if (!tokenRes.ok) return json({ error: 'Token exchange failed' }, 502, request);
        const tokens = await tokenRes.json();
        const idToken = tokens.id_token;
        if (!idToken) return json({ error: 'No ID token' }, 502, request);

        // Verify
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        if (!verifyRes.ok) return json({ error: 'Verification failed' }, 401, request);
        const idinfo = await verifyRes.json();
        if (idinfo.aud !== clientId) return json({ error: 'Audience mismatch' }, 401, request);
        // Reject sessions whose Google email is not verified.
        if (idinfo.email_verified !== 'true' && idinfo.email_verified !== true) {
          return json({ error: 'Email not verified by Google' }, 401, request);
        }

        const payload = {
          sub: idinfo.sub, name: idinfo.name || 'Player',
          email: idinfo.email || '', picture: idinfo.picture || '',
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600),
        };
        const token = await signJWT(payload, env.SECRET_KEY);
        const ownerCheck = payload.email.toLowerCase() === (env.OWNER_EMAIL || '').toLowerCase();
        const userBlob = encodeURIComponent(JSON.stringify({ sub: payload.sub, name: payload.name, email: payload.email, picture: payload.picture, is_owner: ownerCheck }));

        const resp = new Response(null, { status: 303, headers: { Location: 'https://thyfwxit.com/nexus/' } });
        resp.headers.append('Set-Cookie', `nexus_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${30*24*3600}; Domain=.thyfwxit.com`);
        resp.headers.append('Set-Cookie', `nexus_user_pickup=${userBlob}; Path=/; Secure; SameSite=None; Max-Age=60; Domain=.thyfwxit.com`);
        resp.headers.append('Set-Cookie', 'oauth_state=; Path=/auth; Max-Age=0');
        return resp;
      }

      // ── Guest Auth ──────────────────────────────────────────────────
      if (path === '/auth/guest' && method === 'POST') {
        // Block banned/blocked IPs from using guest mode as a bypass
        const guestIp = request.headers.get('CF-Connecting-IP') || '';
        const guestBlockedIps = JSON.parse(await env.NEXUS_KV.get('blocked_ips') || '[]');
        if (guestBlockedIps.includes(guestIp)) {
          return json({ ok: false, error: 'Your IP has been blocked.' }, 403, request);
        }
        const guestBannedIps = JSON.parse(await env.NEXUS_KV.get('banned_account_ips') || '[]');
        if (guestBannedIps.includes(guestIp)) {
          return json({ ok: false, error: 'Access denied.' }, 403, request);
        }
        // Check device fingerprint
        const guestBody = await request.json();
        const guestFp = (guestBody.fingerprint || '').slice(0, 20);
        if (guestFp) {
          const bannedFps = JSON.parse(await env.NEXUS_KV.get('banned_fingerprints') || '[]');
          if (bannedFps.includes(guestFp)) {
            return json({ ok: false, error: 'Access denied.' }, 403, request);
          }
        }

        const payload = {
          sub: 'guest-' + Date.now().toString(36),
          name: 'Guest',
          email: 'guest@local',
          picture: '',
          exp: Math.floor(Date.now() / 1000) + (24 * 3600),
        };
        const token = await signJWT(payload, env.SECRET_KEY);
        const resp = json({ ok: true, name: 'Guest', email: 'guest@local', picture: '', is_owner: false }, 200, request);
        resp.headers.set('Set-Cookie', `nexus_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${24*3600}; Domain=.thyfwxit.com`);
        return resp;
      }

      // ── Page Summarizer (Gemini) ────────────────────────────────────
      // Powers the "TL;DR" button on portfolio pages. Takes the page text,
      // returns a 3 to 4 sentence summary. Rate limited per IP per day to
      // bound the Gemini bill against spam clicks.
      if (path === '/api/summarize' && method === 'POST') {
        const origin = request.headers.get('Origin') || '';
        if (!ALLOWED_ORIGINS.includes(origin)) {
          return json({ error: 'Unauthorized' }, 403, request);
        }

        // Rate limit: 30 summaries per IP per day. Cache hits don't count.
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        const day = new Date().toISOString().slice(0, 10);
        const rateKey = `summary:ip:${clientIp}:${day}`;
        const count = parseInt(await env.NEXUS_KV.get(rateKey) || '0', 10);
        if (count >= 30) {
          return json({ error: 'Daily limit reached. Try again tomorrow.' }, 429, request);
        }

        const body = await request.json().catch(() => ({}));
        // Reduced input cap from 50000 to 8000 chars. The TL;DR is 3-4
        // sentences; extra content past 8K rarely changes the output but
        // multiplies token cost 6x.
        const content = (body.content || '').slice(0, 8000);
        const pageUrl = (body.url || '').slice(0, 200);
        if (!content || content.length < 50) {
          return json({ error: 'Not enough content to summarize.' }, 400, request);
        }

        if (!env.GEMINI_API_KEY) {
          return json({ error: 'Summary service not configured.' }, 503, request);
        }

        // Cost optimization: cache the summary by URL+content hash for 24h.
        // Repeat visitors to the same page pay zero Gemini cost. Most TL;DR
        // clicks on a stable site are duplicates.
        async function sha1(s) {
          const data = new TextEncoder().encode(s);
          const buf = await crypto.subtle.digest('SHA-1', data);
          return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        const cacheKey = `summary:cache:${await sha1(pageUrl + '|' + content.slice(0, 4000))}`;
        const cached = await env.NEXUS_KV.get(cacheKey);
        if (cached) {
          return json({ summary: cached, remaining: 30 - count, cached: true }, 200, request);
        }

        const prompt = `You are summarizing a page from thyfwxit.com, a solo developer's portfolio. Write 4 to 5 short sentences in plain conversational language, like you're telling a friend what the page is about.

RULES:
- Lead with the most specific, concrete thing on the page (project name, post title, real fact)
- Use the developer's voice: direct, lowercase okay, no corporate spin
- NEVER use phrases like "this page covers", "in summary", "delves into", "explores", "showcases", "is dedicated to"
- NEVER start with "The page" or "This page"
- If the page has technical details (tools, stack, numbers), include at least one
- Avoid bullet points; prose only

URL: ${pageUrl}

PAGE CONTENT:
${content}`;

        try {
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
            method: 'POST',
            headers: {
              'x-goog-api-key': env.GEMINI_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 260 },
            }),
          });
          const data = await r.json();
          const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!summary) {
            console.log('[SUMMARIZE] empty response from Gemini');
            return json({ error: 'No summary returned.' }, 500, request);
          }
          const cleanSummary = summary.trim();
          // Cache the result for 24h. Increment user counter only on success.
          await env.NEXUS_KV.put(cacheKey, cleanSummary, { expirationTtl: 86400 });
          await env.NEXUS_KV.put(rateKey, String(count + 1), { expirationTtl: 86400 * 2 });
          return json({ summary: cleanSummary, remaining: 29 - count, cached: false }, 200, request);
        } catch (e) {
          console.log('[SUMMARIZE ERROR]', e.message);
          return json({ error: 'Summarization failed.' }, 500, request);
        }
      }

      // ── Conversation Logging (Discord) ──────────────────────────────
      if (path === '/api/log-conversation' && method === 'POST') {
        // Origin gate: prevent anyone from spamming the Discord webhook.
        const origin = request.headers.get('Origin') || '';
        if (!ALLOWED_ORIGINS.includes(origin)) {
          return json({ ok: false, error: 'Unauthorized — invalid origin' }, 403, request);
        }
        const body = await request.json();
        const webhook = env.DISCORD_WEBHOOK || '';
        if (!webhook.startsWith('https://')) return json({ ok: false, error: 'no webhook' }, 200, request);

        const userName = (body.user_name || 'Guest').slice(0, 60);
        const prompt = (body.prompt || '').slice(0, 800);
        const reply = (body.reply || '').slice(0, 1400);
        const mode = (body.mode || '?').slice(0, 32);
        const fp = (body.fingerprint || '').slice(0, 20);
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

        const embed = {
          title: `${userName} · ${mode}`,
          description: `**User:** ${prompt}\n\n**AI:** ${reply.slice(0, 500)}`,
          color: 0x00FFFF,
          footer: { text: `IP: ${ip}` + (fp ? ` · fp:${fp}` : '') + ` · ${new Date().toISOString()}` },
        };

        ctx.waitUntil(
          fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
          }).catch(() => {})
        );

        return json({ ok: true }, 200, request);
      }

      // ── Leaderboard ─────────────────────────────────────────────────
      if (path === '/api/leaderboard' && method === 'GET') {
        const allGames = ['wordle','snake_classic','snake_speed','snake_endless','snake_stealth','pong','flappy','breakout','invaders','mines','typing','mancala_hard_streak'];
        const result = {};
        for (const g of allGames) {
          const entries = JSON.parse(await env.NEXUS_KV.get(`lb:${g}`) || '[]');
          result[g] = entries;
        }
        return json({ period: 'all', games: result }, 200, request);
      }

      if (path.startsWith('/api/leaderboard/') && !path.includes('submit') && method === 'GET') {
        const game = decodeURIComponent(path.split('/api/leaderboard/')[1]?.split('?')[0] || '');
        const entries = JSON.parse(await env.NEXUS_KV.get(`lb:${game}`) || '[]');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        return json({ game, period: 'all', entries: entries.slice(0, limit) }, 200, request);
      }

      if (path === '/api/leaderboard/submit' && method === 'POST') {
        const session = await getSession(request, env);
        const body = await request.json();
        const game = (body.game || '').trim();
        const score = parseInt(body.score || '0');
        if (!game || !score) return json({ ok: false, error: 'missing game or score' }, 400, request);
        // Allowlist: stop attackers polluting KV with arbitrary lb:* keys.
        const allowedLbGames = ['wordle','snake_classic','snake_speed','snake_endless','snake_stealth','pong','flappy','breakout','invaders','mines','typing','mancala_hard_streak'];
        if (!allowedLbGames.includes(game)) return json({ ok: false, error: 'unknown game' }, 400, request);

        const handle = session ? (await env.NEXUS_KV.get(`handle:${session.sub}`) || session.name || 'Anonymous') : 'Guest';
        const entries = JSON.parse(await env.NEXUS_KV.get(`lb:${game}`) || '[]');
        entries.push({ handle, score, ts: new Date().toISOString() });
        entries.sort((a, b) => b.score - a.score);
        const trimmed = entries.slice(0, 100); // keep top 100
        await env.NEXUS_KV.put(`lb:${game}`, JSON.stringify(trimmed));
        console.log(`[LEADERBOARD] ${game}: ${score} by ${handle}`);
        return json({ ok: true }, 200, request);
      }

      // ── Ban management ──────────────────────────────────────────────
      if (path === '/api/dev/banned-accounts') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const banned = JSON.parse(await env.NEXUS_KV.get('banned_accounts') || '[]');
        return json({ ok: true, banned }, 200, request);
      }

      if (path === '/api/dev/ban-account' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const email = (body.email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) return json({ error: 'invalid email' }, 400, request);
        const banned = JSON.parse(await env.NEXUS_KV.get('banned_accounts') || '[]');
        if (!banned.includes(email)) banned.push(email);
        await env.NEXUS_KV.put('banned_accounts', JSON.stringify(banned));
        // Store their IP and fingerprint to prevent guest/network bypass
        const banIp = (body.ip || '').trim();
        if (banIp) {
          const bannedIps = JSON.parse(await env.NEXUS_KV.get('banned_account_ips') || '[]');
          if (!bannedIps.includes(banIp)) bannedIps.push(banIp);
          await env.NEXUS_KV.put('banned_account_ips', JSON.stringify(bannedIps));
        }
        const banFp = (body.fingerprint || '').trim();
        if (banFp) {
          const bannedFps = JSON.parse(await env.NEXUS_KV.get('banned_fingerprints') || '[]');
          if (!bannedFps.includes(banFp)) bannedFps.push(banFp);
          await env.NEXUS_KV.put('banned_fingerprints', JSON.stringify(bannedFps));
        }
        console.log(`[BAN] Account banned: ${email}` + (banIp ? ` IP: ${banIp}` : '') + (banFp ? ` FP: ${banFp}` : ''));
        return json({ ok: true, banned }, 200, request);
      }

      if (path === '/api/dev/unban-account' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const email = (body.email || '').toLowerCase().trim();
        let banned = JSON.parse(await env.NEXUS_KV.get('banned_accounts') || '[]');
        banned = banned.filter(e => e !== email);
        await env.NEXUS_KV.put('banned_accounts', JSON.stringify(banned));
        console.log(`[UNBAN] Account unbanned: ${email}`);
        return json({ ok: true, banned }, 200, request);
      }

      // ── DevPanel endpoints ──────────────────────────────────────────
      if (path === '/api/dev/log-tail') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        return json({ ok: true, lines: ['[CF Worker] Log tail not available — use Workers Logs in Cloudflare dashboard'], source: 'worker' }, 200, request);
      }

      if (path === '/api/dev/blocklist') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const blocked = JSON.parse(await env.NEXUS_KV.get('blocked_ips') || '[]');
        return json({ ok: true, blocked_ips: blocked }, 200, request);
      }

      if (path === '/api/dev/block' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const ip = (body.ip || '').trim();
        if (!ip) return json({ error: 'no ip' }, 400, request);
        const blocked = JSON.parse(await env.NEXUS_KV.get('blocked_ips') || '[]');
        if (!blocked.includes(ip)) blocked.push(ip);
        await env.NEXUS_KV.put('blocked_ips', JSON.stringify(blocked));
        return json({ ok: true }, 200, request);
      }

      if (path === '/api/dev/unblock' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const ip = (body.ip || '').trim();
        let blocked = JSON.parse(await env.NEXUS_KV.get('blocked_ips') || '[]');
        blocked = blocked.filter(b => b !== ip);
        await env.NEXUS_KV.put('blocked_ips', JSON.stringify(blocked));
        return json({ ok: true }, 200, request);
      }

      if (path === '/api/dev/premium') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const premium = JSON.parse(await env.NEXUS_KV.get('premium_users') || '[]');
        return json({ ok: true, premium_users: premium }, 200, request);
      }

      if (path === '/api/dev/premium/grant' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const email = (body.email || '').toLowerCase().trim();
        const days = body.days || 30;
        const note = body.note || '';
        if (!email) return json({ error: 'no email' }, 400, request);
        const premium = JSON.parse(await env.NEXUS_KV.get('premium_users') || '[]');
        premium.push({ email, days, note, granted: new Date().toISOString() });
        await env.NEXUS_KV.put('premium_users', JSON.stringify(premium));
        return json({ ok: true }, 200, request);
      }

      if (path === '/api/dev/premium/revoke' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const email = (body.email || '').toLowerCase().trim();
        let premium = JSON.parse(await env.NEXUS_KV.get('premium_users') || '[]');
        premium = premium.filter(p => p.email !== email);
        await env.NEXUS_KV.put('premium_users', JSON.stringify(premium));
        return json({ ok: true }, 200, request);
      }

      if (path === '/api/tools/manifest') {
        return json({ ok: true, tools: [] }, 200, request);
      }

      if (path === '/api/me/handle' && method === 'GET') {
        const session = await getSession(request, env);
        if (!session) return json({ handle: null }, 200, request);
        const handle = await env.NEXUS_KV.get(`handle:${session.sub}`);
        return json({ handle: handle || session.name }, 200, request);
      }

      if (path === '/api/me/handle' && method === 'POST') {
        const session = await getSession(request, env);
        if (!session) return json({ error: 'not signed in' }, 401, request);
        const body = await request.json();
        const handle = (body.handle || '').trim().slice(0, 20);
        if (!handle) return json({ error: 'empty handle' }, 400, request);
        await env.NEXUS_KV.put(`handle:${session.sub}`, handle);
        return json({ ok: true, handle }, 200, request);
      }

      if (path === '/api/me/premium') {
        const session = await getSession(request, env);
        return json({ premium: isOwner(session, env) }, 200, request);
      }

      // ── Image Generation (REST) ────────────────────────────────────
      if (path === '/api/image-gen' && method === 'POST') {
        // Origin gate
        const imgOrigin = request.headers.get('Origin') || '';
        const imgBotSecret = request.headers.get('X-Bot-Secret') || '';
        if (!ALLOWED_ORIGINS.includes(imgOrigin) && !(env.BOT_SECRET && imgBotSecret === env.BOT_SECRET)) {
          return json({ ok: false, error: 'Unauthorized — invalid origin' }, 403, request);
        }

        const session = await getSession(request, env);
        if (!session || (session.email || '') === 'guest@local') {
          return json({ ok: false, error: 'Image generation requires a Google account. Sign in to use it.' }, 403, request);
        }
        // Check ban
        const banned = JSON.parse(await env.NEXUS_KV.get('banned_accounts') || '[]');
        if (banned.includes((session.email || '').toLowerCase())) {
          return json({ ok: false, error: 'Your account has been permanently banned.' }, 403, request);
        }

        const body = await request.json();
        const prompt = (body.prompt || '').trim();
        if (!prompt) return json({ ok: false, error: 'No prompt provided' }, 400, request);

        // Image quota check (owner = unlimited, google = 15/day)
        const owner = isOwner(session, env);
        if (!owner) {
          const today = new Date().toISOString().slice(0, 10);
          const quotaKey = `imgquota:${session.sub}:${today}`;
          const used = parseInt(await env.NEXUS_KV.get(quotaKey) || '0');
          if (used >= 15) {
            return json({ ok: false, error: 'Daily image quota reached (15/day). Try again tomorrow.' }, 429, request);
          }
          // Increment quota
          await env.NEXUS_KV.put(quotaKey, String(used + 1), { expirationTtl: 86400 });
        }

        // Try Replicate first (paid SFW)
        if (env.REPLICATE_API_KEY) {
          try {
            const replicateResult = await _replicateGenerate(prompt, env.REPLICATE_API_KEY);
            return json({ ok: true, image_b64: replicateResult.image_b64, source: replicateResult.source }, 200, request);
          } catch (e) {
            console.log(`[REPLICATE FAIL] ${e.message} — falling to Pollinations`);
          }
        }

        // Fallback: Pollinations (free SFW)
        try {
          const pollResult = await _pollinationsGenerate(prompt);
          return json({ ok: true, image_b64: pollResult.image_b64, source: pollResult.source }, 200, request);
        } catch (e) {
          console.log(`[POLLINATIONS FAIL] ${e.message}`);
        }

        return json({ ok: false, error: 'All image providers failed. Try again later.' }, 502, request);
      }

      // ── Lockout system ──────────────────────────────────────────────
      if (path === '/api/lockout/register' && method === 'POST') {
        const session = await getSession(request, env);
        if (isOwner(session, env)) {
          return json({ ok: true, owner_exempt: true }, 200, request);
        }
        const body = await request.json();
        const seconds = Math.max(1, Math.min(parseInt(body.seconds || '0'), 86400)); // cap 24h
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        const email = session ? (session.email || '') : '';
        const unlockAtMs = Date.now() + (seconds * 1000);

        // Load current lockouts
        const lockouts = JSON.parse(await env.NEXUS_KV.get('locked_users') || '{}');
        lockouts[`ip:${clientIp}`] = unlockAtMs;
        if (email && email !== 'guest@local') {
          lockouts[`email:${email}`] = unlockAtMs;
        }
        await env.NEXUS_KV.put('locked_users', JSON.stringify(lockouts));
        return json({ ok: true, unlock_ms: unlockAtMs }, 200, request);
      }

      if (path === '/api/lockout/check') {
        const clientIp = request.headers.get('CF-Connecting-IP') || '';
        const session = await getSession(request, env);
        const email = session ? (session.email || '') : '';
        const result = await _checkLockout(env, clientIp, email);
        return json({ locked: result.locked, remaining_ms: result.remainingMs }, 200, request);
      }

      if (path === '/api/dev/locked-users') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const lockouts = JSON.parse(await env.NEXUS_KV.get('locked_users') || '{}');
        const nowMs = Date.now();
        // GC expired + build list
        const active = [];
        const cleaned = {};
        for (const [k, v] of Object.entries(lockouts)) {
          if (v > nowMs) {
            active.push({ key: k, unlock_ms: v, remaining_sec: Math.round((v - nowMs) / 1000) });
            cleaned[k] = v;
          }
        }
        if (Object.keys(cleaned).length !== Object.keys(lockouts).length) {
          await env.NEXUS_KV.put('locked_users', JSON.stringify(cleaned));
        }
        return json({ locked: active }, 200, request);
      }

      if (path === '/api/dev/revoke-lockout' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const key = (body.key || '').trim();
        if (!key) return json({ error: 'missing key' }, 400, request);
        const lockouts = JSON.parse(await env.NEXUS_KV.get('locked_users') || '{}');
        const existed = key in lockouts;
        delete lockouts[key];
        await env.NEXUS_KV.put('locked_users', JSON.stringify(lockouts));
        return json({ ok: true, revoked: existed, key }, 200, request);
      }

      // ── Moderation alert ────────────────────────────────────────────
      if (path === '/api/moderation-alert' && method === 'POST') {
        // Origin gate: prevent anyone from spamming fake moderation alerts.
        const origin = request.headers.get('Origin') || '';
        if (!ALLOWED_ORIGINS.includes(origin)) {
          return json({ ok: false, error: 'Unauthorized — invalid origin' }, 403, request);
        }
        const body = await request.json();
        const webhook = env.DISCORD_WEBHOOK || '';
        if (!webhook.startsWith('https://')) return json({ ok: false, error: 'no webhook' }, 200, request);

        const severity = (body.severity || 'medium').toLowerCase();
        const kind = body.kind || 'UNKNOWN';
        const userName = (body.user_name || '?').slice(0, 60);
        const userEmail = (body.user_email || '?').slice(0, 120);
        const sample = String(body.sample || body.seconds || '').slice(0, 600);
        const mode = (body.mode || '?').slice(0, 32);
        const sessionId = (body.session || '?').slice(0, 40);
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

        const colors = { critical: 0xff0000, high: 0xff8800, medium: 0xffcc00, low: 0xaaaaaa };
        const emojis = { critical: '🚨', high: '⚠️', medium: '⚠️', low: 'ℹ️' };
        const botNames = {
          critical: '🚨 NEXUS · CRITICAL',
          high: '⚠️ NEXUS · ATTENTION',
          medium: 'NEXUS · MODERATION',
          low: 'NEXUS · INFO',
        };

        const embed = {
          title: `${emojis[severity] || '⚠️'} ${kind} · ${severity.toUpperCase()}`,
          color: colors[severity] || 0xff8800,
          description: `**User:** ${userName} (${userEmail})\n**Session:** \`${sessionId}\` · **Mode:** ${mode}\n**IP:** \`${clientIp}\`\n**Detail:** \`\`\`${sample}\`\`\``,
          timestamp: new Date().toISOString(),
        };

        const payload = {
          username: botNames[severity] || 'NEXUS · MODERATION',
          embeds: [embed],
          allowed_mentions: { parse: [] },
        };

        ctx.waitUntil(
          fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {})
        );

        return json({ ok: true }, 200, request);
      }

      // ── Report endpoint ─────────────────────────────────────────────
      if (path === '/api/report' && method === 'POST') {
        // Origin gate: prevent anyone from sending fake user reports.
        const origin = request.headers.get('Origin') || '';
        if (!ALLOWED_ORIGINS.includes(origin)) {
          return json({ ok: false, error: 'Unauthorized — invalid origin' }, 403, request);
        }
        const body = await request.json();
        const webhook = env.DISCORD_WEBHOOK || '';
        if (!webhook.startsWith('https://')) return json({ ok: false, error: 'no webhook' }, 200, request);

        const reporter = (body.reporter || 'Anonymous').slice(0, 60);
        const reason = (body.reason || 'No reason given').slice(0, 500);
        const target = (body.target || '').slice(0, 120);

        const embed = {
          title: '📋 User Report',
          color: 0x3498db,
          description: `**Reporter:** ${reporter}\n**Target:** ${target}\n**Reason:** ${reason}`,
          timestamp: new Date().toISOString(),
        };

        ctx.waitUntil(
          fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'NEXUS · REPORTS', embeds: [embed], allowed_mentions: { parse: [] } }),
          }).catch(() => {})
        );

        return json({ ok: true }, 200, request);
      }

      // ── Dev-owner auth (localhost only) ──────────────────────────────
      if (path === '/auth/dev-owner' && method === 'POST') {
        const clientIp = request.headers.get('CF-Connecting-IP') || '';
        // On Workers, localhost requests come from 127.0.0.1 or ::1
        if (!['127.0.0.1', '::1'].includes(clientIp)) {
          return json({ error: 'Dev owner login is restricted to localhost' }, 403, request);
        }
        const payload = {
          sub: 'owner_dev_local',
          name: 'Xavier',
          email: env.OWNER_EMAIL || '',
          picture: '',
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600),
        };
        const token = await signJWT(payload, env.SECRET_KEY);
        console.log(`[AUTH] Dev-owner login: ${payload.name}`);
        const resp = json({ ok: true, name: payload.name, email: payload.email, picture: '', is_owner: true }, 200, request);
        resp.headers.set('Set-Cookie', `nexus_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${30*24*3600}; Domain=.thyfwxit.com`);
        return resp;
      }

      // ── Dev: environment info ───────────────────────────────────────
      if (path === '/api/dev/env') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        return json({
          ok: true,
          env: {
            GROQ_API_KEY: env.GROQ_API_KEY ? '***set***' : 'MISSING',
            GEMINI_API_KEY: env.GEMINI_API_KEY ? '***set***' : 'MISSING',
            HF_API_KEY: env.HF_API_KEY ? '***set***' : 'MISSING',
            REPLICATE_API_KEY: env.REPLICATE_API_KEY ? '***set***' : 'MISSING',
            GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ? '***set***' : 'MISSING',
            GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ? '***set***' : 'MISSING',
            SECRET_KEY: env.SECRET_KEY ? '***set***' : 'MISSING',
            OWNER_EMAIL: env.OWNER_EMAIL ? '***set***' : 'MISSING',
            DISCORD_WEBHOOK: env.DISCORD_WEBHOOK ? '***set***' : 'MISSING',
            ENVIRONMENT: env.ENVIRONMENT || 'unknown',
            NEXUS_VERSION: env.NEXUS_VERSION || '?',
          },
        }, 200, request);
      }

      // ── Dev: image model config ─────────────────────────────────────
      if (path === '/api/dev/image-models' && method === 'GET') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const overrides = JSON.parse(await env.NEXUS_KV.get('image_model_overrides') || '{}');
        return json({
          ok: true,
          current: {
            replicate_model: overrides.replicate_model || 'black-forest-labs/flux-schnell',
            pollinations_model: overrides.pollinations_model || 'flux',
          },
          replicate_options: [
            'black-forest-labs/flux-schnell',
            'stability-ai/sdxl',
            'bytedance/sdxl-lightning-4step',
            'lucataco/realistic-vision-v5.1',
          ],
        }, 200, request);
      }

      if (path === '/api/dev/image-models' && method === 'POST') {
        const session = await getSession(request, env);
        if (!isOwner(session, env)) return json({ error: 'owner only' }, 403, request);
        const body = await request.json();
        const overrides = {
          replicate_model: (body.replicate_model || '').trim(),
          pollinations_model: (body.pollinations_model || '').trim(),
        };
        await env.NEXUS_KV.put('image_model_overrides', JSON.stringify(overrides));
        return json({ ok: true, saved: overrides }, 200, request);
      }

      // ── 404 ─────────────────────────────────────────────────────────
      return json({ error: 'Not found', path }, 404, request);

    } catch (err) {
      console.error('[WORKER ERROR]', err.message, err.stack);
      return json({ error: 'Internal server error' }, 500, request);
    }
  },
};
