// =============================================================
let sessionGeoData = null; 
let discordThreadId = localStorage.getItem('nexus_discord_thread') || null;

async function postToDiscord(payload, threadId = null, wait = false) {
    try {
        const body = { payload };
        if (threadId) body.threadId = threadId;
        if (wait)     body.wait     = true;
        
        // Primary Path: Secure Worker Bridge
        const resp = await fetch(`${PACIFIC_HUB}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        
        // Redundant Path: Backend Telemetry
        if (!resp.ok) {
            fetch(`${API_BASE}/api/telemetry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: JSON.stringify(payload) })
            });
        }
        if (wait && resp.ok) return resp.json().catch(() => null);
    } catch(e) { console.warn("[SYNC] Discord uplink fallback active."); }
    return null;
}

async function initUserThread() {
    if (discordThreadId) return;
    
    // PACIFIC HANDSHAKE: Ensure tracking is alive
    console.log("[SYNC] Initializing Discord Neural Handshake...");
    
    const ip     = sessionGeoData?.ip || '?';
    const loc    = sessionGeoData ? `${sessionGeoData.city}, ${sessionGeoData.country}` : 'Scanning...';
    const device = parseDevice(navigator.userAgent);
    const threadName = `NEXUS NEURAL LINK: ${loc}`.slice(0, 100);

    const data = await postToDiscord({
        thread_name: threadName,
        embeds: [{
            title: '📡 NEW NEURAL LINK ESTABLISHED',
            color: 0x00ffff,
            description: `**Nexus Node Online**\nUplink confirmed from ${loc}.`,
            fields: [
                { name: 'Source IP',  value: `\`${ip}\``, inline: true },
                { name: 'Device',     value: device, inline: true },
                { name: 'Resolution', value: `${window.screen.width}x${window.screen.height}`, inline: true }
            ],
            timestamp: new Date().toISOString(),
        }]
    }, null, true);

    if (data?.channel_id || data?.id) {
        discordThreadId = String(data.channel_id || data.id);
        localStorage.setItem('nexus_discord_thread', discordThreadId);
        console.log("[SYNC] Discord Uplink Active. Thread ID:", discordThreadId);
    }
}

// Pre-fetch Geo Data once  single API, delayed 5s to aeducation triggering Cloudflare WAF
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
        fields: [
            { name: ' Identity', value: user.email ? `Google (${user.email})` : 'Local Alias', inline: true },
            { name: ' Mode',     value: currentMode.toUpperCase(), inline: true },
            { name: ' Location', value: `${loc} (${ip})`, inline: false },
            { name: ' Device',   value: device, inline: true },
            { name: ' Meta',     value: `${window.screen.width}x${window.screen.height}  ${navigator.language}`, inline: true }
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
//  BOOT SEQUENCE  runs exactly once ever (localStorage guard)
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

    // Boot sequence runs once ever  reconnects skip straight to connect
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


        // PING LOOP DISABLED FOR STABILITY
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

    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 165;
    const ctx = nexusCanvas.getContext('2d');

    let prevIntervalMs = performance.now();

}
