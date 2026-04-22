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
    
    //  1. RENDER BACKEND REST (Primary Chat Path) 
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

    //  2. WEBSOCKET FALLBACK 
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
};

function updateTabIdentity() {
    const theme = MODE_THEMES[currentMode] || MODE_THEMES.nexus;
    document.title = theme.title;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
