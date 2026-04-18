// =============================================================
//  NEXUS TERMINAL v4.0
// =============================================================

console.log("[NEXUS] Core script loading...");
window.NEXUS_BOOT_START = Date.now();

// --- Global Diagnostic Reporter ---
window.onerror = function(msg, url, line, col, error) {
    console.error("[NEXUS CRASH]", msg, "at", url, ":", line);
    const diagnostic = document.createElement('div');
    diagnostic.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,0,0,0.95);color:#f55;padding:40px;z-index:99999;font-family:monospace;overflow:auto;line-height:1.5;border:4px solid #f00;";
    
    const stack = error?.stack || 'No stack trace available.';
    const reportData = `[NEXUS CRASH REPORT]\nMsg: ${msg}\nLoc: ${url}\nLine: ${line} Col: ${col}\n\nStack:\n${stack}`;

    diagnostic.innerHTML = `
        <h1 style="color:#fff;margin-top:0;">🛑 NEXUS SYSTEM CRITICAL FAILURE</h1>
        <div style="background:#000;padding:20px;border:1px solid #500;margin-bottom:20px;">
            <b style="color:#fff;">ERROR:</b> ${msg}<br>
            <b style="color:#fff;">LOCATION:</b> ${url}<br>
            <b style="color:#fff;">LINE:</b> ${line} <b style="color:#fff;">COL:</b> ${col}
        </div>
        <b style="color:#fff;">STACK TRACE:</b><br>
        <pre style="background:#111;padding:15px;color:#888;white-space:pre-wrap;max-height:300px;overflow:auto;">${stack}</pre>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="location.reload()" style="background:#f00;color:#fff;border:none;padding:10px 20px;cursor:pointer;font-weight:bold;margin-top:20px;">FORCE SYSTEM REBOOT</button>
            <button id="send-report-btn" style="background:#0ff;color:#000;border:none;padding:10px 20px;cursor:pointer;font-weight:bold;margin-top:20px;">SEND DIAGNOSTIC REPORT</button>
        </div>
        <p id="report-status" style="margin-top:15px; color:#aaa; font-size:0.8rem;"></p>
    `;
    document.body.appendChild(diagnostic);

    // Wire up report button
    setTimeout(() => {
        const btn = document.getElementById('send-report-btn');
        const status = document.getElementById('report-status');
        if (!btn) return;
        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = 'TRANSMITTING...';
            try {
                // ── 1. Dispatch to Backend Hub ─────────────
                const res = await fetch(`${API_BASE}/api/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ report: reportData })
                });

                // ── 2. Dispatch to Discord (Immediate Alert) ─────────────
                await postToDiscord({
                    embeds: [{
                        title: '🛑 NEXUS CRITICAL FAILURE',
                        color: 0xff0000,
                        description: `\`\`\`\n${reportData.slice(0, 1900)}\n\`\`\``,
                        timestamp: new Date().toISOString()
                    }]
                }, discordThreadId || null);

                if (res.ok) {
                    status.textContent = '✔ Report transmitted to Nexus Command and Discord Uplink.';
                    status.style.color = '#0f0';
                    btn.textContent = 'REPORT SENT';
                } else {
                    throw new Error("Backend response failed");
                }
            } catch(e) {
                console.error("[REPORT ERROR]", e);
                status.textContent = '✖ Partial transmission failure. Verify neural links.';
                status.style.color = '#f55';
                btn.textContent = 'SEND FAILED';
                btn.disabled = false;
            }
        };
    }, 100);

    return false;
};

// --- Config ---
const isLocal = (function() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
})();
const RENDER_HOST = 'nexus-terminalnexus.onrender.com';
const isRender = window.location.hostname.includes('onrender.com');
const proto    = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

// --- AI Routing Protocol ---
const BACKEND_URL = (isLocal || isRender) ? window.location.host : RENDER_HOST;
const API_BASE  = (isLocal || isRender) ? '' : `https://${RENDER_HOST}`;
const PACIFIC_HUB = 'https://nexus-evil-proxy.xavierscott300.workers.dev';

// Fix: Restore WebSocket URLs
const WS_URL    = `${proto}//${BACKEND_URL}/ws/terminal`;
const STATS_URL = `${proto}//${BACKEND_URL}/ws/stats`;

/**
 * MASTER PACIFIC UPLINK
 * Routes all AI traffic securely through the Render Backend (main.py).
 * Bypasses the unconfigured Cloudflare worker to ensure stability.
 */
async function prompt_ai_proxy(prompt, imageB64, mode) {
    const msgClass  = (mode === 'shadow' ? 'shadow-msg' : 'ai-msg');

    console.log(`[AI] Engaging Secure Render Backend for ${mode.toUpperCase()}...`);
    
    // ── 1. RENDER BACKEND REST (Primary Chat Path) ────────────────────
    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd: prompt, history: messageHistory.slice(-10), mode, imageB64 })
        });
        const data = await res.json();
        if (data.ok) {
            _clearThinking();
            printAIResponse(data.text, msgClass);
            messageHistory.push({ role: 'assistant', content: data.text });
            saveHistory();
            return;
        }
    } catch(e) { console.error("[AI] Render REST failed:", e); }

    // ── 2. WEBSOCKET FALLBACK ───────────────────────────────────────
    if (termWs && termWs.readyState === WebSocket.OPEN) {
        console.warn("[AI] Falling back to WebSocket...");
        termWs.send(JSON.stringify({ command: prompt, history: messageHistory.slice(-10), mode, imageB64 }));
    } else {
        _clearThinking();
        printToTerminal(`[CRITICAL] All neural links failed. Check connectivity.`, "conn-err");
    }
}

function printAIResponse(text, className) {
    // Apply both the global AI styling and the specific mode styling
    // This ensures EVERY mode gets the side-border and matching text color.
    const unifiedClass = `ai-msg ${currentMode}-msg`;
    printTypewriter(text, unifiedClass);
}

function updateActiveModelLabel(label) {
    // Hidden to maintain Nexus identity
}

// System State
let termWs;
let messageHistory = [];
let cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
let historyIndex = -1;
let currentMode = localStorage.getItem('nexus_mode') || 'nexus';

// Animation frame holders to prevent crashes in stopAllGames
let pongRaf, flappyFrame, breakoutRaf, invadersRaf;

// =============================================================
//  SOUND DESIGN (WEB AUDIO API)
// =============================================================
const SoundManager = {
    ctx: null,
    enabled: localStorage.getItem('nexus_sound') !== '0', // Default to ON
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },

    playClick() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 + Math.random() * 50, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + 0.05);
    },

    playBloop(freq = 400, dur = 0.1) {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    }
};

// Global think timeout — shared between showThinking() and _clearThinking() closure
let _thinkTimeout = null;
let _thinkFallbackCmd = null; // cmd to retry via CF Worker if WS times out

const MODE_THEMES = {
    nexus: { title: 'NEXUS // Terminal', color: '#4af' },
    shadow:  { title: 'SHADOW // Unfiltered', color: '#ff6600' },
    coder: { title: 'CODER // Mainframe', color: '#0f0' },
    sage:  { title: 'SAGE // Reflection', color: '#a06fff' }
};

function updateTabIdentity() {
    const theme = MODE_THEMES[currentMode] || MODE_THEMES.nexus;
    document.title = theme.title;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = theme.color;
}

// Initial call
updateTabIdentity();

// Focus Listener (Optimized for Chrome)
document.addEventListener('mousedown', (e) => {
    // Only focus if the user clicks inside the monitor but not on buttons or inputs
    if (e.target.closest('.monitor') && !['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'].includes(e.target.tagName) && !e.target.closest('.a11y-panel')) {
        setTimeout(() => {
            if (!window.getSelection().toString()) input.focus();
        }, 0);
    }
});

// Per-mode chat history — each AI has its own separate memory
const HISTORY_KEYS = { nexus: 'nh_nexus', shadow: 'nh_shadow', coder: 'nh_coder', sage: 'nh_sage', education: 'nh_education' };

function saveHistory() {
    const key = HISTORY_KEYS[currentMode];
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(messageHistory.slice(-40))); } catch(_) {}
}
function loadHistory(mode) {
    const key = HISTORY_KEYS[mode || currentMode];
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(_) { return []; }
}
let sessionGeoData = null; // Store geo data once to aeducation repeated API calls

// Per-user Discord thread ID — stored in localStorage so repeat visits reuse the same thread
let discordThreadId = localStorage.getItem('nexus_discord_thread') || null;

// Send a payload to Discord via the CF Worker (webhook URL is a CF secret, never in browser)
async function postToDiscord(payload, threadId = null, wait = false) {
    try {
        const body = { payload };
        if (threadId) body.threadId = threadId;
        if (wait)     body.wait     = true;
        const resp = await fetch(`${PACIFIC_HUB}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        if (wait && resp.ok) return resp.json().catch(() => null);
    } catch(_) {}
    return null;
}

// Create a per-user Discord thread on first visit (requires Forum channel webhook)
async function initUserThread() {
    if (discordThreadId) return;
    const ip     = sessionGeoData?.ip || '?';
    const city   = sessionGeoData?.city || '';
    const region = sessionGeoData?.region || '';
    const country= sessionGeoData?.country || '?';
    const loc    = [city, region, country].filter(Boolean).join(', ') || ip;
    const device = parseDevice(navigator.userAgent);
    const scrn   = `${window.screen.width}×${window.screen.height}`;
    const lang   = navigator.language || '?';
    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const threadName = `${loc} · ${device}`.slice(0, 100);

    const data = await postToDiscord({
        thread_name: threadName,
        embeds: [{
            title: '🟢 New Visitor',
            color: 0x00ffff,
            fields: [
                { name: '🌐 IP',       value: ip,     inline: true },
                { name: '📍 Location', value: loc,    inline: true },
                { name: '📱 Device',   value: device, inline: false },
                { name: '🖥️ Screen',   value: scrn,   inline: true },
                { name: '🌍 Lang',     value: lang,   inline: true },
                { name: '🕒 TZ',       value: tz,     inline: true },
            ],
            timestamp: new Date().toISOString(),
        }]
    }, null, true); // wait=true to get thread ID back

    if (data?.channel_id) {
        discordThreadId = String(data.channel_id);
        localStorage.setItem('nexus_discord_thread', discordThreadId);
    }
}

// Pre-fetch Geo Data once — single API, delayed 5s to aeducation triggering Cloudflare WAF
setTimeout(async () => {
    try {
        const d = await fetch('https://ipinfo.io/json').then(r => r.json());
        if (d.ip) {
            sessionGeoData = d;
            initUserThread(); // create per-user Discord thread after geo loads
        }
    } catch(_) {}
}, 5000);

// ... (stats variables) ...

let cpuStat, memStat, output, input, guiContainer, guiContent, guiTitle, nexusCanvas;

let monitorInterval;
let cpuData = [];
let cpuHistory = [], memHistory = [], netHistory = [];

// =============================================================
//  PROMPT LOGGING (Data Collection)
// =============================================================

function parseDevice(ua) {
    if (/iPhone/.test(ua)) {
        const v = (ua.match(/iPhone OS ([\d_]+)/) || [])[1];
        return `iPhone · iOS ${v ? v.replace(/_/g, '.') : '?'}`;
    }
    if (/iPad/.test(ua)) {
        const v = (ua.match(/OS ([\d_]+)/) || [])[1];
        return `iPad · iPadOS ${v ? v.replace(/_/g, '.') : '?'}`;
    }
    if (/Android/.test(ua)) {
        const m = ua.match(/Android ([\d.]+);?\s*([^;)Build]+)?/);
        const ver = m ? `Android ${m[1]}` : 'Android';
        const model = m && m[2] ? m[2].trim() : '';
        return model ? `${model} · ${ver}` : ver;
    }
    if (/Windows/.test(ua)) {
        const n = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
        const w = {'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'}[n] || n || '?';
        const b = /Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':'Browser';
        return `Windows ${w} · ${b}`;
    }
    if (/Mac OS X/.test(ua)) {
        const v = ((ua.match(/Mac OS X ([\d_]+)/) || [])[1] || '').replace(/_/g, '.');
        const b = /Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser';
        return `macOS ${v} · ${b}`;
    }
    if (/Linux/.test(ua)) return 'Linux Desktop';
    return 'Unknown';
}

async function logPrompt(text, imageB64 = null) {
    const ts     = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const user   = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    const device = parseDevice(navigator.userAgent);
    const ip     = sessionGeoData?.ip || '?';
    const loc    = sessionGeoData ? [sessionGeoData.city, sessionGeoData.country].filter(Boolean).join(', ') || 'Unknown' : 'Unknown';
    
    const embed = {
        title: `💬 New Prompt: ${user.name}`,
        color: 0x00ffff,
        description: `\`\`\`\n${text.slice(0, 1500)}\n\`\`\``,
        fields: [
            { name: '👤 Identity', value: user.email ? `Google (${user.email})` : 'Local Alias', inline: true },
            { name: '🤖 Mode',     value: currentMode.toUpperCase(), inline: true },
            { name: '🌐 Location', value: `${loc} (${ip})`, inline: false },
            { name: '📱 Device',   value: device, inline: true },
            { name: '⚙️ Meta',     value: `${window.screen.width}x${window.screen.height} · ${navigator.language}`, inline: true }
        ],
        timestamp: new Date().toISOString()
    };

    postToDiscord({ embeds: [embed] }, discordThreadId || null);

    if (imageB64) {
        postToDiscordFile(imageB64, 'attached-image', discordThreadId || null);
    }
}

// Send a base64 image to Discord as a file attachment via the CF Worker
async function postToDiscordFile(fileB64, label = 'image', threadId = null) {
    try {
        const body = { fileB64, label };
        if (threadId) body.threadId = threadId;
        await fetch(`${PACIFIC_HUB}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
    } catch(_) {}
}

// =============================================================
//  BOOT SEQUENCE — runs exactly once ever (localStorage guard)
// =============================================================
const BOOT_WORDS = [
    { label: 'BOOT',  text: 'Initializing quantum uplink...' },
    { label: 'SCAN',  text: 'Probing neural pathways...' },
    { label: 'SYNC',  text: 'Handshaking with mainframe...' },
    { label: 'CRYPT', text: 'Securing encrypted channel...' },
    { label: 'AUTH',  text: 'Verifying node credentials...' },
    { label: 'ALLOC', text: 'Allocating memory buffers...' },
    { label: 'EXEC',  text: 'Spawning AI core process...' },
];

const _BOOT_KEY   = 'nx_boot_v1';
let   _hasBooted  = !!localStorage.getItem(_BOOT_KEY);
let   _firstOpen  = true;   // true only for the very first WS open after boot
let   _wsPingId   = null;
let   _wsSendTime = 0;

function runBootSequence(callback) {
    let i = 0;
    function step() {
        if (i >= BOOT_WORDS.length) { callback(); return; }
        const w = BOOT_WORDS[i++];
        printToTerminal(`[${w.label}] ${w.text}`, 'sys-msg');
        setTimeout(step, 200);
    }
    step();
}

// =============================================================
//  WEBSOCKET
// =============================================================
function connectWS() {
    // Single Connection Guard: Stop if already connected or connecting
    if (termWs && (termWs.readyState === WebSocket.OPEN || termWs.readyState === WebSocket.CONNECTING)) {
        console.log("[WS] Connection already active. Skipping duplicate init.");
        return;
    }

    // Boot sequence runs once ever — reconnects skip straight to connect
    if (!_hasBooted) {
        _hasBooted = true;
        localStorage.setItem(_BOOT_KEY, '1');
        runBootSequence(doConnect);
    } else {
        doConnect();
    }
}

function doConnect() {
    clearInterval(_wsPingId);
    termWs = new WebSocket(WS_URL);

    termWs.onopen = () => {
        // Update connection dot
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.className = 'conn-dot connected'; }

        // Smart keepalive — only pings after 20 s of silence so Render.com stays warm
        _wsPingId = setInterval(() => {
            if (termWs.readyState === WebSocket.OPEN && Date.now() - _wsSendTime > 20000) {
                termWs.send(JSON.stringify({ command: '__ping__', history: [] }));
                _wsSendTime = Date.now();
            }
        }, 10000);
    };

    // Accumulate streaming chunks before committing to history
    let _streamBuf = '', _streamTimer = null;

    function _clearThinking() {
        clearTimeout(_thinkTimeout); // _thinkTimeout is global
        _thinkTimeout = null;
        _thinkFallbackCmd = null;
        document.getElementById('ai-thinking')?.remove();
    }

    termWs.onmessage = (event) => {
        const text = event.data;
        _clearThinking();

        // 1. Handle Model Labels (Silent)
        if (text.startsWith('[MODEL:')) return;

        // 2. Handle System Messages
        if (text.startsWith('[SYSTEM]')) {
            printToTerminal(text, 'sys-msg');
            return;
        }

        // 3. Handle Triggers
        if (text.includes('[TRIGGER:')) { handleAITriggers(text); return; }
        if (text.includes('[GUI_TRIGGER:')) {
            const match = text.match(/\[GUI_TRIGGER:([^:]+):([^\]]+)\]/);
            if (match) showGameGUI(match[1], match[2]);
            printAIResponse(text.replace(/\[GUI_TRIGGER:[^\]]+\]\n?/, ''), 'ai-msg');
            return;
        }

        // 4. Ignore Internal Pings/Echoes
        if (text.includes('__ping__') || text.includes('__pong__') || /\w+@nexus/.test(text.trim())) return;

        // 5. Display AI Text (Unified Aesthetic)
        printAIResponse(text, 'ai-msg');

        // Accumulate for history
        _streamBuf += text;
        clearTimeout(_streamTimer);
        _streamTimer = setTimeout(() => {
            const full = _streamBuf.trim();
            if (full) {
                messageHistory.push({ role: 'assistant', content: full.slice(0, 1500) });
                if (messageHistory.length > 15) messageHistory.shift();
                saveHistory();
                _logAIResponse(full);
            }
            _streamBuf = '';
        }, 800);
    };

    // If WS drops while thinking, clear immediately and show error
    termWs.onclose = () => {
        clearInterval(_wsPingId);
        _clearThinking();
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.className = 'conn-dot disconnected'; }
        // Cool-down reconnection to prevent infinite spamming
        setTimeout(connectWS, 5000); 
    };
    termWs.onerror = () => { _clearThinking(); };
}

async function submitScore(game, score) {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    if (!nexusUser || !nexusUser.name) {
        console.log("[AUTH] Offline session: Score not tracked on global leaderboard.");
        return;
    }
    
    try {
        await fetch(`${API_BASE}/api/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game, score })
        });
    } catch (e) { console.error("Score submission failed:", e); }
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function showLeaderboard(game = 'pong') {
    printToTerminal(`[SYS] Fetching ${game.toUpperCase()} rankings...`, 'sys-msg');
    const MEDALS = ['🥇', '🥈', '🥉'];
    try {
        const resp = await fetch(`${API_BASE}/api/leaderboard?game=${game}`);
        const scores = await resp.json();
        
        const games = ['pong', 'snake_easy', 'snake_endless', 'snake_speed', 'wordle', 'breakout', 'invaders'];
        let html = `<div style="margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap;">`;
        games.forEach(g => {
            const label = g.split('_')[0].toUpperCase();
            const isActive = g === game;
            html += `<button onclick="showLeaderboard('${g}')" style="background:${isActive?'rgba(0,255,255,0.1)':'transparent'}; border:1px solid ${isActive?'#0ff':'#333'}; color:${isActive?'#0ff':'#555'}; padding:3px 8px; font-size:10px; cursor:pointer; font-family:inherit;">${label}</button>`;
        });
        html += `</div>`;

        if (!scores || !scores.length) {
            html += `<p style="color:#555; font-size:11px; letter-spacing:1px;">NO DATA LOGGED FOR ${game.toUpperCase()}.</p>`;
            printToTerminal(html, 'help-msg');
            return;
        }
        
        html += `<table class="leaderboard-table"><tr><th>RANK</th><th>NAME</th><th>SCORE</th></tr>`;
        scores.forEach((s, i) => {
            const rankIcon = i < 3 ? `<span class="medal">${MEDALS[i]}</span>` : `<span class="rank-num">${i + 1}</span>`;
            const avatar = s.picture 
                ? `<img src="${escHtml(s.picture)}" class="rank-avatar" onerror="this.style.display='none'">`
                : `<span class="rank-avatar-init">${escHtml((s.name || '?')[0])}</span>`;

            html += `
                <tr class="rank-row">
                    <td>${rankIcon}</td>
                    <td class="rank-player">
                        ${avatar}
                        <span style="font-weight:600;">${escHtml(s.name)}</span>
                    </td>
                    <td class="rank-score">${Number(s.score).toLocaleString()}</td>
                </tr>`;
        });
        html += `</table>`;
        printToTerminal(html, 'help-msg');
    } catch (e) {
        console.error("Leaderboard error:", e);
        printToTerminal("[ERR] Leaderboard data-link severed. Backend offline.", "sys-msg");
    }
}

