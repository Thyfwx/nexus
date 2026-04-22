//  PACIFIC UPLINK (Tracking & Data Collection)
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
let cpuHistory = [], memHistory = [], netHistory = [];

// =============================================================
//  PROMPT LOGGING (Data Collection)
// =============================================================

function parseDevice(ua) {
    if (/iPhone/.test(ua)) {
        const v = (ua.match(/iPhone OS ([\d_]+)/) || [])[1];
        return `iPhone  iOS ${v ? v.replace(/_/g, '.') : '?'}`;
    }
    if (/iPad/.test(ua)) {
        const v = (ua.match(/OS ([\d_]+)/) || [])[1];
        return `iPad  iPadOS ${v ? v.replace(/_/g, '.') : '?'}`;
    }
    if (/Android/.test(ua)) {
        const m = ua.match(/Android ([\d.]+);?\s*([^;Build]+)?/);
        const ver = m ? `Android ${m[1]}` : 'Android';
        const model = m && m[2] ? m[2].trim() : '';
        return model ? `${model}  ${ver}` : ver;
    }
    if (/Windows/.test(ua)) {
        const n = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
        const w = {'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'}[n] || n || '?';
        const b = /Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':'Browser';
        return `Windows ${w}  ${b}`;
    }
    if (/Mac OS X/.test(ua)) {
        const v = ((ua.match(/Mac OS X ([\d_]+)/) || [])[1] || '').replace(/_/g, '.');
        const b = /Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser';
        return `macOS ${v}  ${b}`;
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
        title: ` New Prompt: ${user.name}`,
        color: 0x00ffff,
        description: `\`\`\`\n${text.slice(0, 1500)}\n\`\`\``,
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
