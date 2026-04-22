
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
        <h1 style="color:#fff;margin-top:0;"> NEXUS SYSTEM CRITICAL FAILURE</h1>
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
                //  1. Dispatch to Backend Hub 
                const res = await fetch(`${API_BASE}/api/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ report: reportData })
                });

                //  2. Dispatch to Discord (Immediate Alert) 
                await postToDiscord({
                    embeds: [{
                        title: ' NEXUS CRITICAL FAILURE',
                        color: 0xff0000,
                        description: `\`\`\`\n${reportData.slice(0, 1900)}\n\`\`\``,
                        timestamp: new Date().toISOString()
                    }]
                }, discordThreadId || null);

                if (res.ok) {
                    status.textContent = ' Report transmitted to Nexus Command and Discord Uplink.';
                    status.style.color = '#0f0';
                    btn.textContent = 'REPORT SENT';
                } else {
                    throw new Error("Backend response failed");
                }
            } catch(e) {
                console.error("[REPORT ERROR]", e);
                status.textContent = ' Partial transmission failure. Verify neural links.';
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