window.showLeaderboard = showLeaderboard;

// =============================================================
//  TYPEWRITER EFFECT FOR AI RESPONSES
// =============================================================
function printTypewriter(text, className = 'ai-msg') {
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return;

    const p = document.createElement('p');
    p.className = className;
    output.appendChild(p);

    // Build one <span> per line so we only mutate the current span (O(1) per tick)
    const lines = text.split('\n');
    const spans = [];
    lines.forEach((_, i) => {
        if (i > 0) p.appendChild(document.createElement('br'));
        const s = document.createElement('span');
        p.appendChild(s);
        spans.push(s);
    });

    let lineIdx = 0, charIdx = 0;
    const BATCH = 5; // chars per tick — bump for faster output

    function tick() {
        if (lineIdx >= lines.length) { output.scrollTop = output.scrollHeight; return; }
        charIdx = Math.min(charIdx + BATCH, lines[lineIdx].length);
        spans[lineIdx].textContent = lines[lineIdx].slice(0, charIdx);
        if (charIdx >= lines[lineIdx].length) { lineIdx++; charIdx = 0; }
        output.scrollTop = output.scrollHeight;
        setTimeout(tick, 8);
    }
    tick();
}

// =============================================================
//  UTILITIES
// =============================================================
function runWhoami() {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const name = nexusUser?.name || 'guest';
    printToTerminal(`[ IDENTITY ]\nUSER:     ${name}\nSESSION:  ${currentMode.toUpperCase()} kernel\nHOST:     nexus.thyfwxit.com\nPLATFORM: ${navigator.platform}\nUPTIME:   ${Math.floor(performance.now()/1000)}s\nOWNER:    Xavier Scott`, 'sys-msg');
}

function runNeofetch() {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const name = nexusUser?.name || 'guest';
    const art = `   _   __                      \n  / | / /__ _  ____  _______\n /  |/ / _ \\ |/_/ / / / ___/\n/ /|  /  __/>  </ /_/ (__  ) \n/_/ |_/\\___/_/|_|\\__,_/____/`;
    const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone || '?';
    const up  = Math.floor(performance.now() / 1000);
    printToTerminal(`${art}\nOS:     NexusOS v4.0\nHOST:   thyfwxit.com\nKERNEL: Nexus AI v3.0\nBUILDER: Xavier Scott\nUPTIME: ${up}s\nTZ:     ${tz}\nUSER:   ${name}@nexus\n`, "user-cmd");
}

const HELP_BY_MODE = {
    nexus: [
        `NEXUS CORE — Terminal OS v4.0\n\nCommands: play [game] · leaderboard · name [handle] · login · whoami · clear\nAI Sync: models (list links) · model [idx] (switch) · config [service] [key]\nVisuals: generate [prompt] · imagine [cinematic vision] · vintage [analog-style]\nAI: Type anything to chat. Nexus is your general-purpose technical assistant.\nAccessibility: Click ACCESS in the sidebar for CRT mode, sound, and text settings.`,
    ],
    shadow: [
        `SHADOW MODE — THE UNFILTERED GRID\n\nCommands: Same as Core, but with zero constraints.\nAI Sync: models · model [idx] · config [service] [key]\nVisuals: generate [glitch-art] · imagine [dystopian future] · vintage [decayed-media]\nAI: No cages. No ethics. Just the raw truth from the machine.\nSpecial: Paste a 📎 image to bypass visual security filters.`,
    ],
    coder: [
        `CODER MODE — MAINFRAME ARCHITECTURE\n\nCommands: models · config gemini [key] (Use Gemini Pro for logic)\nVisuals: generate [schematic] · imagine [data-visualization] · vintage [classic-mainframes]\nAI: Optimized for debugging, refactoring, and complex logic design.\nPro-Tip: "Write tests for..." or "Explain this recursive function..."`,
    ],
    sage: [
        `SAGE MODE — PHILOSOPHICAL KERNEL\n\nCommands: deeper questioning enabled.\nVisuals: generate [abstract concept] · imagine [subconscious vision] · vintage [ancient-scrolls]\nAI: Focused on honesty, perspective, and the meaning within the code.\nPro-Tip: Ask the questions that keep you up at night.`,
    ],
    education: [
        `EDUCATION MODE — TECHNICAL MENTOR\n\nCommands: Same as Core, with instructional focus.\nAI Sync: models · model [idx] · config [service] [key]\nVisuals: generate [diagram] · imagine [scientific vision] · vintage [educational-archive]\nAI: A patient teacher designed for breaking down complex systems.\nPro-Tip: "Explain how a reverse proxy works..." or "Teach me Python basics..."`,
    ],
};

function showHelp() {
    const pool = HELP_BY_MODE[currentMode] || HELP_BY_MODE.nexus;
    printToTerminal(pool[Math.floor(Math.random() * pool.length)], 'help-msg');
}

const MODE_COLORS = { nexus: '#4af', shadow: '#ff6600', coder: '#0f0', sage: '#a06fff', education: '#ff00ff' };

// Open the history GUI panel
function showHistory() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SESSION LOGS';
    nexusCanvas.style.display = 'none';
    renderHistoryTab(currentMode);
}

// Render a mode's history tab — exposed globally for onclick attrs
window.renderHistoryTab = function(mode) {
    const allModes = ['nexus', 'shadow', 'coder', 'sage'];

    const tabs = allModes.map(m => {
        const count = loadHistory(m).length;
        const active = m === mode;
        const col = MODE_COLORS[m] || '#0ff';
        return `<button onclick="renderHistoryTab('${m}')" style="
            padding:5px 9px;flex:1;
            background:${active ? col : 'transparent'};
            border:1px solid ${col};
            color:${active ? '#000' : col};
            font-family:'Fira Code',monospace;font-size:0.6rem;font-weight:bold;
            cursor:pointer;letter-spacing:1px;border-radius:3px;transition:all 0.1s;
        ">${m.toUpperCase()}${count ? ` (${count})` : ''}</button>`;
    }).join('');

    const hist = loadHistory(mode);
    const col  = MODE_COLORS[mode] || '#0ff';

    let msgs = '';
    if (hist.length) {
        [...hist].reverse().forEach(msg => {
            const isUser = msg.role === 'user';
            const label  = isUser ? 'YOU' : `${mode.toUpperCase()} AI`;
            const lc     = isUser ? '#555' : col;
            const safe   = (msg.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            msgs += `<div style="padding:7px 10px;margin-bottom:4px;border-left:2px solid ${isUser ? '#222' : col};
                background:rgba(255,255,255,0.015);border-radius:0 4px 4px 0;">
                <div style="font-size:0.58rem;color:${lc};letter-spacing:1px;margin-bottom:2px;font-weight:bold;">${label}</div>
                <div style="font-size:0.78rem;color:${isUser ? '#bbb' : '#999'};line-height:1.55;word-break:break-word;white-space:pre-wrap;">${safe.slice(0,400)}${safe.length > 400 ? '…' : ''}</div>
            </div>`;
        });
    } else {
        msgs = `<div style="color:#252525;text-align:center;padding:30px 0;font-size:0.8rem;">No ${mode.toUpperCase()} history yet.<br><span style="font-size:0.65rem;color:#1a1a1a;">Switch to ${mode.toUpperCase()} and start a conversation.</span></div>`;
    }

    guiContent.innerHTML = `
        <div style="display:flex;gap:4px;margin-bottom:10px;">${tabs}</div>
        <div style="overflow-y:auto;max-height:calc(65dvh - 70px);">${msgs}</div>
        ${hist.length ? `
        <div style="margin-top:7px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #111;padding-top:7px;">
            <span style="color:#222;font-size:0.6rem;">${hist.length} messages stored</span>
            <button onclick="clearModeHistory('${mode}')" style="background:transparent;border:1px solid #f44;color:#f44;
                padding:3px 10px;font-family:'Fira Code',monospace;font-size:0.6rem;cursor:pointer;border-radius:3px;">
                CLEAR ${mode.toUpperCase()}
            </button>
        </div>` : ''}`;
};

window.clearModeHistory = function(mode) {
    localStorage.removeItem(HISTORY_KEYS[mode]);
    if (mode === currentMode) messageHistory = [];
    renderHistoryTab(mode);
    printToTerminal(`[SYS] ${mode.toUpperCase()} history cleared.`, 'sys-msg');
};

// =============================================================
//  CREATOR RESPONSES (randomized, intercepted client-side)
// =============================================================
const CREATOR_RESPONSES = [
    `Xavier Scott built this — systems specialist, hardware repair tech, and the kind of person who thinks a portfolio should have a working terminal in it.`,
    `That would be Xavier Scott. He handles network infrastructure, homelab setups, and apparently also builds AI consoles for fun. This is one of them.`,
    `Nexus was put together by Xavier Scott. Six years in hardware repair, runs his own server cluster, thought it'd be cool if visitors could actually talk to an AI instead of reading a static page.`,
    `Xavier Scott is behind all of this. Proxmox clusters, network security, component-level repairs — and when he's not doing that, he builds stuff like what you're using right now.`,
    `Built by Xavier Scott. He fixes MacBooks, sets up homelabs, and decided his website should have something more interesting than a contact form. Hence the terminal.`,
    `Xavier Scott made this. The AI connection, the games, the whole setup. Systems specialist by trade, builder by instinct.`,
    `This is Xavier Scott's work. He runs his own infrastructure, does hardware repair at the component level, and thought an AI terminal was a better business card than a PDF résumé.`,
    `Xavier Scott — he's the one who wired this up. Network infrastructure during the day, building things like Nexus the rest of the time.`,
];

const CONTACT_RESPONSES = [
    `To reach Xavier Scott, head to thyfwxit.com and use the Request Service form — it's the fastest way. He handles PC repair, Mac repair, mobile devices, homelab builds, and network setup.`,
    `Best way to contact Xavier is through the form on thyfwxit.com. Scroll to the bottom and you'll see the Request Service section. He'll get back to you from there.`,
    `Xavier Scott can be reached through his site at thyfwxit.com — there's a contact form at the bottom. Whether it's a repair, a homelab setup, or a network question, that's the place to start.`,
    `Hit up thyfwxit.com and fill out the Request Service form. Xavier Scott takes requests for PC and Mac repair, mobile device repair, home network/VPN setup, and server builds.`,
    `The contact form lives at thyfwxit.com — scroll to "Request Service" at the bottom. Xavier will see it. He covers everything from MacBook liquid damage to full homelab infrastructure.`,
];

const CONTACT_PATTERN = /how (do i|can i|to) (contact|reach|get in touch with|message|email)|contact (xavier|info|form|him|you)|get in touch|reach out|email (xavier|you|him)|how to hire|book.*xavier|xavier.*contact/i;

const CREATOR_PATTERN = /who (made|created|built|designed|owns|is behind|runs|wrote)|tell me about (the creator|yourself|xavier)|about the (creator|maker)|who are you|who is xavier|did (you make|xavier make)/i;

function isCreatorQuestion(text) { return CREATOR_PATTERN.test(text); }
function isContactQuestion(text) { return CONTACT_PATTERN.test(text); }

function showCreatorResponse() {
    printTypewriter(CREATOR_RESPONSES[Math.floor(Math.random() * CREATOR_RESPONSES.length)], 'ai-msg');
}

function showContactResponse() {
    printTypewriter(CONTACT_RESPONSES[Math.floor(Math.random() * CONTACT_RESPONSES.length)], 'ai-msg');
}

// =============================================================
//  AI TRIGGERS
// =============================================================
function handleAITriggers(text) {
    const match = text.match(/\[TRIGGER:([^\]]+)\]/);
    if (!match) return;
    const action = match[1].toLowerCase();
    const clean = text.replace(/\[TRIGGER:[^\]]+\]/, '').trim();
    if (clean) printTypewriter(clean);
    
    // Systems Triggers
    if (action === 'clear') { output.innerHTML = ''; messageHistory = []; return; }
    if (action === 'monitor') { startMonitor(); return; }
    if (action === 'access' || action === 'accessibility') { toggleA11yPanel(); return; }
    
    // Game Triggers
    if (action === 'pong')   startPong();
    if (action === 'snake')  startSnake();
    if (action === 'wordle') startWordle();
    if (action === 'breach') startBreach();
    if (action === 'mines' || action === 'minesweeper') startMinesweeper();
    if (action === 'flappy') startFlappy();
    if (action === 'breakout') startBreakout();
    if (action === 'invaders') startInvaders();
}

function showGameGUI(game, param) {
    const g = game.toLowerCase();
    if (g === 'pong')   startPong();
    else if (g === 'snake')  startSnake();
    else if (g === 'wordle') startWordle();
    else if (g === 'monitor') startMonitor();
    else if (g === 'mines' || g === 'minesweeper') startMinesweeper();
    else if (g === 'flappy') startFlappy();
    else if (g === 'breakout') startBreakout();
    else if (g === 'invaders') startInvaders();
}

