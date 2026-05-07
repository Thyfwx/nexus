// 🛰️ NEXUS GLOBAL COMMAND CENTER v5.5.0 — SFW Release
window.NEXUS_VERSION = 'v5.5.0';

// Core Environment
window.isLocal = (function() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
})();
window.RENDER_HOST = 'nexus-terminalnexus.onrender.com';
window.PACIFIC_HUB = 'https://nexus-evil-proxy.xavierscott300.workers.dev';
window.isRender = window.location.hostname.includes('onrender.com');
window.proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
window.BACKEND_URL = (window.isLocal || window.isRender) ? window.location.host : window.RENDER_HOST;
window.API_BASE = (window.isLocal || window.isRender) ? '' : `https://${window.RENDER_HOST}`;
window.WS_URL = `${window.proto}//${window.BACKEND_URL}/ws/terminal`;
window.STATS_URL = `${window.proto}//${window.BACKEND_URL}/ws/stats`;

// Shared UI Elements
window.cpuStat = null;
window.memStat = null;
window.output = null;
window.input = null;
window.guiContainer = null;
window.guiContent = null;
window.guiTitle = null;
window.nexusCanvas = null;

// System State
window.backendReady = false;
window.OWNER_MODE = false;
window.termWs = null;
window.messageHistory = [];
window.nexusErrors = [];
window.unfilteredRage = 0; // Rage meter for reactivity
window.isLockedOut = false; // Lockout state
window.cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
window.historyIndex = -1;
window.currentMode = localStorage.getItem('nexus_mode') || 'nexus';

// Mode Colors
window.MODE_COLORS = {
    nexus: '#4af',
    unfiltered: '#ff6600',
    coder: '#0f0',
    education: '#ff00ff',         // Magenta — matches .education-msg styling in style.css
    education_coder: '#cc66ff'
};

// --- Thinking Animation — animated dots, mode-colored, mode-named ---
const _THINKING_LINES = {
    nexus:      ['weighing options', 'pulling references', 'composing reply', 'cross-checking facts'],
    coder:      ['parsing intent', 'sketching solution', 'compiling logic', 'reviewing edge cases'],
    education:  ['unpacking the concept', 'building the analogy', 'finding the cleanest path'],
    unfiltered: ['cracking knuckles', 'loading attitude', 'no filters online']
};

window.showThinking = function() {
    if (!window.output) return;
    document.getElementById('ai-thinking')?.remove();
    const mode = window.currentMode || 'nexus';
    const col = window.MODE_COLORS[mode] || '#4af';
    const label = (mode === 'unfiltered') ? 'UNFILTERED' : mode.toUpperCase();
    const phrases = _THINKING_LINES[mode] || _THINKING_LINES.nexus;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.className = `ai-msg ${mode}-msg`;
    p.style.cssText = "text-align:left; opacity:0.7; font-style:italic; margin:6px 0;";
    // Pre-rendered 3 dots with stable width (no text mutation = no reflow shift).
    // We animate visibility via opacity so the layout never moves.
    p.innerHTML = `<span class="nexus-thinking-bar" style="color:${col}; font-weight:600;"><span style="opacity:0.7;">[${label}]</span> ${phrase}<span class="thinking-dots" style="display:inline-block; min-width:24px; font-family:monospace;"><span class="d1">.</span><span class="d2">.</span><span class="d3">.</span></span></span>`;
    window.output.appendChild(p);
    // Only scroll if the user was already pinned to the bottom — otherwise leave their scroll alone
    const wasAtBottom = (window.output.scrollHeight - window.output.scrollTop - window.output.clientHeight) < 60;
    if (wasAtBottom) window.output.scrollTop = window.output.scrollHeight;

    const d1 = p.querySelector('.d1');
    const d2 = p.querySelector('.d2');
    const d3 = p.querySelector('.d3');
    let frame = 0;
    p._dotsTimer = setInterval(() => {
        // Cycle through 0-1-2-3 visible dots — opacity only, no DOM-text changes
        frame = (frame + 1) % 4;
        if (d1) d1.style.opacity = frame >= 1 ? '1' : '0.15';
        if (d2) d2.style.opacity = frame >= 2 ? '1' : '0.15';
        if (d3) d3.style.opacity = frame >= 3 ? '1' : '0.15';
    }, 320);
};

window._clearThinking = function() {
    const el = document.getElementById('ai-thinking');
    if (!el) return;
    if (el._dotsTimer) clearInterval(el._dotsTimer);
    el.remove();
};

// Per-mode message history — each mode keeps its OWN convo, switching wipes the active one.
window._modeHistories = window._modeHistories || {};
window.getModeHistory = function(mode) { return window._modeHistories[mode] || []; };