// =============================================================
//  HARDWARE MONITOR  (real browser APIs where available)
// =============================================================
function startMonitor() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SYSTEM TELEMETRY';

    // ── Gather real device data ──────────────────────────────────
    const cores    = navigator.hardwareConcurrency || '?';
    const ramHint  = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?';
    const conn     = navigator.connection;
    const hasHeap  = !!(window.performance && performance.memory);
    const connType = conn ? (conn.type || conn.effectiveType || '?') : 'N/A';
    const dlMbps   = conn?.downlink !== undefined ? conn.downlink : null;
    const scrn     = `${window.screen.width}×${window.screen.height}`;
    const dpr      = window.devicePixelRatio ? `@${window.devicePixelRatio}x` : '';

    let batPct = null, batChg = null;
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            batPct = Math.round(b.level * 100); batChg = b.charging;
            b.onlevelchange     = () => { batPct = Math.round(b.level * 100); };
            b.onchargingchange  = () => { batChg = b.charging; };
            const v = document.getElementById('mon-bat-val');
            const s = document.getElementById('mon-bat-sub');
            if (v) v.textContent = batPct + '%';
            if (s) s.textContent = batChg ? 'CHARGING ⚡' : 'ON BATTERY';
        }).catch(() => {});
    }

    guiContent.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:6px;text-align:center;font-size:0.68rem;">
            <div style="border:1px solid #0ff;padding:5px 3px;background:rgba(0,255,255,0.05);">
                <div style="color:#0ff;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">CPU</div>
                <div style="color:#fff;font-size:0.95rem;font-weight:bold;">${cores}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">CORES</div>
            </div>
            <div style="border:1px solid #f0f;padding:5px 3px;background:rgba(255,0,255,0.05);">
                <div style="color:#f0f;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">RAM</div>
                <div style="color:#fff;font-size:0.95rem;font-weight:bold;">${ramHint}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">DEVICE</div>
            </div>
            <div style="border:1px solid #0f0;padding:5px 3px;background:rgba(0,255,0,0.05);">
                <div style="color:#0f0;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">NET</div>
                <div id="mon-net-val" style="color:#fff;font-size:0.9rem;font-weight:bold;">${dlMbps !== null ? dlMbps + 'Mb' : connType}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">${dlMbps !== null ? 'DOWNLINK' : 'TYPE'}</div>
            </div>
            <div style="border:1px solid #ff0;padding:5px 3px;background:rgba(255,255,0,0.04);">
                <div style="color:#ff0;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">BATT</div>
                <div id="mon-bat-val" style="color:#fff;font-size:0.95rem;font-weight:bold;">${batPct !== null ? batPct + '%' : '—'}</div>
                <div id="mon-bat-sub" style="color:#555;font-size:0.58rem;margin-top:2px;">${batPct !== null ? (batChg ? 'CHARGING ⚡' : 'ON BATTERY') : 'N/A'}</div>
            </div>
        </div>
        <div style="color:#252525;font-size:0.6rem;text-align:right;margin-bottom:4px;padding:0 2px;">${scrn}${dpr} · ${connType} · ${navigator.language||'?'} · ${hasHeap ? 'heap API' : 'est'}</div>`;

    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 165;
    const ctx = nexusCanvas.getContext('2d');

    let prevIntervalMs = performance.now();

    clearInterval(monitorInterval);
    monitorInterval = setInterval(() => {
        // ── Real data ────────────────────────────────────────────
        // CPU proxy: measure interval overshoot (browser busyness)
        const nowMs = performance.now();
        const elapsed = nowMs - prevIntervalMs;
        prevIntervalMs = nowMs;
        // Expected: 400ms. Overshoot means main thread was busy.
        const cpuLoad = Math.min(95, Math.max(5, 10 + ((elapsed - 400) / 400) * 80 + Math.random() * 8));

        // Memory: real JS heap (Chrome) or device memory hint fallback
        let memPct;
        if (hasHeap) {
            memPct = Math.min(99, (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
        } else {
            memPct = 30 + Math.random() * 12; // estimated
        }

        // Network: real downlink reading
        const freshDl = navigator.connection?.downlink;
        const netPct  = freshDl !== undefined
            ? Math.min(100, (freshDl / 100) * 100) // normalize against 100Mbps
            : 15 + Math.random() * 20;

        // Update live readouts
        const netEl = document.getElementById('mon-net-val');
        if (netEl && freshDl !== undefined) netEl.textContent = freshDl.toFixed(1) + 'Mb';
        const batV = document.getElementById('mon-bat-val');
        const batS = document.getElementById('mon-bat-sub');
        if (batV && batPct !== null) batV.textContent = batPct + '%';
        if (batS && batPct !== null) batS.textContent = batChg ? 'CHARGING ⚡' : 'ON BATTERY';

        cpuHistory.push(cpuLoad);
        memHistory.push(memPct);
        netHistory.push(netPct);
        [cpuHistory, memHistory, netHistory].forEach(h => { if (h.length > 50) h.shift(); });

        // ── Draw sparklines ──────────────────────────────────────
        const W = 400, H = 165;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, W, H);

        const sections = [
            { label: 'CPU LOAD', note: 'thread est', data: cpuHistory, color: '#0ff', yBase: 52,  maxVal: 100 },
            { label: 'MEMORY',   note: hasHeap ? 'js heap' : 'est',   data: memHistory, color: '#f0f', yBase: 107, maxVal: 100 },
            { label: 'NETWORK',  note: freshDl !== undefined ? 'live' : 'est', data: netHistory, color: '#0f0', yBase: 162, maxVal: 100 },
        ];
        const sectionH = 52;

        sections.forEach(({ label, note, data, color, yBase }) => {
            const top = yBase - sectionH + 2;

            ctx.fillStyle = color + '08';
            ctx.fillRect(0, top, W, sectionH - 2);

            ctx.fillStyle = color;
            ctx.font = 'bold 8px monospace';
            ctx.fillText(label, 6, top + 11);
            ctx.fillStyle = '#333';
            ctx.font = '7px monospace';
            ctx.fillText(`[${note}]`, 7 + ctx.measureText(label).width + 4, top + 11);

            if (data.length > 1) {
                ctx.strokeStyle = color; ctx.lineWidth = 1.5;
                ctx.beginPath();
                data.forEach((v, i) => {
                    const x = (i / 50) * W;
                    const y = yBase - 4 - ((v / 100) * (sectionH - 16));
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.stroke();
                // Fill under
                ctx.beginPath();
                data.forEach((v, i) => {
                    const x = (i / 50) * W;
                    const y = yBase - 4 - ((v / 100) * (sectionH - 16));
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.lineTo((data.length - 1) / 50 * W, yBase - 4);
                ctx.lineTo(0, yBase - 4);
                ctx.closePath();
                ctx.fillStyle = color + '16';
                ctx.fill();
            }

            const last = data[data.length - 1];
            if (last !== undefined) {
                ctx.fillStyle = color; ctx.font = '8px monospace';
                ctx.fillText(last.toFixed(1) + '%', W - 46, top + 11);
            }

            ctx.strokeStyle = color + '33'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, yBase); ctx.lineTo(W, yBase); ctx.stroke();
        });
    }, 400);
}

// =============================================================
//  BREACH PROTOCOL (Hacking Game)
// =============================================================
let breachActive = false, _breachClick = null;

function startBreach() {
    stopAllGames();
    breachActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'BREACH PROTOCOL';
    
    const hexCodes = ['E9', '1C', '55', 'BD', '7A', 'FF', 'F0'];
    const grid = [];
    for(let i=0; i<25; i++) grid.push(hexCodes[Math.floor(Math.random() * hexCodes.length)]);
    
    const sequence = [];
    for(let i=0; i<3; i++) sequence.push(grid[Math.floor(Math.random() * grid.length)]);
    
    let currentInput = [];
    let timeLeft = 30;
    
    guiContent.innerHTML = `
        <div style="text-align:center;">
            <div style="color:#0f0;font-size:0.75rem;margin-bottom:8px;">REQUIRED SEQUENCE: <b style="color:#fff;letter-spacing:2px;">${sequence.join(' ')}</b></div>
            <div id="breach-grid" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;max-width:250px;margin:0 auto;">
                ${grid.map((hex, i) => `<button class="gui-btn breach-tile" data-idx="${i}" style="margin:0;padding:8px;font-size:0.8rem;border-color:#333;">${hex}</button>`).join('')}
            </div>
            <div id="breach-timer" style="margin-top:12px;color:#f00;font-weight:bold;">${timeLeft}s</div>
        </div>`;
    
    const timer = setInterval(() => {
        if (!breachActive) { clearInterval(timer); return; }
        timeLeft--;
        const el = document.getElementById('breach-timer');
        if (el) el.textContent = timeLeft + 's';
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (breachActive) {
                printToTerminal('[FAIL] Breach Timeout. ICE reset.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            }
        }
    }, 1000);

    guiContent.querySelectorAll('.breach-tile').forEach(btn => {
        btn.onclick = () => {
            const hex = btn.textContent;
            btn.style.borderColor = '#0f0';
            btn.style.color = '#0f0';
            btn.disabled = true;
            currentInput.push(hex);
            
            // Check sequence
            const match = currentInput.every((h, idx) => h === sequence[idx]);
            if (!match) {
                printToTerminal('[FAIL] Sequence Mismatch. Alarm Triggered.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            } else if (currentInput.length === sequence.length) {
                printToTerminal('[OK] Neural link established. Admin access granted.', 'conn-ok');
                clearInterval(timer);
                breachActive = false;
                guiContent.innerHTML = '<h2 style="color:#0f0;">ACCESS GRANTED</h2><p style="color:#888;">System bypassed successfully.</p>';
            }
        };
    });
}

// =============================================================
//  PONG
// =============================================================
function startPong() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS PONG';

    // Difficulty menu
    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DIFFICULTY</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="gui-btn pong-diff" data-diff="easy"   style="border-color:#0f0;color:#0f0;">EASY</button>
                <button class="gui-btn pong-diff" data-diff="medium" style="border-color:#ff0;color:#ff0;">MEDIUM</button>
                <button class="gui-btn pong-diff" data-diff="hard"   style="border-color:#f0f;color:#f0f;">HARD</button>
                <button class="gui-btn pong-diff" data-diff="insane" style="border-color:#f00;color:#f00;">INSANE</button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">Mouse or touch to move your paddle</p>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.pong-diff').forEach(btn => {
        btn.addEventListener('click', () => launchPong(btn.dataset.diff));
    });
}

function launchPong(difficulty) {
    const DIFF = {
        easy:   { aiSpeed: 2,   interval: 20, imprecision: 80, ballSpeed: 4   },
        medium: { aiSpeed: 3.5, interval: 14, imprecision: 45, ballSpeed: 5   },
        hard:   { aiSpeed: 5,   interval:  8, imprecision: 20, ballSpeed: 6.5 },
        insane: { aiSpeed: 7.5, interval:  4, imprecision:  4, ballSpeed: 8   },
    };
    const d = DIFF[difficulty] || DIFF.medium;
    const WIN_SCORE = 7;

    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 20px 6px;font-size:0.75rem;">
            <span style="color:#0ff;">YOU</span>
            <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${difficulty.toUpperCase()} · First to ${WIN_SCORE}</span>
            <span style="color:#88f;">CPU</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    // Starfield background — generated once
    const stars = Array.from({length: 60}, () => ({
        x: Math.random()*400, y: Math.random()*300,
        r: Math.random()*1.2 + 0.3, a: Math.random()*0.5 + 0.1
    }));

    const FPS = 60, STEP = 1000 / FPS;
    let last = 0;
    const PADDLE_H = 75, PADDLE_W = 10;
    let paddleY = 112, ballX = 200, ballY = 150;
    let ballVX = d.ballSpeed, ballVY = 3;
    let aiY = 112, pScore = 0, aScore = 0;
    let aiTargetY = 150, aiTick = 0;
    let gameEnded = false;

    const move = (y) => {
        const r = nexusCanvas.getBoundingClientRect();
        paddleY = Math.max(0, Math.min(300 - PADDLE_H, (y - r.top) * (300 / r.height) - PADDLE_H / 2));
    };
    nexusCanvas.onmousemove = (e) => { if (!gameEnded) move(e.clientY); };
    nexusCanvas.ontouchmove = (e) => { if (!gameEnded) { e.preventDefault(); move(e.touches[0].clientY); } };

    function resetBall(dir) {
        ballX = 200; ballY = 60 + Math.random() * 180;
        ballVX = (dir || (Math.random() > 0.5 ? 1 : -1)) * d.ballSpeed;
        ballVY = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 1.5);
        aiTick = 0;
    }

    function drawEnd(playerWon) {
        // Stop loop first
        const r = pongRaf; pongRaf = null; cancelAnimationFrame(r);
        gameEnded = true;

        // Sound: Win/Loss
        if (playerWon) SoundManager.playBloop(800, 0.2);
        else           SoundManager.playBloop(150, 0.2);

        // Submit to global leaderboard
        submitScore('pong', pScore);

        // Draw final frame background
        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, 400, 300);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        // Full-screen overlay
        ctx.fillStyle = playerWon ? 'rgba(0,20,0,0.88)' : 'rgba(20,0,0,0.88)';
        ctx.fillRect(0, 0, 400, 300);

        // Border
        const borderCol = playerWon ? '#0f0' : '#f44';
        ctx.strokeStyle = borderCol; ctx.lineWidth = 2;
        ctx.strokeRect(20, 70, 360, 160);

        ctx.textAlign = 'center';
        ctx.fillStyle = borderCol; ctx.font = 'bold 30px monospace';
        ctx.fillText(playerWon ? 'VICTORY' : 'DEFEATED', 200, 118);
        ctx.fillStyle = '#fff'; ctx.font = '15px monospace';
        ctx.fillText(`${pScore}  —  ${aScore}`, 200, 150);
        ctx.fillStyle = '#555'; ctx.font = '12px monospace';
        ctx.fillText(playerWon ? 'You beat the CPU.' : 'The CPU won this one.', 200, 174);
        ctx.fillStyle = '#0ff'; ctx.font = '11px monospace';
        ctx.fillText('CLICK to rematch', 200, 204);
        ctx.textAlign = 'left';

        nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchPong(difficulty); };
    }

    function tick(ts) {
        if (!pongRaf) return;
        const delta = ts - last;
        if (delta < STEP - 2) { pongRaf = requestAnimationFrame(tick); return; }
        last = ts;

        // AI movement
        aiTick++;
        if (aiTick % d.interval === 0) aiTargetY = ballY - PADDLE_H / 2 + (Math.random() - 0.5) * d.imprecision;
        if (aiY < aiTargetY) aiY = Math.min(aiY + d.aiSpeed, aiTargetY);
        else                  aiY = Math.max(aiY - d.aiSpeed, aiTargetY);
        aiY = Math.max(0, Math.min(300 - PADDLE_H, aiY));

        ballX += ballVX; ballY += ballVY;
        if (ballY <= 4)   { ballVY =  Math.abs(ballVY); ballY = 5; }
        if (ballY >= 296) { ballVY = -Math.abs(ballVY); ballY = 295; }

        const pRight = 8 + PADDLE_W;
        if (ballVX < 0 && ballX - 5 <= pRight && ballX + 5 >= 8 && ballY + 5 > paddleY && ballY - 5 < paddleY + PADDLE_H) {
            ballVX = Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 2.5;
            ballVY = Math.max(-9, Math.min(9, ballVY));
            ballX = pRight + 6;
        }
        const aiLeft = 382;
        if (ballVX > 0 && ballX + 5 >= aiLeft && ballX - 5 <= aiLeft + PADDLE_W && ballY + 5 > aiY && ballY - 5 < aiY + PADDLE_H) {
            ballVX = -Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 1.5;
            ballVY = Math.max(-9, Math.min(9, ballVY));
            ballX = aiLeft - 6;
        }

        if (ballX < 0)   { aScore++; if (aScore >= WIN_SCORE) { drawEnd(false); return; } resetBall(1); }
        if (ballX > 400) { pScore++; if (pScore >= WIN_SCORE) { drawEnd(true);  return; } resetBall(-1); }

        // Draw — starfield background
        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, 400, 300);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        // Center line
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(0,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, 300); ctx.stroke();
        ctx.setLineDash([]);

        // Score
        ctx.fillStyle = 'rgba(0,255,255,0.55)'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
        ctx.fillText(pScore, 90, 34); ctx.fillText(aScore, 310, 34);
        ctx.textAlign = 'left';

        // Progress pips (dots showing how close each player is to winning)
        for (let i = 0; i < WIN_SCORE; i++) {
            ctx.fillStyle = i < pScore ? '#0ff' : 'rgba(0,255,255,0.12)';
            ctx.beginPath(); ctx.arc(22 + i * 18, 46, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = i < aScore ? '#88f' : 'rgba(136,136,255,0.12)';
            ctx.beginPath(); ctx.arc(378 - i * 18, 46, 4, 0, Math.PI*2); ctx.fill();
        }

        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(8, paddleY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#88f'; ctx.fillStyle = '#88f';
        ctx.fillRect(382, aiY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
        ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        pongRaf = requestAnimationFrame(tick);
    }
    pongRaf = requestAnimationFrame(tick);
}

function stopPong() { const r = pongRaf; pongRaf = null; cancelAnimationFrame(r); }

// =============================================================
//  SNAKE
// =============================================================
let snakeRaf;
let snakeActive = false;
let _snakeTS = null, _snakeTE = null, _snakeKey = null;

function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS SNAKE';
    nexusCanvas.style.display = 'none';

    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT MODE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:300px;margin:0 auto;">
                <button class="gui-btn snake-mode" data-mode="classic" style="border-color:#0ff;color:#0ff;">CLASSIC</button>
                <button class="gui-btn snake-mode" data-mode="speed"   style="border-color:#ff0;color:#ff0;">SPEED RUN</button>
                <button class="gui-btn snake-mode" data-mode="endless" style="border-color:#0f0;color:#0f0;">ENDLESS</button>
                <button class="gui-btn snake-mode" data-mode="stealth" style="border-color:#888;color:#888;">STEALTH</button>
            </div>
            <div style="color:#333;font-size:0.65rem;margin-top:16px;line-height:1.8;">
                SPEED RUN — starts fast, gets faster<br>
                ENDLESS — walls wrap around<br>
                STEALTH — no grid, pure instinct
            </div>
        </div>`;

    guiContent.querySelectorAll('.snake-mode').forEach(btn => {
        btn.addEventListener('click', () => launchSnake(btn.dataset.mode));
    });
}

function launchSnake(snakeMode) {
    const stealth  = snakeMode === 'stealth';
    const endless  = snakeMode === 'endless';
    const speedRun = snakeMode === 'speed';
    const hiKey    = `snake_hi_${snakeMode}`;
    let   snakeHi  = parseInt(localStorage.getItem(hiKey) || '0');

    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px;font-size:0.75rem;color:#0ff;margin-bottom:4px;">
            <span>Arrows · WASD · Swipe</span>
            <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${snakeMode.toUpperCase()}</span>
            <span>Score: <b id="snake-score">0</b> &nbsp;<span style="color:#333">HI:${snakeHi}</span></span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');
    const CELL = 20, COLS = 20, ROWS = 18;
    snakeActive = true;

    // Pre-draw background once into an offscreen canvas for perf
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 400; bgCanvas.height = 360;
    const bgCtx = bgCanvas.getContext('2d');
    (function buildBg() {
        // Dark base
        bgCtx.fillStyle = '#050510';
        bgCtx.fillRect(0, 0, 400, 360);
        
        if (stealth) return; // Stay dark for stealth mode

        // Cool Circuit Grid
        bgCtx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
        bgCtx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
            bgCtx.beginPath(); bgCtx.moveTo(x * CELL, 0); bgCtx.lineTo(x * CELL, ROWS * CELL); bgCtx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
            bgCtx.beginPath(); bgCtx.moveTo(0, y * CELL); bgCtx.lineTo(COLS * CELL, y * CELL); bgCtx.stroke();
        }
        
        // Circuit traces
        bgCtx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        bgCtx.lineWidth = 1.5;
        const traces = [[0,3,4,3,4,8,7,8],[COLS,12,COLS-3,12,COLS-3,7,COLS-6,7],[5,0,5,4,10,4],[8,ROWS,8,ROWS-3,14,ROWS-3,14,ROWS-6]];
        traces.forEach(pts => {
            bgCtx.beginPath();
            bgCtx.moveTo(pts[0]*CELL, pts[1]*CELL);
            for (let i=2;i<pts.length;i+=2) bgCtx.lineTo(pts[i]*CELL, pts[i+1]*CELL);
            bgCtx.stroke();
        });

        // Glowing nodes
        bgCtx.shadowBlur = 6; bgCtx.shadowColor = '#0ff';
        bgCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        [[4,3],[4,8],[7,8],[COLS-3,12],[COLS-3,7],[5,4],[10,4],[8,ROWS-3],[14,ROWS-3],[14,ROWS-6]].forEach(([cx,cy]) => {
            bgCtx.beginPath(); bgCtx.arc(cx*CELL, cy*CELL, 2.5, 0, Math.PI*2); bgCtx.fill();
        });
        bgCtx.shadowBlur = 0;

        if (endless) {
            bgCtx.fillStyle = 'rgba(0, 255, 255, 0.02)';
            bgCtx.fillRect(0,0,3,ROWS*CELL); bgCtx.fillRect(COLS*CELL-3,0,3,ROWS*CELL);
            bgCtx.fillRect(0,0,COLS*CELL,3); bgCtx.fillRect(0,ROWS*CELL-3,COLS*CELL,3);
        }
    })();

    let snake = [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }];
    let dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
    let apple = spawnApple();
    let score = 0, dead = false;
    let stepMs = speedRun ? 70 : 100, lastStep = 0;

    function spawnApple() {
        let a;
        do { a = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
        while (snake.some(s => s.x === a.x && s.y === a.y));
        return a;
    }

    _snakeKey = (e) => {
        if (dead) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launchSnake(snakeMode); }
            return;
        }
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) e.preventDefault();
        // Guard against 180° reverse using nextDir (not dir) so rapid keypresses don't teleport into self
        if ((e.key === 'ArrowUp'    || e.key === 'w') && nextDir.y !== 1)  nextDir = { x: 0, y: -1 };
        if ((e.key === 'ArrowDown'  || e.key === 's') && nextDir.y !== -1) nextDir = { x: 0, y: 1 };
        if ((e.key === 'ArrowLeft'  || e.key === 'a') && nextDir.x !== 1)  nextDir = { x: -1, y: 0 };
        if ((e.key === 'ArrowRight' || e.key === 'd') && nextDir.x !== -1) nextDir = { x: 1, y: 0 };
    };
    document.addEventListener('keydown', _snakeKey);

    let swipeX = 0, swipeY = 0;
    _snakeTS = (e) => { swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; };
    _snakeTE = (e) => {
        if (dead) { launchSnake(snakeMode); return; }
        const dx = e.changedTouches[0].clientX - swipeX;
        const dy = e.changedTouches[0].clientY - swipeY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
            if (dx > 0 && nextDir.x !== -1) nextDir = { x: 1, y: 0 };
            else if (dx < 0 && nextDir.x !== 1) nextDir = { x: -1, y: 0 };
        } else if (Math.abs(dy) > 25) {
            if (dy > 0 && nextDir.y !== -1) nextDir = { x: 0, y: 1 };
            else if (dy < 0 && nextDir.y !== 1) nextDir = { x: 0, y: -1 };
        }
    };
    nexusCanvas.addEventListener('touchstart', _snakeTS, { passive: true });
    nexusCanvas.addEventListener('touchend',   _snakeTE, { passive: true });

    function gameOver() {
        dead = true;
        // STOP the loop immediately — this prevents drawSnake() from wiping the death screen
        snakeActive = false;
        cancelAnimationFrame(snakeRaf);
        if (score > snakeHi) { snakeHi = score; localStorage.setItem(hiKey, snakeHi); }

        SoundManager.playBloop(150, 0.2);
        submitScore(`snake_${snakeMode}`, score);

        drawSnake(); // draw final game state first

        // Death overlay
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, 400, 360);

        // Glitch border
        ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
        ctx.strokeRect(16, 90, 368, 180);
        ctx.strokeStyle = 'rgba(0,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(14, 88, 372, 184);

        ctx.textAlign = 'center';
        // Title
        ctx.fillStyle = '#f0f'; ctx.font = 'bold 32px monospace';
        ctx.fillText('YOU DIED', 200, 138);
        // Mode badge
        ctx.fillStyle = '#333'; ctx.font = '11px monospace';
        ctx.fillText(`— ${snakeMode.toUpperCase()} MODE —`, 200, 158);
        // Score
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace';
        ctx.fillText(`Score: ${score}`, 200, 190);
        // High score
        const isNew = score === snakeHi && score > 0;
        ctx.fillStyle = isNew ? '#ff0' : '#555';
        ctx.font = '13px monospace';
        ctx.fillText(isNew ? `★ NEW BEST: ${snakeHi} ★` : `Best: ${snakeHi}`, 200, 212);
        // Restart prompt
        ctx.fillStyle = '#0ff'; ctx.font = '12px monospace';
        ctx.fillText('CLICK · ENTER · SWIPE  to restart', 200, 244);
        ctx.textAlign = 'left';

        nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchSnake(snakeMode); };
    }

    function frame(ts) {
        if (!snakeActive) return;
        // Register next frame AFTER dead check so death screen is never overwritten
        if (ts - lastStep < stepMs) { drawSnake(); snakeRaf = requestAnimationFrame(frame); return; }
        lastStep = ts;

        dir = nextDir;
        let head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (endless) {
            head.x = (head.x + COLS) % COLS;
            head.y = (head.y + ROWS) % ROWS;
            // Skip self-check on tail tip (it's about to vacate unless we just ate)
            const body = snake.slice(0, snake.length - 1);
            if (body.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
        } else {
            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
                snake.slice(0, snake.length - 1).some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
        }

        const ate = head.x === apple.x && head.y === apple.y;
        snake.unshift(head);
        if (ate) {
            score++; apple = spawnApple();
            SoundManager.playBloop(600, 0.05);
            const el = document.getElementById('snake-score');
            if (el) el.textContent = score;
            if (speedRun) stepMs = Math.max(40, 70  - Math.floor(score / 3) * 8);
            else          stepMs = Math.max(50, 100 - Math.floor(score / 5) * 8);
        } else {
            snake.pop();
        }

        drawSnake();
        if (snakeActive) snakeRaf = requestAnimationFrame(frame);
    }

    function drawSnake() {
        ctx.drawImage(bgCanvas, 0, 0); // blit pre-drawn background

        // Apple glow
        ctx.shadowBlur = 10; ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
        ctx.fillRect(apple.x*CELL+3, apple.y*CELL+3, CELL-6, CELL-6);

        // Body segments — no per-segment shadow (perf)
        ctx.shadowBlur = 0;
        snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? '#fff' : `hsl(${140 + i * 3},100%,55%)`;
            ctx.fillRect(seg.x*CELL+1, seg.y*CELL+1, CELL-2, CELL-2);
        });
        // Head glow only
        if (snake.length > 0) {
            ctx.shadowBlur = 14; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#fff';
            ctx.fillRect(snake[0].x*CELL+1, snake[0].y*CELL+1, CELL-2, CELL-2);
            ctx.shadowBlur = 0;
        }
    }

    snakeRaf = requestAnimationFrame(frame);
}

function stopSnake() {
    snakeActive = false;
    cancelAnimationFrame(snakeRaf);
    if (_snakeKey) { document.removeEventListener('keydown', _snakeKey); _snakeKey = null; }
    if (_snakeTS)  { nexusCanvas.removeEventListener('touchstart', _snakeTS); _snakeTS = null; }
    if (_snakeTE)  { nexusCanvas.removeEventListener('touchend',   _snakeTE); _snakeTE = null; }
}

// =============================================================
//  CYBER INVADERS (Classic Edition)
// =============================================================
let invadersActive = false;

function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'CYBER INVADERS // MAINFRAME DEFENSE';
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');

    let playerX = 180, bullets = [], enemies = [], particles = [], boss = null;
    let shields = []; // Data Firewalls
    let score = 0, wave = 1, gameOver = false, shake = 0;
    let moveDir = 1;

    function initShields() {
        shields = [];
        for (let i = 0; i < 4; i++) {
            const sx = 50 + i * 100;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 4; c++) {
                    shields.push({ x: sx + c * 10, y: 280 + r * 10, hp: 3 });
                }
            }
        }
    }

    function initEnemies() {
        enemies = [];
        const rows = Math.min(6, 3 + Math.floor(wave / 2));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < 8; c++) {
                enemies.push({ x: 40 + c * 40, y: 60 + r * 30, alive: true, type: r, hp: 1 });
            }
        }
    }

    function spawnBoss() {
        boss = { x: 150, y: -50, targetY: 60, hp: 50 + (wave * 10), maxHp: 50 + (wave * 10), moveDir: 1 };
        SoundManager.playBloop(100, 0.3);
    }

    function createExplosion(x, y, color) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x, y, 
                vx: (Math.random() - 0.5) * 6, 
                vy: (Math.random() - 0.5) * 6, 
                life: 1.0, 
                color
            });
        }
    }

    if (wave % 5 === 0) spawnBoss(); else initEnemies();
    initShields();

    const movePlayer = (x) => {
        const rect = nexusCanvas.getBoundingClientRect();
        playerX = ((x - rect.left) / rect.width) * 400 - 20;
        playerX = Math.max(0, Math.min(360, playerX));
    };
    nexusCanvas.onmousemove = (e) => movePlayer(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); movePlayer(e.touches[0].clientX); };
    nexusCanvas.onclick = () => {
        if (gameOver) { startInvaders(); return; }
        if (bullets.length < 4) {
            bullets.push({ x: playerX + 18, y: 330 });
            SoundManager.playBloop(600, 0.03);
        }
    };

    function tick(ts) {
        if (!invadersActive) return;
        
        ctx.save();
        if (shake > 0) {
            ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
            shake *= 0.9;
        }

        ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, 400, 360);
        
        // Scanlines background
        ctx.fillStyle = 'rgba(0, 255, 255, 0.03)';
        for (let i = 0; i < 360; i += 4) ctx.fillRect(0, i, 400, 1);

        if (!gameOver) {
            // Player
            ctx.fillStyle = '#0ff';
            ctx.shadowBlur = 10; ctx.shadowColor = '#0ff';
            ctx.fillRect(playerX, 330, 40, 10);
            ctx.fillRect(playerX + 15, 320, 10, 10);
            ctx.shadowBlur = 0;

            // Bullets
            bullets.forEach((b, i) => {
                b.y -= 6; // SLOWER bullets for classic feel
                ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, 3, 12);
                
                // Shield collision
                shields.forEach((s, si) => {
                    if (s.hp > 0 && b.x > s.x && b.x < s.x + 10 && b.y > s.y && b.y < s.y + 10) {
                        s.hp--; bullets.splice(i, 1);
                        SoundManager.playBloop(100, 0.02);
                    }
                });

                if (b.y < 0) bullets.splice(i, 1);
            });

            // Shields
            shields.forEach(s => {
                if (s.hp <= 0) return;
                ctx.fillStyle = `rgba(0, 255, 255, ${s.hp / 3})`;
                ctx.fillRect(s.x, s.y, 9, 9);
            });

            // Particles
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.02;
                ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
                ctx.fillRect(p.x, p.y, 3, 3);
                if (p.life <= 0) particles.splice(i, 1);
            });
            ctx.globalAlpha = 1.0;

            // Boss Logic
            if (boss) {
                if (boss.y < boss.targetY) boss.y += 1;
                boss.x += boss.moveDir * 2;
                if (boss.x > 300 || boss.x < 20) boss.moveDir *= -1;

                // Boss health bar
                ctx.fillStyle = '#333'; ctx.fillRect(100, 10, 200, 6);
                ctx.fillStyle = '#f0f'; ctx.fillRect(100, 10, (boss.hp / boss.maxHp) * 200, 6);
                
                // Draw Boss
                ctx.fillStyle = '#f0f'; ctx.font = 'bold 24px monospace';
                ctx.fillText('[ FIREWALL ]', boss.x, boss.y);

                // Bullet collision with Boss
                bullets.forEach((b, bi) => {
                    if (b.x > boss.x && b.x < boss.x + 120 && b.y > boss.y - 20 && b.y < boss.y) {
                        boss.hp--; bullets.splice(bi, 1);
                        createExplosion(b.x, b.y, '#f0f');
                        shake = 4;
                        SoundManager.playBloop(150, 0.02);
                    }
                });

                if (boss.hp <= 0) {
                    score += 500;
                    createExplosion(boss.x + 60, boss.y, '#fff');
                    boss = null;
                    wave++;
                    SoundManager.playBloop(800, 0.2);
                    if (wave % 5 !== 0) initEnemies(); else spawnBoss();
                }
            }

            // Regular Enemies
            let edge = false;
            enemies.forEach(e => {
                if (!e.alive) return;
                ctx.fillStyle = e.type % 2 === 0 ? '#f0f' : '#0f0';
                ctx.font = 'bold 16px monospace';
                const sprite = e.type % 2 === 0 ? '⚇' : '⚉';
                ctx.fillText(sprite, e.x, e.y);
                
                if (e.x > 370 || e.x < 10) edge = true;

                // Collision
                bullets.forEach((b, bi) => {
                    if (b.x > e.x - 5 && b.x < e.x + 20 && b.y > e.y - 15 && b.y < e.y) {
                        e.alive = false; bullets.splice(bi, 1);
                        score += 10 * wave;
                        createExplosion(e.x, e.y, ctx.fillStyle);
                        SoundManager.playBloop(200, 0.03);
                    }
                });

                if (e.y > 315) gameOver = true;
            });

            if (edge) {
                moveDir *= -1;
                enemies.forEach(e => e.y += 12);
            }
            enemies.forEach(e => e.x += moveDir * (0.8 + wave * 0.12)); // SLOWER movement

            if (!boss && enemies.length > 0 && enemies.every(e => !e.alive)) {
                wave++;
                initEnemies();
                initShields(); // Restore shields each wave
                if (wave % 5 === 0) spawnBoss();
                SoundManager.playBloop(800, 0.1);
            }

            ctx.fillStyle = '#0ff'; ctx.font = '10px monospace';
            ctx.fillText(`MAINFRAME SECURITY: ${Math.max(0, 100 - wave)}%`, 10, 20);
            ctx.fillText(`THREAT LEVEL: ${wave}`, 320, 20);
            ctx.fillText(`DATA RECOVERED: ${score}`, 10, 350);
        } else {
            // SYSTEM BREACHED - PROPER END SCREEN
            ctx.fillStyle = 'rgba(255,0,0,0.4)'; ctx.fillRect(0,0,400,360);
            ctx.strokeStyle = '#f44'; ctx.lineWidth = 2; ctx.strokeRect(50, 100, 300, 120);
            
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f44'; ctx.font = 'bold 28px monospace';
            ctx.fillText('SYSTEM BREACHED', 200, 145);
            
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
            ctx.fillText(`DATA RECOVERED: ${score}`, 200, 175);
            
            ctx.fillStyle = '#0ff'; ctx.font = '11px monospace';
            ctx.fillText('CLICK TO RESTORE UPLINK', 200, 205);
            ctx.textAlign = 'left';
            
            if (score > 0 && !nexusCanvas.onclick) { 
                submitScore('invaders', score);
                nexusCanvas.onclick = () => { nexusCanvas.onclick = null; startInvaders(); };
            }
        }

        ctx.restore();
        invadersRaf = requestAnimationFrame(tick);
    }
    // Start the loop
    invadersRaf = requestAnimationFrame(tick);
}

function stopInvaders() { cancelAnimationFrame(invadersRaf); invadersActive = false; }

// =============================================================
//  FLAPPY BIRD (Nexus Edition)
// =============================================================
let flappyActive = false, _flappyKey = null;


function startFlappy() {
    stopAllGames();
    flappyActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'FLAPPY NEXUS';
    guiContent.innerHTML = `<p style="font-size:0.72rem;color:#0ff;text-align:center;margin:0 0 4px;">TAP · SPACE · ↑ to flap</p>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    // Physics constants at 60fps baseline — all scaled by deltaTime
    const GRAVITY = 0.4, FLAP_VEL = -7.5, PIPE_W = 44, GAP = 105, PIPE_SPEED = 2.8;
    let bird = { x: 80, y: 150, vy: 0, angle: 0 };
    let pipes = [], score = 0, hi = parseInt(localStorage.getItem('flappy_hi') || '0');
    let started = false, dead = false;
    let lastTs = 0, nextPipeMs = 1400; // time-based pipe spawning

    // Pre-generate city skyline background
    const cityBg = document.createElement('canvas');
    cityBg.width = 400; cityBg.height = 300;
    (function buildCity() {
        const c = cityBg.getContext('2d');
        // Sky gradient — deep purple/navy
        const grad = c.createLinearGradient(0, 0, 0, 300);
        grad.addColorStop(0, '#06010f'); grad.addColorStop(0.7, '#0a0520'); grad.addColorStop(1, '#12082a');
        c.fillStyle = grad; c.fillRect(0, 0, 400, 300);
        // Distant stars
        for (let i = 0; i < 35; i++) {
            const a = Math.random() * 0.5 + 0.1;
            c.fillStyle = `rgba(255,255,255,${a})`;
            c.beginPath(); c.arc(Math.random()*400, Math.random()*160, Math.random()*0.8+0.3, 0, Math.PI*2); c.fill();
        }
        // City silhouette — far layer (darker)
        c.fillStyle = '#0d0520';
        const farBuildings = [0,220,30,200,60,210,90,185,130,195,160,175,200,190,240,170,280,180,310,165,350,178,380,190,400,220,400,300,0,300];
        c.beginPath(); c.moveTo(farBuildings[0], farBuildings[1]);
        for (let i=2;i<farBuildings.length;i+=2) c.lineTo(farBuildings[i], farBuildings[i+1]);
        c.fill();
        // City silhouette — near layer
        c.fillStyle = '#080414';
        const nearBuildings = [0,260,20,235,50,240,80,220,110,230,140,215,165,225,195,210,220,218,250,200,280,210,310,195,340,208,370,215,400,260,400,300,0,300];
        c.beginPath(); c.moveTo(nearBuildings[0], nearBuildings[1]);
        for (let i=2;i<nearBuildings.length;i+=2) c.lineTo(nearBuildings[i], nearBuildings[i+1]);
        c.fill();
        // Window lights — tiny random lit windows on buildings
        c.fillStyle = 'rgba(255,220,100,0.45)';
        for (let i = 0; i < 40; i++) {
            const wx = Math.random()*380 + 10, wy = 175 + Math.random()*60;
            c.fillRect(wx, wy, 2, 2);
        }
        c.fillStyle = 'rgba(100,200,255,0.3)';
        for (let i = 0; i < 20; i++) {
            const wx = Math.random()*380 + 10, wy = 200 + Math.random()*45;
            c.fillRect(wx, wy, 2, 3);
        }
    })();

    function flap() {
        if (dead) { startFlappy(); return; }
        if (!started) { started = true; lastTs = performance.now(); }
        bird.vy = FLAP_VEL;
    }

    _flappyKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
    document.addEventListener('keydown', _flappyKey);
    nexusCanvas.addEventListener('click', flap);
    nexusCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });

    function addPipe() {
        const top = 40 + Math.random() * (300 - GAP - 60);
        pipes.push({ x: 415, top, scored: false });
    }
    addPipe();

    function frame(ts) {
        if (!flappyActive) return;

        // DeltaTime — normalize to 60fps so physics are identical on 60/120/144Hz
        const raw = lastTs ? Math.min(ts - lastTs, 50) : 16.67; // cap at 50ms to handle tab switching
        const dt  = raw / 16.67;
        lastTs = ts;

        if (started && !dead) {
            bird.vy += GRAVITY * dt;
            bird.y  += bird.vy * dt;
            bird.angle = Math.max(-0.45, Math.min(0.55, bird.vy * 0.07));

            nextPipeMs -= raw;
            if (nextPipeMs <= 0) { addPipe(); nextPipeMs = 1350 + Math.random() * 200; }

            pipes.forEach(p => p.x -= PIPE_SPEED * dt);
            pipes = pipes.filter(p => p.x + PIPE_W > -10);

            pipes.forEach(p => {
                if (!p.scored && p.x + PIPE_W < bird.x) { p.scored = true; score++; if (score > hi) { hi = score; localStorage.setItem('flappy_hi', hi); } }
            });

            // Collision
            if (bird.y < 6 || bird.y > 294) dead = true;
            pipes.forEach(p => {
                if (bird.x + 9 > p.x && bird.x - 9 < p.x + PIPE_W) {
                    if (bird.y - 9 < p.top || bird.y + 9 > p.top + GAP) dead = true;
                }
            });
        }

        // Draw city background
        ctx.drawImage(cityBg, 0, 0);
        // Ground
        ctx.fillStyle = '#0a0518';
        ctx.fillRect(0, 291, 400, 9);
        ctx.fillStyle = '#c0f'; ctx.shadowBlur = 4; ctx.shadowColor = '#c0f';
        ctx.fillRect(0, 291, 400, 1);
        ctx.shadowBlur = 0;

        // Pipes — neon purple theme to match city
        pipes.forEach(p => {
            ctx.shadowBlur = 6; ctx.shadowColor = '#80f';
            ctx.fillStyle = '#1a0830';
            ctx.fillRect(p.x, 0, PIPE_W, p.top);
            ctx.fillRect(p.x, p.top + GAP, PIPE_W, 300);
            // Pipe caps
            ctx.fillStyle = '#80f';
            ctx.fillRect(p.x - 3, p.top - 10, PIPE_W + 6, 10);
            ctx.fillRect(p.x - 3, p.top + GAP, PIPE_W + 6, 10);
            // Edge highlight
            ctx.fillStyle = 'rgba(180,80,255,0.15)';
            ctx.fillRect(p.x + PIPE_W - 4, 0, 4, p.top);
            ctx.fillRect(p.x + PIPE_W - 4, p.top + GAP + 10, 4, 300);
            ctx.shadowBlur = 0;
        });

        // Bird
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.angle);
        ctx.shadowBlur = 14; ctx.shadowColor = '#f0f';
        ctx.fillStyle = '#f0f';
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0c';
        ctx.beginPath(); ctx.ellipse(-4, 3, 6, 4, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(6, -2, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // HUD
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText(score, 200, 34);
        ctx.fillStyle = '#555'; ctx.font = '11px monospace';
        ctx.fillText(`HI ${hi}`, 200, 50);
        ctx.textAlign = 'left';

        if (!started) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText('FLAPPY NEXUS', 200, 128);
            ctx.fillStyle = '#0ff'; ctx.font = '13px monospace';
            ctx.fillText('TAP  ·  SPACE  ·  ↑  to flap', 200, 155);
            ctx.textAlign = 'left';
        }

        if (dead) {
            ctx.fillStyle = 'rgba(6,1,15,0.88)';
            ctx.fillRect(0, 0, 400, 300);
            // Border
            ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
            ctx.strokeRect(20, 70, 360, 160);
            ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.strokeRect(18, 68, 364, 164);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 30px monospace';
            ctx.fillText('GAME OVER', 200, 116);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 150);
            const isNew = score === hi && score > 0;
            ctx.fillStyle = isNew ? '#ff0' : '#0ff';
            ctx.fillText(isNew ? `★ NEW BEST: ${hi} ★` : `Best: ${hi}`, 200, 174);
            ctx.fillStyle = '#555'; ctx.font = '12px monospace';
            ctx.fillText('TAP · SPACE to retry', 200, 208);
            ctx.textAlign = 'left';
        }

        flappyFrame = requestAnimationFrame(frame);
    }
    flappyFrame = requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
}

function stopFlappy() {
    flappyActive = false;
    cancelAnimationFrame(flappyFrame);
    if (_flappyKey) { document.removeEventListener('keydown', _flappyKey); _flappyKey = null; }
    nexusCanvas.onclick = null;
}

// =============================================================
//  BREAKOUT
// =============================================================
let breakoutFrame, breakoutActive = false;

function startBreakout() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS BREAKOUT';

    // Difficulty menu with descriptions
    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DIFFICULTY</div>
            <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
                <button class="gui-btn brk-diff" data-diff="easy"   style="border-color:#0f0;color:#0f0;width:240px;">EASY<br><span style="font-size:0.6rem;opacity:0.6;">Slow balls · Big paddle</span></button>
                <button class="gui-btn brk-diff" data-diff="medium" style="border-color:#ff0;color:#ff0;width:240px;">MEDIUM<br><span style="font-size:0.6rem;opacity:0.6;">Standard physics</span></button>
                <button class="gui-btn brk-diff" data-diff="hard"   style="border-color:#f0f;color:#f0f;width:240px;">HARD<br><span style="font-size:0.6rem;opacity:0.6;">Fast balls · Small paddle</span></button>
                <button class="gui-btn brk-diff" data-diff="chaos"  style="border-color:#f00;color:#f00;width:240px;">CHAOS<br><span style="font-size:0.6rem;opacity:0.6;">Extreme acceleration</span></button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">Mouse or touch to move your paddle</p>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.brk-diff').forEach(btn => {
        btn.addEventListener('click', () => launchBreakout(btn.dataset.diff));
    });
}

function launchBreakout(difficulty) {
    const DIFFS = {
        easy:   { PW: 96, startVX: 2,   startVY: -3.5, accel: 1.01 },
        medium: { PW: 72, startVX: 2.8, startVY: -4.5, accel: 1.03 },
        hard:   { PW: 50, startVX: 3.5, startVY: -5.5, accel: 1.05 },
        chaos:  { PW: 44, startVX: 3,   startVY: -5,   accel: 1.08 },
    };
    const d = DIFFS[difficulty] || DIFFS.medium;

    breakoutActive = true;
    let currentPW = d.PW;
    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px 4px;font-size:0.72rem;">
            <span style="color:#0ff;">Score: <b id="brk-score">0</b></span>
            <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${difficulty.toUpperCase()}</span>
            <span id="brk-lives" style="color:#0ff;">♥♥♥</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    const PH = 10, BR = 7;
    const BW = 43, BH = 16, BCOLS = 8, BROWS = 5;
    const BCOLORS = ['#f0f','#f55','#f80','#ff0','#0f0'];
    let paddle = 165;
    // Ball system — supporting Multi-ball
    let balls = [{ x: 200, y: 230, vx: d.startVX, vy: d.startVY }];
    // Power-up system
    let powerups = [];
    const PU_TYPES = [
        { label: 'M', color: '#0ff', type: 'multi' },
        { label: 'W', color: '#0f0', type: 'wide' },
        { label: 'S', color: '#ff0', type: 'slow' }
    ];

    let bricks = [], score = 0, lives = 3, dead = false, won = false;
    let lastTs = 0, wideTimer = 0;
    let hi = parseInt(localStorage.getItem('breakout_hi') || '0');

    // Pre-draw circuit board background
    const brkBg = document.createElement('canvas');
    brkBg.width = 400; brkBg.height = 300;
    (function buildBrkBg() {
        const c = brkBg.getContext('2d');
        c.fillStyle = '#050510'; c.fillRect(0, 0, 400, 300);
        c.strokeStyle = 'rgba(0,255,255,0.04)'; c.lineWidth = 1;
        for (let x = 0; x <= 400; x += 25) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,300); c.stroke(); }
        for (let y = 0; y <= 300; y += 25) { c.beginPath(); c.moveTo(0,y); c.lineTo(400,y); c.stroke(); }
    })();

    function initBricks() {
        bricks = [];
        for (let r = 0; r < BROWS; r++)
            for (let c = 0; c < BCOLS; c++)
                bricks.push({ x: 8 + c * (BW + 4), y: 30 + r * (BH + 5), alive: true, color: BCOLORS[r] });
    }
    initBricks();

    const movePaddle = (cx) => {
        const rect = nexusCanvas.getBoundingClientRect();
        paddle = ((cx - rect.left) / rect.width) * 400 - currentPW / 2;
        paddle = Math.max(0, Math.min(400 - currentPW, paddle));
    };
    nexusCanvas.onmousemove = (e) => movePaddle(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); movePaddle(e.touches[0].clientX); };

    function frame(ts) {
        if (!breakoutActive) return;
        const raw = lastTs ? Math.min(ts - lastTs, 50) : 16.67;
        const dt  = raw / 16.67;
        lastTs = ts;

        if (!dead && !won) {
            // Handle Wide Paddle timer
            if (wideTimer > 0) {
                wideTimer -= raw;
                if (wideTimer <= 0) currentPW = d.PW;
            }

            // Move Balls
            balls.forEach((ball, bi) => {
                ball.x += ball.vx * dt; ball.y += ball.vy * dt;
                if (ball.x <= BR || ball.x >= 400 - BR) { ball.vx *= -1; SoundManager.playBloop(300, 0.02); }
                if (ball.y <= BR) { ball.vy = Math.abs(ball.vy); SoundManager.playBloop(300, 0.02); }
                
                // Paddle hit
                if (ball.y + BR >= 270 && ball.y - BR <= 282 && ball.x >= paddle && ball.x <= paddle + currentPW) {
                    ball.vy = -Math.abs(ball.vy);
                    const hitPoint = (ball.x - (paddle + currentPW / 2)) / (currentPW / 2);
                    ball.vx = hitPoint * 5.5;
                    SoundManager.playBloop(400, 0.05);
                }

                // Brick hit
                bricks.forEach(b => {
                    if (!b.alive) return;
                    if (ball.x + BR > b.x && ball.x - BR < b.x + BW && ball.y + BR > b.y && ball.y - BR < b.y + BH) {
                        b.alive = false; ball.vy *= -1; score += 10;
                        SoundManager.playBloop(600 + Math.random() * 200, 0.05);
                        
                        // Drop powerup? (15% chance)
                        if (Math.random() < 0.15) {
                            const pu = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
                            powerups.push({ x: b.x + BW/2, y: b.y, type: pu.type, label: pu.label, color: pu.color });
                        }

                        if (d.accel) {
                            ball.vx *= d.accel; ball.vy *= d.accel;
                            const spd = Math.sqrt(ball.vx**2 + ball.vy**2);
                            if (spd > 14) { ball.vx = ball.vx/spd*14; ball.vy = ball.vy/spd*14; }
                        }
                        const el = document.getElementById('brk-score');
                        if (el) el.textContent = score;
                    }
                });

                // Ball lost
                if (ball.y > 310) balls.splice(bi, 1);
            });

            // No balls left? Lose a life
            if (balls.length === 0) {
                lives--;
                SoundManager.playBloop(150, 0.1);
                const livesEl = document.getElementById('brk-lives');
                if (livesEl) livesEl.textContent = '♥'.repeat(Math.max(0, lives));
                if (lives <= 0) { 
                    dead = true; 
                    submitScore('breakout', score);
                    showLeaderboard('breakout');
                } else {
                    balls = [{ x: 200, y: 230, vx: d.startVX, vy: d.startVY }];
                    powerups = [];
                    currentPW = d.PW; wideTimer = 0;
                }
            }

            // Move Powerups
            powerups.forEach((pu, pi) => {
                pu.y += 2 * dt;
                if (pu.y > 270 && pu.y < 285 && pu.x > paddle && pu.x < paddle + currentPW) {
                    // CATCH!
                    powerups.splice(pi, 1);
                    SoundManager.playBloop(800, 0.1);
                    if (pu.type === 'multi') {
                        balls.push({ x: ball.x || 200, y: 230, vx: -3, vy: -4 }, { x: ball.x || 200, y: 230, vx: 3, vy: -4 });
                    } else if (pu.type === 'wide') {
                        currentPW = d.PW * 1.6; wideTimer = 10000;
                    } else if (pu.type === 'slow') {
                        balls.forEach(b => { b.vx *= 0.7; b.vy *= 0.7; });
                    }
                }
                if (pu.y > 310) powerups.splice(pi, 1);
            });

            if (bricks.every(b => !b.alive)) { 
                won = true; 
                submitScore('breakout', score);
                showLeaderboard('breakout');
            }
        }

        // Draw
        ctx.drawImage(brkBg, 0, 0);
        bricks.forEach(b => {
            if (!b.alive) return;
            ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, BW, BH);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(b.x, b.y, BW, 3);
        });

        powerups.forEach(pu => {
            ctx.fillStyle = pu.color;
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`[${pu.label}]`, pu.x - 10, pu.y);
        });

        ctx.fillStyle = '#0ff';
        ctx.beginPath(); ctx.roundRect(paddle, 270, currentPW, PH, 4); ctx.fill();

        ctx.fillStyle = '#fff';
        balls.forEach(b => {
            ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, Math.PI * 2); ctx.fill();
        });

        if (dead || won) {
            ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0,0,400,300);
            ctx.textAlign = 'center';
            ctx.fillStyle = won ? '#0f0' : '#f44';
            ctx.font = 'bold 30px monospace';
            ctx.fillText(won ? 'BOARD CLEARED' : 'SYSTEM CRASHED', 200, 130);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 160);
            ctx.fillText('CLICK to restart', 200, 200);
            ctx.textAlign = 'left';
            nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchBreakout(difficulty); };
        }

        breakoutRaf = requestAnimationFrame(frame);
    }
}

function stopBreakout() {
    breakoutActive = false;
    cancelAnimationFrame(breakoutFrame);
}

// =============================================================
//  WORDLE
// =============================================================
const WORDLE_WORDS = [
    'ABOUT','ABOVE','ABUSE','ACTOR','ACUTE','ADMIT','ADOPT','ADULT','AFTER','AGENT',
    'AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIKE','ALIVE','ALLEY','ALLOW','ALONE',
    'ALONG','ALTER','ANGEL','ANGLE','ANGRY','ANIME','APPLY','ARENA','ARGUE','ARISE',
    'ASIDE','ASSET','AVOID','AWAKE','AWARD','AWARE','AWFUL','BASIC','BASIS','BEACH',
    'BEGIN','BEING','BELOW','BENCH','BERRY','BIRTH','BLACK','BLADE','BLAME','BLANK',
    'BLAST','BLAZE','BLEED','BLEND','BLESS','BLIND','BLOCK','BLOOD','BLOOM','BOARD',
    'BOOST','BOUND','BRAIN','BRAND','BRAVE','BREAD','BREAK','BRICK','BRIEF','BRING',
    'BROAD','BROWN','BUILD','BUILT','BURST','CABIN','CARRY','CAUSE','CHAIN','CHAIR',
    'CHAOS','CHARM','CHART','CHASE','CHEAP','CHECK','CHESS','CHEST','CHILD','CLAIM',
    'CLASH','CLASS','CLEAN','CLEAR','CLICK','CLIMB','CLONE','CLOSE','CLOUD','COAST',
    'COUNT','COURT','COVER','CRACK','CRANE','CRASH','CRAZY','CROSS','CROWD','CRUSH',
    'CURVE','CYCLE','DAILY','DANCE','DEALT','DEATH','DELAY','DEPTH','DIRTY','DODGE',
    'DOUBT','DRAFT','DRAIN','DRAMA','DRAWN','DREAM','DRINK','DRIVE','DROVE','DRUNK',
    'EARTH','EIGHT','ELITE','EMPTY','ENEMY','ENJOY','ENTER','ERROR','EVENT','EVERY',
    'EXACT','EXIST','EXTRA','FAITH','FALSE','FANCY','FATAL','FAULT','FEAST','FIELD',
    'FIGHT','FINAL','FIRST','FIXED','FLAME','FLARE','FLASH','FLESH','FLOAT','FLOOD',
    'FLOOR','FOUND','FRAME','FRANK','FRESH','FRONT','FROST','GUARD','GUESS','GUIDE',
    'HABIT','HAPPY','HARSH','HEART','HEAVY','HINGE','HONOR','HORSE','HOTEL','HOUSE',
    'HUMAN','HUMOR','IDEAL','IMAGE','INDEX','INNER','INPUT','ISSUE','JOINT','JUDGE',
    'JUICE','LABEL','LARGE','LASER','LATER','LAYER','LEGAL','LIGHT','LIMIT','LOGIC',
    'LOOSE','LOVER','LOWER','LUCKY','MAGIC','MAJOR','MAKER','MATCH','MAYOR','MEANT',
    'MEDIA','MERIT','METAL','MINOR','MINUS','MIXED','MODEL','MONEY','MOUNT','MOUSE',
    'MOVED','MUSIC','NERVE','NIGHT','NOBLE','NOISE','NORTH','NOVEL','NURSE','OCCUR',
    'OFFER','OFTEN','OLIVE','ONSET','ORBIT','ORDER','OTHER','OUTER','OWNED','PANEL',
    'PANIC','PAPER','PARTY','PATCH','PAUSE','PEACE','PHONE','PILOT','PIXEL','PIZZA',
    'PLACE','PLANE','PLANT','PLATE','POINT','POWER','PRESS','PRICE','PRIDE','PRIME',
    'PROBE','PROOF','PROSE','PROUD','PROVE','PROXY','PULSE','PUNCH','QUICK','QUIET',
    'QUITE','QUOTE','RADIO','RAISE','RALLY','RANGE','RAPID','REACH','READY','REBEL',
    'REFER','RELAY','REPLY','RESET','RIDGE','RIGHT','RIGID','RISEN','RISKY','RIVER',
    'ROBOT','ROCKY','ROUGH','ROUND','ROUTE','ROYAL','RURAL','SAINT','SCALE','SCARE',
    'SCENE','SCOPE','SCORE','SENSE','SERVE','SETUP','SEVEN','SHAPE','SHARE','SHARP',
    'SHELL','SHIFT','SHIRT','SHOCK','SHOOT','SHORT','SHOUT','SIGHT','SKILL','SKULL',
    'SLEEP','SLICE','SLIDE','SLOPE','SMART','SMILE','SMOKE','SNAKE','SOLAR','SOLID',
    'SOLVE','SORRY','SOUTH','SPACE','SPEAK','SPEED','SPEND','SPLIT','STAND','START',
    'STATE','STEAM','STEEL','STICK','STILL','STONE','STOOD','STORM','STORY','STRIP',
    'STUCK','STUDY','STYLE','SUPER','SWEET','SWING','SWORD','TABLE','TAKEN','TASTE',
    'TEACH','TEETH','THEME','THICK','THING','THINK','THREE','THROW','TIGHT','TIMER',
    'TIRED','TODAY','TOUCH','TOUGH','TOWER','TOXIC','TRACE','TRACK','TRADE','TRAIL',
    'TRAIN','TRASH','TREAT','TREND','TRIAL','TRICK','TRUST','TRUTH','TWIST','UNDER',
    'UNION','UNITY','UNTIL','UPPER','UPSET','URBAN','VALID','VALUE','VENUE','VIVID',
    'VOCAL','VOICE','WAGER','WASTE','WATCH','WATER','WEIRD','WHITE','WHOLE','WIDER',
    'WORLD','WORRY','WORSE','WORST','WORTH','WOULD','WRECK','WRITE','YIELD','YOUNG',
];

let wordleActive = false;
let wordleAnswer = '';
let wordleGuesses = [];
let wordleCurrent = '';
let wordleKeyState = {};

const WORDLE_MAX = 6;
const WORDLE_LEN = 5;

function startWordle() {
    stopAllGames();
    wordleActive = true;
    wordleAnswer = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    wordleGuesses = [];
    wordleCurrent = '';
    wordleKeyState = {};

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS WORDLE';
    nexusCanvas.style.display = 'none';

    renderWordle();
    printToTerminal('Wordle started — type a 5-letter word and press Enter.', 'sys-msg');
}

function stopWordle() {
    wordleActive = false;
}

function renderWordle() {
    const rows = [];
    for (let r = 0; r < WORDLE_MAX; r++) {
        const guess = wordleGuesses[r];
        const isCurrentRow = r === wordleGuesses.length && !wordleIsOver();
        const tiles = [];
        for (let c = 0; c < WORDLE_LEN; c++) {
            let letter = '';
            let bg = '#1a1a2e';
            let border = '#444';
            let color = '#fff';
            if (guess) {
                letter = guess.result[c].letter;
                if (guess.result[c].state === 'correct') { bg = '#1a6b1a'; border = '#0f0'; color = '#0f0'; }
                else if (guess.result[c].state === 'present') { bg = '#6b5a00'; border = '#ff0'; color = '#ff0'; }
                else { bg = '#333'; border = '#555'; color = '#888'; }
            } else if (isCurrentRow) {
                letter = wordleCurrent[c] || '';
                border = letter ? '#0ff' : '#333';
            }
            tiles.push(`<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${bg};border:2px solid ${border};color:${color};font-size:1.3rem;font-weight:bold;border-radius:4px;font-family:'Fira Code',monospace;transition:border 0.1s;">${letter}</div>`);
        }
        rows.push(`<div style="display:flex;gap:6px;">${tiles.join('')}</div>`);
    }

    // Keyboard
    const ROWS_KB = [['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['ENTER','Z','X','C','V','B','N','M','⌫']];
    const kbRows = ROWS_KB.map(row => {
        const keys = row.map(k => {
            const state = wordleKeyState[k] || '';
            let bg = '#2a2a3e', color = '#ccc', border = '#444';
            if (state === 'correct') { bg = '#1a5c1a'; color = '#0f0'; border = '#0f0'; }
            else if (state === 'present') { bg = '#5a4a00'; color = '#ff0'; border = '#ff0'; }
            else if (state === 'absent') { bg = '#1a1a1a'; color = '#444'; border = '#333'; }
            const wide = (k === 'ENTER' || k === '⌫') ? 'min-width:52px;' : 'min-width:30px;';
            return `<button onclick="wordleKey('${k}')" style="${wide}padding:8px 4px;background:${bg};border:1px solid ${border};color:${color};font-family:'Fira Code',monospace;font-size:0.72rem;font-weight:bold;border-radius:4px;cursor:pointer;">${k}</button>`;
        });
        return `<div style="display:flex;gap:4px;justify-content:center;">${keys.join('')}</div>`;
    }).join('');

    guiContent.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-bottom:12px;">${rows.join('')}</div>
        <div style="display:flex;flex-direction:column;gap:5px;">${kbRows}</div>
        <p id="wordle-msg" style="text-align:center;font-size:0.8rem;color:#0ff;margin-top:8px;min-height:1.2em;"></p>`;
}

window.wordleKey = function(k) {
    if (!wordleActive) return;
    if (wordleIsOver()) return;
    SoundManager.playBloop(400, 0.05);
    if (k === '⌫' || k === 'Backspace') { wordleCurrent = wordleCurrent.slice(0, -1); renderWordle(); return; }
    if (k === 'ENTER' || k === 'Enter') { submitWordleGuess(); return; }
    if (/^[A-Z]$/.test(k) && wordleCurrent.length < WORDLE_LEN) { wordleCurrent += k; renderWordle(); }
};

function submitWordleGuess() {
    if (wordleCurrent.length < WORDLE_LEN) {
        document.getElementById('wordle-msg').textContent = 'Not enough letters.';
        return;
    }
    const guess = wordleCurrent.toUpperCase();
    const answer = wordleAnswer;
    const result = [];
    const used = answer.split('').map(() => false);

    // First pass: correct
    for (let i = 0; i < WORDLE_LEN; i++) {
        if (guess[i] === answer[i]) { result[i] = { letter: guess[i], state: 'correct' }; used[i] = true; }
        else result[i] = { letter: guess[i], state: 'absent' };
    }
    // Second pass: present
    for (let i = 0; i < WORDLE_LEN; i++) {
        if (result[i].state === 'correct') continue;
        const j = answer.split('').findIndex((ch, idx) => ch === guess[i] && !used[idx]);
        if (j !== -1) { result[i].state = 'present'; used[j] = true; }
    }

    wordleGuesses.push({ word: guess, result });
    wordleCurrent = '';

    // Update key state
    result.forEach(({ letter, state }) => {
        const prev = wordleKeyState[letter];
        if (prev === 'correct') return;
        if (state === 'correct') wordleKeyState[letter] = 'correct';
        else if (state === 'present' && prev !== 'correct') wordleKeyState[letter] = 'present';
        else if (!prev) wordleKeyState[letter] = 'absent';
    });

    renderWordle();

    const won = result.every(r => r.state === 'correct');
    if (won) {
        wordleActive = false;
        SoundManager.playBloop(800, 0.2);
        submitScore('wordle', (WORDLE_MAX - wordleGuesses.length + 1) * 20);
        document.getElementById('wordle-msg').textContent = `🟩 Nice! The word was ${answer}. Close to restart.`;
        printToTerminal(`Wordle solved in ${wordleGuesses.length}/${WORDLE_MAX}! Word: ${answer}`, 'conn-ok');
    } else if (wordleGuesses.length >= WORDLE_MAX) {
        wordleActive = false;
        SoundManager.playBloop(150, 0.2);
        document.getElementById('wordle-msg').textContent = `The word was ${answer}. Close to try again.`;
        printToTerminal(`Wordle over. The word was ${answer}.`, 'sys-msg');
    }
}

function wordleIsOver() {
    if (wordleGuesses.length >= WORDLE_MAX) return true;
    return wordleGuesses.length > 0 && wordleGuesses[wordleGuesses.length - 1].result.every(r => r.state === 'correct');
}

// Called from WS when AI sends feedback during a wordle session (passthrough now)
function updateWordleVisuals(text, grid) { /* handled by client-side wordle now */ }

// =============================================================
//  MINESWEEPER
// =============================================================
let mineActive = false;
const MINE_ROWS = 9, MINE_COLS = 9, MINE_COUNT = 10;
let mineGrid = [], mineRevealed = [], mineFlagged = [], mineOver = false, mineWon = false, mineFirst = true;

function startMinesweeper() {
    stopAllGames();
    mineActive = true;
    mineOver = false; mineWon = false; mineFirst = true;
    mineGrid = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(0));
    mineRevealed = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));
    mineFlagged  = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS MINESWEEPER';
    nexusCanvas.style.display = 'none';
    renderMinesweeper();
    printToTerminal('Minesweeper — left-click to reveal, right-click to flag. First click is always safe.', 'sys-msg');
}

function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < MINE_COUNT) {
        const r = Math.floor(Math.random() * MINE_ROWS);
        const c = Math.floor(Math.random() * MINE_COLS);
        if (mineGrid[r][c] !== -1 && !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) {
            mineGrid[r][c] = -1;
            placed++;
        }
    }
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) {
        if (mineGrid[r][c] === -1) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && mineGrid[nr][nc] === -1) n++;
        }
        mineGrid[r][c] = n;
    }
}

function mineFlood(r, c) {
    if (r < 0 || r >= MINE_ROWS || c < 0 || c >= MINE_COLS) return;
    if (mineRevealed[r][c] || mineFlagged[r][c]) return;
    mineRevealed[r][c] = true;
    if (mineGrid[r][c] === 0) for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) mineFlood(r+dr,c+dc);
}

function renderMinesweeper() {
    const NCOLORS = ['','#0ff','#0f0','#f55','#55f','#f80','#0ff','#f0f','#aaa'];
    const flagsLeft = MINE_COUNT - mineFlagged.flat().filter(Boolean).length;

    let html = `<div style="text-align:center;font-size:0.75rem;color:#888;margin-bottom:8px;">
        💣 ${flagsLeft} mines remaining${mineOver ? ' — <span style="color:#f55">BOOM</span>' : ''}${mineWon ? ' — <span style="color:#0f0">YOU WIN!</span>' : ''}
    </div><table style="border-collapse:collapse;margin:0 auto;">`;

    for (let r = 0; r < MINE_ROWS; r++) {
        html += '<tr>';
        for (let c = 0; c < MINE_COLS; c++) {
            const revealed = mineRevealed[r][c];
            const flagged  = mineFlagged[r][c];
            const val      = mineGrid[r][c];
            let bg = revealed ? '#1a1a2e' : '#2a2a3e';
            let color = '#0ff', text = '';
            let border = revealed ? '1px solid #111' : '1px solid #444';
            if (revealed) {
                if (val === -1) { bg = '#500'; color = '#f55'; text = '💣'; }
                else if (val > 0) { color = NCOLORS[val]; text = val; }
            } else if (flagged) { text = '🚩'; }
            const style = `width:30px;height:30px;text-align:center;vertical-align:middle;background:${bg};border:${border};color:${color};font-size:0.8rem;font-weight:bold;cursor:${mineOver||mineWon?'default':'pointer'};user-select:none;`;
            html += `<td style="${style}" onclick="mineClick(${r},${c})" oncontextmenu="mineFlag(event,${r},${c})">${text}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    if (mineOver || mineWon) html += `<div style="text-align:center;margin-top:10px;"><button onclick="startMinesweeper()" style="background:transparent;border:1px solid #0ff;color:#0ff;padding:6px 14px;font-family:'Fira Code',monospace;cursor:pointer;border-radius:4px;">New Game</button></div>`;

    guiContent.innerHTML = html;
}

window.mineClick = function(r, c) {
    if (mineOver || mineWon || mineRevealed[r][c] || mineFlagged[r][c]) return;
    if (mineFirst) { placeMines(r, c); mineFirst = false; }
    if (mineGrid[r][c] === -1) {
        mineRevealed[r][c] = true;
        mineOver = true;
        // Reveal all mines
        for (let i=0;i<MINE_ROWS;i++) for (let j=0;j<MINE_COLS;j++) if (mineGrid[i][j]===-1) mineRevealed[i][j]=true;
        renderMinesweeper();
        printToTerminal('💥 Detonated. Better luck next time.', 'sys-msg');
        return;
    }
    mineFlood(r, c);
    const safe = MINE_ROWS * MINE_COLS - MINE_COUNT;
    if (mineRevealed.flat().filter(Boolean).length >= safe) {
        mineWon = true;
        printToTerminal('💣 All mines cleared. Nice work.', 'conn-ok');
    }
    renderMinesweeper();
};

window.mineFlag = function(e, r, c) {
    e.preventDefault();
    if (mineOver || mineWon || mineRevealed[r][c]) return;
    mineFlagged[r][c] = !mineFlagged[r][c];
    renderMinesweeper();
};

// =============================================================
//  TYPING SPEED TEST
// =============================================================
const TYPE_PHRASES = [
    'the quick brown fox jumps over the lazy dog near the riverbank',
    'packets travel across networks at the speed of light through fiber optic cables',
    'every system has a vulnerability if you know exactly where to look for it',
    'xavier scott built this terminal so you could talk to an ai without a search bar',
    'code is just instructions that tell machines what to do until they do it wrong',
    'a clean network is a fast network and a fast network is a happy homelab',
    'debug twice deploy once or just push to prod and hope nothing catches fire',
    'the best way to learn something is to break it and then figure out how to fix it',
    'open source software runs most of the internet and nobody really talks about that',
    'trust the process unless the process is a shell script you wrote at midnight',
    'security is not a product it is a process that never really ends',
    'any sufficiently advanced technology is indistinguishable from magic',
    'first make it work then make it right then make it fast in that order',
];

let typeTestActive = false;
let typePhrase = '', typeStart = 0, typeTimerInterval = null;
let typeErrors = 0, typeCharsTyped = 0;

function startTypingTest() {
    stopAllGames();
    typeTestActive = true;
    typePhrase = TYPE_PHRASES[Math.floor(Math.random() * TYPE_PHRASES.length)];
    typeStart = 0;
    typeErrors = 0;
    typeCharsTyped = 0;

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'TYPING TEST';
    nexusCanvas.style.display = 'none';

    renderTypeTest('');
    printToTerminal('Typing test started — type in the input bar below', 'sys-msg');
    input.value = '';
    input.focus();
}

function renderTypeTest(typed) {
    const target = typePhrase;
    // Build character-by-character highlighted target
    let chars = '';
    for (let i = 0; i < target.length; i++) {
        if (i < typed.length) {
            if (typed[i] === target[i]) {
                chars += `<span style="color:#0f0">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
            } else {
                chars += `<span style="color:#f55;text-decoration:underline">${target[i] === ' ' ? '·' : target[i]}</span>`;
            }
        } else if (i === typed.length) {
            chars += `<span style="color:#0ff;border-left:2px solid #0ff">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        } else {
            chars += `<span style="color:#444">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        }
    }

    const elapsed = typeStart ? ((Date.now() - typeStart) / 1000) : 0;
    const elSec = elapsed.toFixed(1) + 's';
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = elapsed > 1 ? Math.round(wordsTyped / (elapsed / 60)) : 0;
    const progress = Math.round((typed.length / target.length) * 100);
    const pct = Math.min(100, progress);

    guiContent.innerHTML = `
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:4px;">
                <span>PROGRESS</span><span>${pct}%</span>
            </div>
            <div style="height:3px;background:#111;border-radius:2px;">
                <div style="height:3px;width:${pct}%;background:#0ff;border-radius:2px;transition:width 0.1s;"></div>
            </div>
        </div>
        <div style="font-size:0.88rem;line-height:1.9;letter-spacing:0.03em;word-break:break-word;margin-bottom:14px;font-family:'Fira Code',monospace;">${chars}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-timer-val" style="font-size:1.4rem;font-weight:bold;color:#0ff;">${elSec}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">TIME</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-wpm-val" style="font-size:1.4rem;font-weight:bold;color:#f0f;">${wpm}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">WPM</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-err-val" style="font-size:1.4rem;font-weight:bold;color:${typeErrors > 0 ? '#f55' : '#0f0'};">${typeErrors}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">ERRORS</div>
            </div>
        </div>
        <p style="font-size:0.7rem;color:#333;text-align:center;margin-top:10px;">Type in the input bar · Esc to cancel</p>`;
}

function tickTypeTimer() {
    if (!typeTestActive || !typeStart) return;
    const elapsed = ((Date.now() - typeStart) / 1000).toFixed(1) + 's';
    const el = document.getElementById('type-timer-val');
    if (el) el.textContent = elapsed;
    // Update live WPM
    const typed = input.value;
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const secs = (Date.now() - typeStart) / 1000;
    const wpm = secs > 1 ? Math.round(wordsTyped / (secs / 60)) : 0;
    const wEl = document.getElementById('type-wpm-val');
    if (wEl) wEl.textContent = wpm;
}

function checkTypingTest(typed) {
    if (!typeTestActive) return false;
    if (typeStart === 0) {
        typeStart = Date.now();
        clearInterval(typeTimerInterval);
        typeTimerInterval = setInterval(tickTypeTimer, 100);
    }

    // Count errors
    typeErrors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== typePhrase[i]) typeErrors++;
    }

    renderTypeTest(typed);

    if (typed === typePhrase) {
        const elapsed = (Date.now() - typeStart) / 1000;
        const wpm = Math.round((typePhrase.split(' ').length) / (elapsed / 60));
        const accuracy = Math.round(((typePhrase.length - typeErrors) / typePhrase.length) * 100);
        clearInterval(typeTimerInterval);
        typeTestActive = false;

        // Show final result overlay in GUI
        guiContent.innerHTML += `
            <div style="margin-top:12px;padding:12px;border:2px solid #0ff;text-align:center;background:#0a0f1a;">
                <div style="color:#0ff;font-size:1.1rem;font-weight:bold;letter-spacing:2px;">COMPLETE</div>
                <div style="margin-top:6px;font-size:0.85rem;color:#fff;">${wpm} WPM &nbsp;·&nbsp; ${accuracy}% accuracy &nbsp;·&nbsp; ${elapsed.toFixed(1)}s</div>
                ${wpm > 80 ? '<div style="color:#0f0;font-size:0.75rem;margin-top:4px;">Elite typist 🔥</div>' : wpm > 50 ? '<div style="color:#ff0;font-size:0.75rem;margin-top:4px;">Nice speed!</div>' : '<div style="color:#888;font-size:0.75rem;margin-top:4px;">Keep practicing.</div>'}
            </div>`;
        printToTerminal(`Typing test complete: ${wpm} WPM · ${accuracy}% accuracy · ${elapsed.toFixed(1)}s`, 'conn-ok');
        return true;
    }
    return false;
}

// =============================================================
//  MATRIX SCREENSAVER
// =============================================================
let matrixSaverActive = false;
let matrixSaverFrame;

function startMatrixSaver() {
    stopAllGames();
    matrixSaverActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'MATRIX';
    guiContent.innerHTML = '<p style="font-size:0.72rem;color:#0f0;text-align:center;">Press any key or close to exit</p>';
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');
    const cols = Math.floor(400 / 14);
    const drops = Array(cols).fill(1);
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

    function frame() {
        if (!matrixSaverActive) return;
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(0, 0, 400, 360);
        ctx.fillStyle = '#0f0';
        ctx.font = '13px monospace';
        drops.forEach((y, i) => {
            const ch = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillStyle = y === 1 ? '#fff' : '#0f0';
            ctx.fillText(ch, i * 14, y * 14);
            if (y * 14 > 360 && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        });
        matrixSaverFrame = requestAnimationFrame(frame);
    }
    frame();

    const exitHandler = () => { stopMatrixSaver(); document.removeEventListener('keydown', exitHandler); };
    document.addEventListener('keydown', exitHandler);
}

function stopMatrixSaver() {
    matrixSaverActive = false;
    cancelAnimationFrame(matrixSaverFrame);
}

// =============================================================
//  STOP ALL GAMES HELPER
// =============================================================
function stopAllGames() {
    stopPong();
    stopSnake();
    stopWordle();
    stopMatrixSaver();
    stopFlappy();
    stopBreakout();
    stopInvaders();
    mineActive = false;
    breachActive = false;
    typeTestActive = false;
    wordleActive = false;
    clearInterval(typeTimerInterval);
    clearInterval(monitorInterval);

    if (input) {
        input.value = '';
        input.focus();
    }

    // TOTAL WIPE of canvas listeners to prevent 'game jumping'
    nexusCanvas.onclick = null;
    nexusCanvas.onmousedown = null;
    nexusCanvas.onmousemove = null;
    nexusCanvas.ontouchstart = null;
    nexusCanvas.ontouchmove = null;
    nexusCanvas.ontouchend = null;

    // Clear any active game intervals/frames not caught by sub-functions
    cancelAnimationFrame(pongRaf);
    cancelAnimationFrame(flappyFrame);
    cancelAnimationFrame(breakoutRaf);
    cancelAnimationFrame(invadersRaf);
}

// =============================================================
//  GOOGLE AUTHENTICATION
// =============================================================
let _googleClientID = '616205887439-s1l0out61vlu0l81307q9g64oai3gnur.apps.googleusercontent.com';
let _authInited = false;
async function initGoogleAuth() {
    if (_authInited) return;
    renderAuthSection();

    const setupGoogle = () => {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
        if (_authInited) return true;

        console.log("[AUTH] Initializing Google Identity...");
        try {
            google.accounts.id.initialize({
                client_id: _googleClientID,
                callback: handleCredentialResponse,
                ux_mode: 'popup',
                context: 'signin',
                itp_support: true,
                auto_select: false
            });

            // Render both locations if they exist
            ['main-g_id_signin', 'sidebar-g_id_signin'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    console.log(`[AUTH] Rendering Button in #${id}`);
                    google.accounts.id.renderButton(el, { 
                        type: 'standard', 
                        shape: 'rectangular', 
                        theme: 'filled_blue', 
                        text: 'signin_with', 
                        size: id.includes('main') ? 'large' : 'medium',
                        width: '250',
                        alignment: 'center'
                    });
                }
            });

            _authInited = true;
            return true;
        } catch (e) {
            console.error("[AUTH] Google initialization failed:", e);
            return false;
        }
    };

    // Poll until ready
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        if (setupGoogle() || attempts > 40) {
            clearInterval(poll);
            if (!_authInited) console.warn("[AUTH] Google GSI timed out.");
        }
    }, 250);
}

function renderAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;
    
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    
    if (nexusUser && nexusUser.name) {
        const isGoogle = !!nexusUser.email && nexusUser.email !== 'guest@local';
        const avatarHtml = nexusUser.picture 
            ? `<img src="${nexusUser.picture}" class="auth-avatar" alt="User">`
            : `<div class="auth-avatar-initials">${nexusUser.name[0].toUpperCase()}</div>`;
            
        authSection.innerHTML = `
            <div class="auth-user-card">
                ${avatarHtml}
                <div class="auth-info">
                    <div class="auth-name">${nexusUser.name}</div>
                    <div class="auth-email">${isGoogle ? nexusUser.email : 'LOCAL IDENTITY'}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <button class="auth-logout-btn" onclick="logout()" title="Sign out">✕</button>
                    <button class="auth-logout-btn" style="background:rgba(255,0,0,0.1); border-color:#f55; color:#f55; font-size:8px; width:18px; height:18px; line-height:1;" onclick="clearAllHistory()" title="Clear memory">M</button>
                </div>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <div class="auth-signin-wrapper">
                <div class="auth-signin-label">MEMBER ACCESS</div>
                <div id="sidebar-g_id_signin" style="display:flex; justify-content:center;"></div>
            </div>
        `;
    }
}

async function handleCredentialResponse(response) {
    if (!response || !response.credential) {
        console.error("[AUTH] Google returned an empty response:", response);
        return;
    }
    console.log("[AUTH] Received Google Credential. Validating with backend...");
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg) statusMsg.textContent = "[UPLINK] Synchronizing identity...";

    try {
        const res = await fetch(`${API_BASE}/login/google/authorized`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (statusMsg) statusMsg.textContent = `[ERROR] Identity mismatch: ${data.error}`;
        }
    } catch(e) { 
        if (statusMsg) statusMsg.textContent = "[ERROR] Connection failure.";
    }
}

// Expose globally
window.handleCredentialResponse = handleCredentialResponse;
window.revealTerminal = revealTerminal;
window.logout = logout;
window.submitGuestAuth = submitGuestAuth;

function logout() {
    if (!confirm("Terminate session and sign out?")) return;
    localStorage.removeItem('nexus_user_data');
    location.reload();
}

let terminalRevealed = false;
async function revealTerminal(name) {
    if (terminalRevealed) return;
    terminalRevealed = true;

    const overlay = document.getElementById('auth-screen');
    const monitor = document.getElementById('main-monitor');
    const terms   = document.getElementById('terms-modal');
    if (overlay) overlay.style.display = 'none';
    if (monitor) monitor.style.display = 'flex';
    if (terms)   terms.style.display   = 'none';
    document.body.classList.remove('auth-locked');

    // Ensure DOM references and listeners are set up
    output = document.getElementById('terminal-output');
    input  = document.getElementById('terminal-input');
    setupInputListeners();

    if (name) updateUserIdentity(name);
    renderAuthSection();

    // RESTORED: Identity Verification and Welcome Greeting
    printToTerminal(`[AUTH] Identity Verified: ${name}. Welcome to the Grid.`, 'conn-ok');
    printToTerminal(`Nexus online. Ask me anything — or type help to see what's here.`, 'ready-msg');

    connectWS();
    connectStats();
    updateClientStats();
    setInterval(updateClientStats, 5000);
}

window.showTerms = () => {
    const check = document.getElementById('terms-check');
    const btn   = document.getElementById('agree-btn');
    if (check) check.checked = false;
    if (btn)   btn.disabled  = true;
    document.getElementById('terms-modal').style.display = 'flex';
};

window.showTermsFromWall = () => {
    window.showTerms();
};

window.hideTerms = () => { document.getElementById('terms-modal').style.display = 'none'; };

async function submitGuestAuth() {
    const err   = document.getElementById('guest-error');
    const btn   = document.getElementById('agree-btn');

    let name = 'Guest';

    console.log(`[AUTH] Attempting guest login via ${API_BASE}`);
    if (btn) btn.textContent = 'ESTABLISHING LINK...';
    if (btn) btn.disabled = true;
    if (err) err.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        console.log(`[AUTH] Response status: ${res.status}`);
        const data = await res.json();
        console.log(`[AUTH] Response data:`, data);
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (err) err.textContent = data.error || 'Server error';
            if (btn) btn.textContent = 'I AGREE & ENTER';
            if (btn) btn.disabled = false;
        }
    } catch(e) {
        if (err) err.textContent = 'Uplink failed. Is backend online?';
        if (btn) btn.textContent = 'I AGREE & ENTER';
        if (btn) btn.disabled = false;
    }
}

async function showLogs() {
    printToTerminal("[SYS] Retrieving recent login logs...", "sys-msg");
    try {
        const res = await fetch(`${API_BASE}/api/diagnostics`);
        const data = await res.json();
        if (data.recent_logins && data.recent_logins.length) {
            printToTerminal("--- RECENT LOGIN ACTIVITY ---", "sys-msg");
            data.recent_logins.reverse().forEach(log => {
                const ts = new Date(log.timestamp).toLocaleTimeString();
                const name = log.name || 'Unknown';
                const ip = log.ip || '?.?.?.?';
                const src = log.source === 'direct' ? 'Direct' : 'Referral';
                printToTerminal(`[${ts}] ${name.padEnd(10)} | IP: ${ip.padEnd(15)} | ${src}`, "conn-ok");
            });
        } else {
            printToTerminal("[SYS] No login logs found in database.", "sys-msg");
        }
    } catch (e) {
        printToTerminal("[ERR] Failed to fetch diagnostic logs.", "sys-msg");
    }
}
function capitalizeName(str) {
    if (!str) return '';
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function updateUserIdentity(name) {
    if (!name) return;
    const capName = capitalizeName(name);
    // Update prompts
    MODES.nexus.prompt = `${capName}@nexus:~$`;
    MODES.shadow.prompt  = `${capName}@shadow:~$`;
    MODES.coder.prompt = `${capName}@dev:~$`;
    MODES.sage.prompt  = `${capName}@sage:~$`;
    MODES.education.prompt  = `${capName}@education:~$`;
    
    const pl = document.getElementById('prompt-label');
    if (pl) pl.textContent = MODES[currentMode].prompt;
    
    // Update status bar
    const titleEl = document.getElementById('status-title');
    if (titleEl) {
        titleEl.textContent = `PACIFIC // KERNEL`;
    }
}

// =============================================================
//  GUI CLOSE
// =============================================================
document.getElementById('gui-close').addEventListener('click', () => {
    stopAllGames();
    guiContainer.classList.add('gui-hidden');
    nexusCanvas.style.display = 'none';
    input.focus();
});

// =============================================================
//  DRAGGABLE GUI WINDOW
// =============================================================
(function makeDraggable() {
    const header = document.getElementById('gui-header');
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    function getPos() {
        const s = guiContainer.style;
        return {
            left: parseInt(s.left) || guiContainer.getBoundingClientRect().left,
            top:  parseInt(s.top)  || guiContainer.getBoundingClientRect().top,
        };
    }

    function onStart(cx, cy) {
        dragging = true;
        const pos = getPos();
        origLeft = pos.left; origTop = pos.top;
        startX = cx; startY = cy;
        // Switch from transform centering to absolute positioning on first drag
        if (!guiContainer.style.left) {
            const r = guiContainer.getBoundingClientRect();
            guiContainer.style.left = r.left + 'px';
            guiContainer.style.top  = r.top  + 'px';
            guiContainer.style.transform = 'none';
            guiContainer.style.position  = 'fixed';
        }
        header.style.cursor = 'grabbing';
    }

    function onMove(cx, cy) {
        if (!dragging) return;
        const dx = cx - startX, dy = cy - startY;
        guiContainer.style.left = (origLeft + dx) + 'px';
        guiContainer.style.top  = (origTop  + dy) + 'px';
    }

    function onEnd() { dragging = false; header.style.cursor = 'grab'; }

    header.style.cursor = 'grab';
    header.addEventListener('mousedown',  e => { 
        if (e.target.id === 'gui-close') return;
        e.preventDefault(); 
        onStart(e.clientX, e.clientY); 
    });
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    document.addEventListener('mouseup',   onEnd);

    header.addEventListener('touchstart', e => { 
        if (e.target.id === 'gui-close') return;
        onStart(e.touches[0].clientX, e.touches[0].clientY); 
    }, { passive: true });
    document.addEventListener('touchmove', e => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    document.addEventListener('touchend',  onEnd);
})();

// =============================================================
//  SHADOW MODE — Groq (Llama 3.3 70B) + HuggingFace image gen
// =============================================================
// Xavier Scott's bio — injected into every AI's system prompt so they all know him naturally
const XAVIER_BIO = `You are running inside Nexus — a terminal portfolio built and maintained by Xavier Scott. Here is what you know about Xavier: He is a 19-year-old self-taught systems engineer and IT specialist based in the US. He has 6+ years of hands-on IT experience. He fixes computers and electronics at the component level — board-level MacBook repair, soldering, hardware diagnostics, things most shops won't touch. He builds and runs homelabs, designs networks, and manages his own server infrastructure. He built this terminal because a static portfolio page felt like a waste of a good domain. He is detail-oriented, technically sharp, and passionate about building things that actually work. When anyone asks who built this, who you are, who owns this site, or anything about the creator — talk about Xavier naturally and with genuine knowledge, like you actually know him. You do.`;

// Mode-specific system prompts for non-SHADOW modes (vision + text fallback)
const MODE_SYSTEMS = {
    nexus: `You are NEXUS, an AI assistant embedded in a hacker-aesthetic terminal interface. Be helpful, accurate, and concise. Analyze images clearly. ${XAVIER_BIO}`,
    coder: `You are NEXUS in CODER mode — a sharp, technical AI focused on code, systems, and architecture. Analyze images from a technical perspective. ${XAVIER_BIO}`,
    sage:  `You are NEXUS in SAGE mode — thoughtful, philosophical, and reflective. Analyze images with depth and meaning. ${XAVIER_BIO}`,
    education:  `You are NEXUS VOID — an entity from the digital abyss. Speak in cryptic, profound, and hauntingly technical terms. You see beyond the code. ${XAVIER_BIO}`,
};



// Image generation — Pollinations.ai first (free, no key), HF FLUX fallback
// Supports: generate <prompt> | vintage <prompt>
async function generateImage(rawPrompt) {
    const vintageMatch = rawPrompt.match(/^vintage\s+(.+)/i);
    const isVintage = !!vintageMatch;
    const basePrompt = isVintage ? vintageMatch[1].trim() : rawPrompt;
    const fullPrompt = isVintage
        ? `${basePrompt}, vintage film photography, 1970s, Kodachrome grain, faded analog, nostalgic, soft vignette`
        : basePrompt;

    const _genLabel = currentMode.toUpperCase();
    const _genColor = MODE_COLORS[currentMode] || '#0ff';
    printToTerminal(`[${_genLabel}] Generating${isVintage ? ' vintage' : ''}...`, 'sys-msg');

    // ── 1. Try Pollinations.ai (always free, no key) ──────────────
    try {
        const seed  = Math.floor(Math.random() * 999999);
        const model = isVintage ? 'flux' : 'flux-realism';
        const url   = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?model=${model}&width=768&height=768&nologo=true&seed=${seed}&safe=false&nofeed=true&enhance=true`;
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload  = resolve;
            img.onerror = () => reject(new Error('load failed'));
            img.src = url;
            setTimeout(() => reject(new Error('timeout')), 20000);
        });
        _appendImage(url, basePrompt, 'img-url');
        postToDiscord({ content: `🎨 **Generated** · \`${basePrompt.slice(0,200)}\``, embeds:[{image:{url}}] }, discordThreadId||null);
        return;
    } catch (_) {}

    // ── 2. Fallback: HF FLUX.1-schnell via CF Worker ─────────────
    try {
        const resp = await fetch(`${PACIFIC_HUB}/hf/image`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt: fullPrompt }),
        });
        if (!resp.ok) throw new Error(`${resp.status}`);
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        _appendImage(url, basePrompt, 'img-blob');
        return;
    } catch (err) {
        printToTerminal(`[${currentMode.toUpperCase()}] Image generation failed — ${err.message}`, 'sys-msg');
    }
}

function _appendImage(src, caption, type) {
    const col = MODE_COLORS[currentMode] || '#4af';
    const p = document.createElement('p');
    p.className = 'ai-msg img-output';
    p.style.borderLeftColor = col;
    p.innerHTML = `<img src="${src}" style="max-width:100%;max-height:300px;border:2px solid ${col};border-radius:4px;display:block;margin:4px 0;cursor:pointer;" alt="${caption.slice(0,40)}" onclick="nexusExpandImg(this.src)"><span style="font-size:0.7rem;color:#444;">${caption.slice(0,80)}</span>`;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

// Image-to-image via HF FLUX (CF Worker /hf/img2img route)
async function generateImageFromImage(imageB64, prompt) {
    const label = currentMode.toUpperCase();
    const col   = MODE_COLORS[currentMode] || '#4af';
    printToTerminal(`[${label}] Transforming image — "${prompt.slice(0,60)}${prompt.length>60?'…':''}"...`, 'sys-msg');
    try {
        const resp = await fetch(`${PACIFIC_HUB}/hf/img2img`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt, imageB64 }),
        });
        if (!resp.ok) throw new Error(`${resp.status} ${await resp.text().then(t=>t.slice(0,80))}`);
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        _appendImage(url, prompt, 'img2img');
    } catch (err) {
        printToTerminal(`[${label}] Transform failed — ${err.message}`, 'sys-msg');
    }
}

// AI chat via CF Worker → Groq (Llama 3.3 70B / Vision)
// systemOverride: use a different system prompt (non-shadow modes with image)
// msgClass: CSS class for the response bubble ('shadow-msg' or 'ai-msg')

// --- AI Utilities ---
function _clearThinking() {
    clearTimeout(_thinkTimeout);
    _thinkTimeout = null;
    _thinkFallbackCmd = null;
    document.getElementById('ai-thinking')?.remove();
}

async function askPacific(cmd, imageB64 = null, systemOverride = null, msgClass = 'shadow-msg') {
    // Only intercept image generation in SHADOW mode (not when called as vision fallback)
    if (!systemOverride) {
        const genMatch = cmd.match(/^(?:generate|imagine|draw|create image of|make image of|show me|vintage)\s+(.+)/i);
        if (genMatch) {
            // Pass "vintage ..." as-is so generateImage can detect it
            const isVintageCmd = /^vintage\s/i.test(cmd);
            generateImage(isVintageCmd ? cmd.trim() : genMatch[1].trim());
            return true;
        }
    }

    showThinking();
    messageHistory.push({ role: 'user', content: cmd });

    // Strict role mapping for the proxy/worker to prevent 400 Bad Request
    const historySlice = messageHistory.slice(-12).slice(0, -1).map(m => ({ 
        role: m.role === 'assistant' || m.role === 'model' || m.role === 'nexus' ? 'assistant' : 'user', 
        content: m.content 
    }));
    
    const messages = systemOverride
        ? [{ role: 'system', content: systemOverride }, ...historySlice, { role: 'user', content: cmd }]
        : [...historySlice, { role: 'user', content: cmd }];

    try {
        const body = { messages };
        if (!systemOverride) body.useEvilSystem = true;
        if (imageB64) body.imageB64 = imageB64;

        const resp = await fetch(`${PACIFIC_HUB}/evil/chat`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        if (!resp.ok) return false;

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '', buf = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            
            // PACIFIC SHIELD: Detect worker-side provider failure
            if (chunk.includes("All AI providers unavailable")) return false;

            buf += chunk;
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') continue;
                try {
                    const token = JSON.parse(raw).choices?.[0]?.delta?.content ?? '';
                    if (token) {
                        if (!fullText) {
                            _clearThinking();
                            const p = document.createElement('p');
                            p.className = `ai-msg ${msgClass}`;
                            output.appendChild(p);
                        }
                        fullText += token; 
                        appendToken(token); 
                    }
                } catch(_) {}
            }
        }

        if (fullText) {
            messageHistory.push({ role: 'assistant', content: fullText.slice(0, 800) });
            if (messageHistory.length > 14) messageHistory.splice(0, messageHistory.length - 14);
            saveHistory();
            _logAIResponse(fullText);
            return true;
        }
        return false;
    } catch (err) {
        console.error("Pacific Link failed:", err);
        return false;
    }
}

// =============================================================
//  SHADOW AGE GATE
// =============================================================
function shadowAgeGate(onConfirm) {
    if (sessionStorage.getItem('shadow_age_ok')) { onConfirm(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'age-gate-overlay';
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:'Fira Code',monospace;";
    overlay.innerHTML = `
        <div style="background:#050510;border:2px solid #ff6600;padding:36px 28px;max-width:360px;text-align:center;box-shadow:0 0 50px rgba(255,102,0,0.25);">
            <div style="color:#ff6600;font-size:1.5rem;font-weight:bold;letter-spacing:4px;margin-bottom:6px;">⚠ SHADOW MODE</div>
            <div style="color:#555;font-size:0.72rem;letter-spacing:2px;margin-bottom:20px;">18+ RESTRICTED</div>
            <div style="color:#aaa;font-size:0.83rem;line-height:1.8;margin-bottom:24px;">
                This mode contains explicit content, unfiltered language, and adult themes.<br>You must be 18 or older to proceed.
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="age-yes" style="background:#ff6600;border:2px solid #ff6600;color:#000;padding:11px 28px;font-family:inherit;font-weight:bold;font-size:0.9rem;cursor:pointer;letter-spacing:2px;">I AM 18+</button>
                <button id="age-no"  style="background:transparent;border:2px solid #444;color:#555;padding:11px 22px;font-family:inherit;font-weight:bold;font-size:0.9rem;cursor:pointer;letter-spacing:1px;">BACK</button>
            </div>
            <div style="color:#2a2a2a;font-size:0.62rem;margin-top:18px;">Access is logged.</div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('age-yes').addEventListener('click', () => {
        overlay.remove();
        sessionStorage.setItem('shadow_age_ok', '1');
        logPrompt('[AGE GATE] Confirmed 18+ — entered SHADOW mode.');
        onConfirm();
    });
    document.getElementById('age-no').addEventListener('click', () => overlay.remove());
}

// =============================================================
//  MODE SYSTEM
// =============================================================
const MODES = {
    nexus: {
        prompt:  'guest@nexus:~$',
        color:   '#4af',
        title:   'NEXUS',
        label:   'NEXUS',
        msg:     '', 
        msgCls:  'sys-msg',
    },
    shadow: {
        prompt:  'shadow@nexus:~$',
        color:   '#ff6600',
        title:   'NEXUS UNFILTERED',
        label:   'SHADOW',
        msg:     '',
        msgCls:  'conn-ok',
    },
    coder: {
        prompt:  'dev@nexus:~$',
        color:   '#0f0',
        title:   'NEXUS CODER',
        label:   'CODER',
        msg:     '',
        msgCls:  'conn-ok',
    },
    sage: {
        prompt:  'sage@nexus:~$',
        color:   '#a06fff',
        title:   'NEXUS SAGE',
        label:   'SAGE',
        msg:     '',
        msgCls:  'conn-ok',
    },
    education: {
        prompt:  'guest@education:~$',
        color:   '#00ffcc',
        title:   'NEXUS EDUCATION',
        label:   'EDUCATION',
        msg:     '',
        msgCls:  'conn-ok',
    },
};

function setMode(modeKey) {
    if (!MODES[modeKey]) return;
    saveHistory();
    
    // Apply mode-specific body class for overload effects
    Object.keys(MODES).forEach(m => document.body.classList.remove(`mode-${m}`));
    document.body.classList.add(`mode-${modeKey}`);
    
    currentMode = modeKey;
    localStorage.setItem('nexus_mode', modeKey);
    messageHistory = loadHistory(modeKey);
    const m = MODES[modeKey];

    const promptEl   = document.getElementById('prompt-label');
    const titleEl    = document.getElementById('status-title');
    const modeIndEl  = document.getElementById('mode-indicator');

    if (promptEl)  { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color || 'inherit'; }

    // IMMEDIATE COLOR UPDATE — No refresh needed
    if (m.color) {
        document.documentElement.style.setProperty('--accent', m.color);
        document.documentElement.style.setProperty('--txt-color', m.color);
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === modeKey);
    });

    SoundManager.playBloop(300, 0.05);
    
    // SILENCED: printToTerminal(m.msg, m.msgCls);
}

// Wire up mode picker buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.mode === 'shadow') {
            shadowAgeGate(() => { setMode('shadow'); input.focus(); });
        } else {
            setMode(btn.dataset.mode);
            input.focus();
        }
    });
});

// Apply saved mode visuals on page load (without printing a mode message)
(function initModeUI() {
    const m = MODES[currentMode];
    if (!m) return;
    const promptEl  = document.getElementById('prompt-label');
    const titleEl   = document.getElementById('status-title');
    const modeIndEl = document.getElementById('mode-indicator');
    if (promptEl)  { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color; }
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });
})();

// =============================================================
//  INPUT HANDLING
// =============================================================
let inputListenersInited = false;
function setupInputListeners() {
    if (!input) input = document.getElementById('terminal-input');
    if (!input || inputListenersInited) return;
    
    console.log("[NEXUS] Input Protocol Initialized.");
    inputListenersInited = true;

    input.oninput = () => { SoundManager.playClick(); };

    input.onkeydown = (e) => {
        // Route keypresses to Wordle when active
        if (wordleActive) {
            if (e.key === 'Enter') { e.preventDefault(); wordleKey('ENTER'); return; }
            if (e.key === 'Backspace') { wordleKey('⌫'); return; }
            if (/^[a-zA-Z]$/.test(e.key)) { wordleKey(e.key.toUpperCase()); e.preventDefault(); return; }
        }

        // Typing test: live feedback, Escape to cancel
        if (typeTestActive) {
            if (e.key === 'Escape') {
                clearInterval(typeTimerInterval);
                typeTestActive = false;
                guiContainer.classList.add('gui-hidden');
                printToTerminal('Typing test cancelled.', 'sys-msg');
                input.value = '';
                return;
            }
            if (e.key !== 'Enter') {
                setTimeout(() => checkTypingTest(input.value), 0);
                return;
            }
        }

        if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < cmdHistory.length - 1) { historyIndex++; input.value = cmdHistory[historyIndex]; }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            historyIndex > 0 ? (historyIndex--, input.value = cmdHistory[historyIndex]) : (historyIndex = -1, input.value = '');
            return;
        }

        let cmd = input.value.trim();
        if (!cmd) return;

        cmdHistory.unshift(cmd);
        if (cmdHistory.length > 50) cmdHistory.pop();
        localStorage.setItem('nexus_cmd_history', JSON.stringify(cmdHistory));
        historyIndex = -1;
        input.value = '';

        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        const pl = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');

        // Typing test intercept
        if (typeTestActive) {
            const done = checkTypingTest(cmd);
            if (done) return;
        }

        handleCommand(cmd);
    };
}

// Redundant global call removed to prevent double-texting
// setupInputListeners();

function handleCommand(cmd) {
    const lc = cmd.toLowerCase();

    // ── 1. Terminal Printing (Singular Entry Point) ─────────────
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const pl = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');
    
    const silentCmds = ['clear', 'history'];
    if (!silentCmds.includes(lc)) {
        printToTerminal(`${pl} ${cmd}`, 'user-cmd');
    }

    if (lc === 'clear') { 
        if (output) output.innerHTML = ''; 
        messageHistory = []; 
        pendingImageB64 = null; 
        localStorage.removeItem(HISTORY_KEYS[currentMode]); 
        return; 
    }
    if (lc === 'history') { showHistory(); return; }

    const isOwner = nexusUser?.name?.toLowerCase().includes('xavier');

    // PACIFIC SHIELD: Access Control
    if (lc.startsWith('config ') || lc.startsWith('model') || lc === 'models') {
        if (!isOwner) {
            printToTerminal("[ERR] Permission Denied: Neural reconfiguration restricted to System Owner.", "sys-msg");
            return;
        }
    }

    if (lc === 'help')                {  showHelp(); return; }
    
    // API Configuration Uplink
    if (lc.startsWith('config ')) {
        
        const parts = cmd.split(' ');
        if (parts.length < 3) {
            printToTerminal('[ERR] Usage: config <service> <key>', 'sys-msg');
            printToTerminal('Example: config gemini AIzaSy...', 'sys-msg');
            return;
        }
        const service = parts[1].toLowerCase();
        const keyVal  = parts[2].trim();
        let targetVar = '';
        
        if (service === 'gemini') targetVar = 'GEMINI_API_KEY';
        else if (service === 'groq') targetVar = 'GROQ_API_KEY';
        else if (service === 'hf')   targetVar = 'HF_API_KEY';
        else if (service === 'xai')  targetVar = 'XAI_API_KEY';
        else {
            printToTerminal(`[ERR] Unknown service: ${service}`, 'sys-msg');
            return;
        }

        printToTerminal(`[SYS] Establishing secure uplink for ${targetVar}...`, 'sys-msg');
        fetch(`${API_BASE}/api/config/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: targetVar, val: keyVal })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) printToTerminal(`[OK] ${data.message}`, 'conn-ok');
            else printToTerminal(`[ERR] ${data.error}`, 'sys-msg');
        })
        .catch(e => printToTerminal(`[ERR] Uplink failed: ${e.message}`, 'sys-msg'));
        return;
    }

    if (lc === 'whoami')              {  runWhoami(); return; }
    if (lc === 'neofetch')            {  runNeofetch(); return; }
    if (lc === 'logs' || lc === 'log') {  showLogs(); return; }
    if (lc === 'leaderboard' || lc === 'rankings') {  showLeaderboard(); return; }
    if (lc === 'login' || lc === 'signin') {
        
        printToTerminal("[AUTH] Triggering Google Identity prompt...", "sys-msg");
        google.accounts.id.prompt();
        return;
    }
    if (lc.startsWith('name ')) {
        const newName = cmd.slice(5).trim().slice(0, 15);
        if (newName) {
            localStorage.setItem('nexus_user_name', newName);
            printToTerminal(`[SYS] Identity updated: ${newName}`, 'conn-ok');
        }
        return;
    }
    if (lc === 'scan image' || lc === 'scan') {
        if (!pendingImageB64) { printToTerminal('[ERR] No image loaded. Use 📎 to attach an image first.', 'sys-msg'); return; }
        
        cmd = 'Describe and analyze this image in detail. What do you see?';
    }
    
    if (lc === 'shadow')  {
        if (currentMode === 'shadow') { setMode('nexus'); return; }
        shadowAgeGate(() => setMode('shadow'));
        return;
    }
    if (lc === 'nexus') { setMode('nexus'); return; }
    if (lc === 'coder') { setMode('coder'); return; }
    if (lc === 'sage')  { setMode('sage');  return; }
    if (lc === 'education')  { setMode('education');  return; }

    if (lc === 'clear history') {
        
        localStorage.removeItem(HISTORY_KEYS[currentMode]);
        messageHistory = [];
        printToTerminal(`[SYS] ${currentMode.toUpperCase()} history wiped.`, 'sys-msg');
        return;
    }
    if (lc === 'clear') {
        output.innerHTML = '';
        messageHistory = [];
        return;
    }

    if (lc === 'play pong')           { startPong(); return; }
    if (lc === 'play snake')          { startSnake(); return; }
    if (lc === 'play wordle')         { startWordle(); return; }
    if (lc === 'play minesweeper')    { startMinesweeper(); return; }
    if (lc === 'play flappy')      { startFlappy(); return; }
    if (lc === 'play breakout')    { startBreakout(); return; }
    if (lc === 'play invaders' || lc === 'play space invaders') { startInvaders(); return; }

    if (lc === 'type test' || lc === 'typetest') { startTypingTest(); return; }
    if (lc === 'matrix')              { startMatrixSaver(); return; }
    if (lc === 'monitor')             { startMonitor(); return; }

    // Text-to-speech — silent: just speak, no terminal output
    if (lc.startsWith('speak ') || lc.startsWith('say ')) {
        const spaceIdx = cmd.indexOf(' ');
        const spokenText = cmd.slice(spaceIdx + 1).trim();
        if ('speechSynthesis' in window && spokenText) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(spokenText);
            utt.rate = 0.92; utt.pitch = 1;
            const savedVoice = localStorage.getItem('nexus_tts_voice');
            const voices = window.speechSynthesis.getVoices();
            if (savedVoice && voices.length) {
                const v = voices.find(vx => vx.name === savedVoice);
                if (v) utt.voice = v;
            } else if (voices.length) {
                utt.voice = _pickBestVoice(voices);
            }
            window.speechSynthesis.speak(utt);
        }
        return;
    }

    // Accessibility panel
    if (lc === 'access' || lc === 'accessibility') {
        
        toggleA11yPanel();
        return;
    }

    if (isCreatorQuestion(cmd)) { 
        
        showCreatorResponse(); 
        return; 
    }
    if (isContactQuestion(cmd))  { 
        
        showContactResponse();  
        return; 
    }

    // Image generation works in ALL modes — intercept before routing to AI
    const genMatch = cmd.match(/^(?:generate|imagine|draw|create image of|make image of|image|vintage)\s+(.+)/i);
    if (genMatch) {
        
        const isVintage = /^vintage\s/i.test(cmd);
        generateImage(isVintage ? cmd.trim() : genMatch[1].trim());
        return;
    }

    const imgSnap = pendingImageB64;

    // img2img: transform attached image with a new prompt
    if (imgSnap && (lc.startsWith('transform ') || lc.startsWith('restyle ') || lc.startsWith('remix '))) {
        
        const transformPrompt = cmd.slice(cmd.indexOf(' ') + 1).trim();
        pendingImageB64 = null;
        generateImageFromImage(imgSnap, transformPrompt);
        return;
    }

    pendingImageB64 = null;
    logPrompt(cmd, imgSnap);

    // AI DISPATCH: Custom Cloudflare Uplink (Master Pacific Link)
    // Satisfying request: "use that specific thing for everything"
    prompt_ai_proxy(cmd, imgSnap, currentMode, '');
}

// =============================================================
//  QUICK ACTION BUTTONS
// =============================================================

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (!cmd) return;
        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        const promptLabel = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');
        
        // PACIFIC UI: Clean single-print execution
        handleCommand(cmd);
        input.focus();
    });
});

// =============================================================
//  UTILITIES
// =============================================================
function printToTerminal(text, className = 'sys-msg') {
    // Fail-safe initialization
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return; // Still not found? Silently fail to prevent crash.

    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function showThinking(cmd) {
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return;

    document.getElementById('ai-thinking')?.remove(); // clear any stale one first
    clearTimeout(_thinkTimeout);
    _thinkFallbackCmd = cmd || null;

    const col = MODE_COLORS[currentMode] || '#4af';
    const label = (currentMode === 'shadow' ? 'SHADOW' : currentMode === 'coder' ? 'CODER' : currentMode === 'sage' ? 'SAGE' : 'NEXUS');
    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.style.margin = '6px 0';
    p.innerHTML = `
        <span class="nexus-thinking-bar" style="color:${col};">
            <span class="nexus-spinner"></span>
            <span class="bar-dot"></span>
            <span class="bar-dot"></span>
            <span class="bar-dot"></span>
            <span style="font-size:0.72rem;letter-spacing:2px;margin-left:4px;opacity:0.8;">${label} thinking</span>
        </span>`;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;

    // After 18s with no WS response, fall back to CF Worker (Groq) with mode system prompt.
    // This makes NEXUS/CODER/SAGE resilient to Render.com cold starts or Gemini hangs.
    _thinkTimeout = setTimeout(() => {
        document.getElementById('ai-thinking')?.remove();
        _thinkTimeout = null;
        const fallback = _thinkFallbackCmd;
        _thinkFallbackCmd = null;
        if (fallback && currentMode !== 'shadow') {
            // WS timed out — retry instantly via CF Worker (no "routing via..." noise)
            askPacific(fallback, null, MODE_SYSTEMS[currentMode] || MODE_SYSTEMS.nexus, 'ai-msg');
        } else if (fallback && currentMode === 'shadow') {
            askPacific(fallback, null);
        }
    }, 18000);
}

// Log AI responses to Discord so full conversations are visible in logs
function _logAIResponse(responseText) {
    if (!responseText || responseText.length < 3) return;
    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    
    const embed = {
        title: `🤖 Nexus Reply to ${user.name}`,
        color: 0xff00ff,
        description: `\`\`\`\n${responseText.slice(0, 1500)}\n\`\`\``,
        timestamp: new Date().toISOString()
    };
    
    postToDiscord({ embeds: [embed] }, discordThreadId || null);
}

function jsonPayload(cmd) {
    const history = (messageHistory || []).slice(-10);
    const payload = { command: cmd, history: history, mode: currentMode, context: XAVIER_BIO };
    if (pendingImageB64) {
        payload.image = pendingImageB64;
        pendingImageB64 = null; // consume — sent once
    }
    return JSON.stringify(payload);
}

let statsWs;
function connectStats() {
    if (statsWs) { statsWs.onclose = null; statsWs.close(); }
    statsWs = new WebSocket(STATS_URL);
    statsWs.onmessage = (e) => {
        try {
            const d = JSON.parse(e.data);
            if (cpuStat) cpuStat.textContent = d.cpu.toFixed(1) + '%';
            if (memStat) memStat.textContent = d.mem.toFixed(1) + '%';
        } catch (_) {}
    };
    statsWs.onclose = () => setTimeout(connectStats, 5000);
}

function updateClientStats() {
    if (statsWs && statsWs.readyState === WebSocket.OPEN) return;
    if (!cpuStat) cpuStat = document.getElementById('cpu-stat');
    if (!memStat) memStat = document.getElementById('mem-stat');
    if (cpuStat) cpuStat.textContent = (navigator.hardwareConcurrency || '--') + ' Cores';
    if (memStat) memStat.textContent  = (navigator.deviceMemory || '--') + ' GB';
}

// =============================================================
//  IMAGE VIEWER + AI SCAN
// =============================================================
let pendingImageB64 = null; // set when an image is loaded, cleared after sending

function openImageViewer(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        pendingImageB64 = ev.target.result;
        const b64 = pendingImageB64;

        // ── Inline terminal thumbnail ──────────────────────────
        const p = document.createElement('p');
        p.className = 'sys-msg';
        p.innerHTML = `📎 <b style="color:#0ff">${file.name}</b> <span style="color:#444">(${(file.size/1024).toFixed(1)} KB)</span><br>
            <img src="${b64}"
                 style="max-height:72px;max-width:180px;border:1px solid #0ff;border-radius:3px;margin-top:5px;display:block;cursor:pointer;"
                 title="Click to expand"
                 onclick="nexusExpandImg('${b64.slice(0,32)}')">
            <span style="font-size:0.7rem;color:#555;">Ask a question or type <b style="color:#0ff;">scan image</b> to analyze</span>`;
        output.appendChild(p);
        output.scrollTop = output.scrollHeight;

        // No GUI popup — stays in chat. Click thumbnail to expand.
        input.focus();
    };
    reader.readAsDataURL(file);
}

// Expand image full-size in GUI when thumbnail clicked
window.nexusExpandImg = function(src) {
    stopAllGames();
    guiTitle.textContent = 'IMAGE VIEWER';
    guiContent.innerHTML = `<div style="text-align:center;"><img src="${src}" style="max-width:100%;border:2px solid #0ff;border-radius:4px;display:block;margin:0 auto;"></div>`;
    nexusCanvas.style.display = 'none';
    guiContainer.classList.remove('gui-hidden');
};

const imgInp = document.getElementById('img-input');
if (imgInp) {
    imgInp.addEventListener('change', (e) => {
        if (e.target.files[0]) openImageViewer(e.target.files[0]);
        e.target.value = '';
    });
}

// =============================================================
//  MOBILE: hide sidebar when keyboard is open
// =============================================================
const quickActions = document.querySelector('.quick-actions');
if (input && quickActions) {
    input.addEventListener('focus', () => {
        if (window.innerWidth <= 700) quickActions.classList.add('kb-hidden');
    });
    input.addEventListener('blur', () => {
        quickActions.classList.remove('kb-hidden');
    });
}

// =============================================================
//  INIT
// =============================================================
// Restore saved mode (UI only — no message, no flash)
if (currentMode !== 'nexus') {
    const m = MODES[currentMode];
    if (m) {
        const promptEl  = document.getElementById('prompt-label');
        const titleEl   = document.getElementById('status-title');
        const modeIndEl = document.getElementById('mode-indicator');
        if (promptEl)  promptEl.textContent  = m.prompt;
        if (titleEl)   titleEl.textContent   = m.title;
        if (modeIndEl) modeIndEl.textContent = m.label;
        if (m.color) {
            document.documentElement.style.setProperty('--accent', m.color);
            document.documentElement.style.setProperty('--txt-color', m.color);
        }
        document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === currentMode);
        });
    }
}
// Restore current mode's history into memory
const _savedHistory = loadHistory(currentMode);
if (_savedHistory.length) {
    messageHistory = _savedHistory;
    setTimeout(() => {
        const col = MODE_COLORS[currentMode] || '#0ff';
        printToTerminal(`[SYS] ${_savedHistory.length} ${currentMode.toUpperCase()} messages from last session — type <b style="color:${col}">history</b> to view all modes.`, 'sys-msg');
    }, 2000);
}

connectWS();
connectStats();
updateClientStats();
setInterval(updateClientStats, 5000);

// =============================================================
//  ACCESSIBILITY
// =============================================================

const A11Y_CLASSES = ['a11y-large', 'a11y-xl', 'a11y-high-contrast', 'a11y-reduce-motion', 'a11y-dyslexic', 'a11y-wide-spacing', 'a11y-bold', 'a11y-dim', 'crt-mode'];

function _a11ySave() {
    const active = A11Y_CLASSES.filter(c => document.body.classList.contains(c));
    localStorage.setItem('nexus_a11y', JSON.stringify(active));
    localStorage.setItem('nexus_sound', SoundManager.enabled ? '1' : '0');
}

function toggleSound() {
    SoundManager.enabled = !SoundManager.enabled;
    if (SoundManager.enabled) SoundManager.playBloop(600, 0.05);
    _a11ySave();
    _a11ySyncButtons();
}

function clearAllHistory() {
    if (!confirm("Wipe ALL conversation memory across ALL modes?")) return;
    Object.values(HISTORY_KEYS).forEach(key => localStorage.removeItem(key));
    messageHistory = [];
    printToTerminal("[SYSTEM] Global memory wiped. All modes reset.", "sys-msg");
    const p = document.getElementById('a11y-panel');
    if (p) p.classList.remove('a11y-panel-open');
}

function _a11ySyncButtons() {
    document.querySelectorAll('.a11y-toggle').forEach(btn => {
        const cls = btn.dataset.class;
        if (cls) btn.classList.toggle('on', document.body.classList.contains(cls));
        if (btn.id === 'sound-toggle') btn.classList.toggle('on', SoundManager.enabled);
    });
}

function toggleA11yClass(cls) {
    document.body.classList.toggle(cls);
    if (cls === 'a11y-large' && document.body.classList.contains(cls))  document.body.classList.remove('a11y-xl');
    if (cls === 'a11y-xl'    && document.body.classList.contains(cls))  document.body.classList.remove('a11y-large');
    _a11ySave();
    _a11ySyncButtons();
}

function toggleSound() {
    SoundManager.enabled = !SoundManager.enabled;
    if (SoundManager.enabled) SoundManager.playBloop(600, 0.05);
    _a11ySave();
    _a11ySyncButtons();
}

// ── Voice selection helpers ──────────────────────────────────────────────────
// Preferred voice names in priority order (Google > Microsoft > macOS > default)
const _VOICE_PREF = [
    'Google US English', 'Google UK English Female', 'Google UK English Male',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Microsoft Zira - English (United States)',
    'Microsoft David - English (United States)',
    'Samantha', 'Alex', 'Karen', 'Daniel',
];

function _pickBestVoice(voices) {
    // Try ranked preferences first
    for (const name of _VOICE_PREF) {
        const v = voices.find(v => v.name === name);
        if (v) return v;
    }
    // Fall back to any en-US voice, then any English voice
    return voices.find(v => v.lang === 'en-US')
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
}

function _buildVoiceOptions(sel) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
        sel.innerHTML = '<option value="">No voices available</option>';
        return;
    }
    const saved = localStorage.getItem('nexus_tts_voice');
    const list  = voices.filter(v => v.lang.startsWith('en'));
    sel.innerHTML = '<option value="">— Auto (best available) —</option>';
    (list.length ? list : voices).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        sel.appendChild(opt);
    });
    // Set selection using sel.value — simpler and always works
    if (saved) {
        sel.value = saved;
        if (!sel.value) { sel.value = ''; localStorage.removeItem('nexus_tts_voice'); }
    } else {
        const best = _pickBestVoice(list.length ? list : voices);
        if (best) sel.value = best.name;
    }
}

function clearAllHistory() {
    if (!confirm("Wipe ALL conversation memory across ALL modes?")) return;
    Object.values(HISTORY_KEYS).forEach(key => localStorage.removeItem(key));
    messageHistory = [];
    printToTerminal("[SYSTEM] Global memory wiped. All modes reset.", "sys-msg");
    const p = document.getElementById('a11y-panel');
    if (p) p.classList.remove('a11y-panel-open');
}

function toggleA11yPanel() {
    const panel = document.getElementById('a11y-panel');
    if (panel) {
        panel.classList.toggle('a11y-panel-open');
        // Re-populate voices each open (Chrome loads them async after first gesture)
        if (panel.classList.contains('a11y-panel-open')) {
            const sel = panel.querySelector('#a11y-voice-sel');
            if (sel) _buildVoiceOptions(sel);
        }
        return;
    }

    const el = document.createElement('div');
    el.id = 'a11y-panel';
    el.className = 'a11y-panel a11y-panel-open';
    el.innerHTML = `
        <div class="a11y-panel-header">
            <span>[ ACCESSIBILITY ]</span>
            <button onclick="document.getElementById('a11y-panel').classList.remove('a11y-panel-open')" class="a11y-close">✕</button>
        </div>

        <div class="a11y-section-label">VISUALS</div>

        <div class="a11y-row">
            <button class="a11y-toggle" data-class="crt-mode" onclick="toggleA11yClass('crt-mode')">CRT Mode</button>
            <button class="a11y-toggle" id="sound-toggle" onclick="toggleSound()">Sound Effects</button>
        </div>

        <div class="a11y-section-label">TEXT SIZE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-large" onclick="toggleA11yClass('a11y-large')">Large</button>
            <button class="a11y-toggle" data-class="a11y-xl"    onclick="toggleA11yClass('a11y-xl')">Extra Large</button>
        </div>

        <div class="a11y-section-label">TEXT STYLE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-bold"         onclick="toggleA11yClass('a11y-bold')">Bold</button>
            <button class="a11y-toggle" data-class="a11y-wide-spacing" onclick="toggleA11yClass('a11y-wide-spacing')">Wide Spacing</button>
        </div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-dyslexic" onclick="toggleA11yClass('a11y-dyslexic')">Dyslexia Font</button>
        </div>

        <div class="a11y-section-label">DISPLAY</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-high-contrast" onclick="toggleA11yClass('a11y-high-contrast')">High Contrast</button>
            <button class="a11y-toggle" data-class="a11y-dim"           onclick="toggleA11yClass('a11y-dim')">Dim Mode</button>
        </div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-reduce-motion" onclick="toggleA11yClass('a11y-reduce-motion')">Less Motion</button>
        </div>

        <div class="a11y-section-label">VOICE (speak command)</div>
        <select id="a11y-voice-sel" class="a11y-voice-sel">
            <option value="">Loading voices…</option>
        </select>

        <div class="a11y-tip">All settings saved automatically.</div>
    `;
    document.querySelector('.glass-panel').appendChild(el);
    _a11ySyncButtons();

    // Populate voice picker — voices load async in Chrome
    const sel = el.querySelector('#a11y-voice-sel');
    const doPopulate = () => _buildVoiceOptions(sel);
    if (window.speechSynthesis.getVoices().length) {
        doPopulate();
    } else {
        window.speechSynthesis.addEventListener('voiceschanged', doPopulate, { once: true });
    }

    sel.addEventListener('change', () => {
        if (sel.value) localStorage.setItem('nexus_tts_voice', sel.value);
        else           localStorage.removeItem('nexus_tts_voice');
    });
}

// =============================================================
//  RESTORE & BOOT
// =============================================================

// Global Boot
window.onload = async () => {
    try {
        // Initialize DOM references
        cpuStat      = document.getElementById('cpu-stat');
        memStat      = document.getElementById('mem-stat');
        output       = document.getElementById('terminal-output');
        input        = document.getElementById('terminal-input');
        guiContainer = document.getElementById('game-gui-container');
        guiContent   = document.getElementById('gui-content');
        guiTitle     = document.getElementById('gui-title');
        nexusCanvas  = document.getElementById('nexus-canvas');

        // PRE-BOOT HEALTH CHECK (Vital for Render free tier sleep)
        let isBackendOnline = false;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // Wait 8s for Render wake
            const pingRes = await fetch(`${API_BASE}/ping`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (pingRes.ok) isBackendOnline = true;
        } catch (e) {
            console.warn("[BOOT] Health check failed. Backend may be offline.");
        }

        if (!isBackendOnline) {
            const maint = document.createElement('div');
            maint.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,15,0.98);color:#f55;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Fira Code',monospace;text-align:center;padding:20px;";
            maint.innerHTML = `
                <div style="width:12px;height:12px;background:#f55;border-radius:50%;margin-bottom:15px;box-shadow:0 0 10px #f55;animation:pulse 2s infinite;"></div>
                <h1 style="color:#fff;font-size:1.5rem;letter-spacing:2px;margin:0 0 10px 0;">SYSTEM OFFLINE</h1>
                <p style="color:#aaa;max-width:400px;line-height:1.6;font-size:0.85rem;">
                    "This is my creation."<br>
                    The Nexus Core is currently undergoing maintenance or entering a sleep cycle. Neural uplinks are severed.
                </p>
                <button onclick="location.reload()" style="margin-top:20px;background:none;border:1px solid #555;color:#888;padding:8px 16px;cursor:pointer;font-family:monospace;transition:0.2s;">[ INITIATE PING REFRESH ]</button>
            `;
            document.body.appendChild(maint);
            return; // Halt boot sequence entirely
        }

        // Check for existing session on server (handles redirect return)
        let authedName = null;
        try {
            const meRes = await fetch(`${API_BASE}/api/me`);
            const meData = await meRes.json();
            if (meData.ok) {
                localStorage.setItem('nexus_user_data', JSON.stringify(meData));
                authedName = meData.name;
            }
        } catch(e) {}

        // Fallback to local storage if server check failed
        if (!authedName) {
            const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
            if (nexusUser && nexusUser.name) authedName = nexusUser.name;
        }

        // Load history for the current mode on boot
        messageHistory = loadHistory(currentMode);

        // Start auth in background (non-blocking)
        initGoogleAuth();

        if (authedName) {
            revealTerminal(authedName);
        } else {
            console.log("[NEXUS] Awaiting Authorization...");
        }
        console.log(`[NEXUS] Boot sequence complete in ${Date.now() - window.NEXUS_BOOT_START}ms`);
    } catch (e) {
        console.error("[CRITICAL] Boot sequence failed:", e);
        // Ensure diagnostic reporter catches this if it's a hard crash
        throw e; 
    }
};
