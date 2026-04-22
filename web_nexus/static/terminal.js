/**
 * 🛰️ NEXUS TERMINAL CORE v5.1.4
 * Reconstructed Shell — Orchestrating v5.0 Modules.
 */

window.NEXUS_BOOT_START = window.NEXUS_BOOT_START || Date.now();

// --- Global Diagnostic Reporter ---
window.onerror = function(msg, url, line, col, error) {
    console.error("[NEXUS CRASH]", msg, "at", url, ":", line);
    const diagnostic = document.createElement('div');
    diagnostic.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,0,0,0.95);color:#f55;padding:40px;z-index:99999;font-family:monospace;overflow:auto;line-height:1.5;border:4px solid #f00;";
    const stack = error?.stack || 'No stack trace available.';
    diagnostic.innerHTML = `
        <h1 style="color:#fff;margin-top:0;"> NEXUS SYSTEM CRITICAL FAILURE</h1>
        <div style="background:#000;padding:20px;border:1px solid #500;margin-bottom:20px;">
            <b style="color:#fff;">ERROR:</b> ${msg}<br>
            <b style="color:#fff;">LOCATION:</b> ${url}<br>
            <b style="color:#fff;">LINE:</b> ${line} <b style="color:#fff;">COL:</b> ${col}
        </div>
        <pre style="background:#111;padding:15px;color:#888;white-space:pre-wrap;max-height:300px;overflow:auto;">${stack}</pre>
        <button onclick="location.reload()" style="background:#f00;color:#fff;border:none;padding:10px 20px;cursor:pointer;font-weight:bold;">FORCE REBOOT</button>
        <button onclick="sendDiagnosticReport('${msg}', '${stack}')" style="background:#555;color:#fff;border:none;padding:10px 20px;cursor:pointer;font-weight:bold;margin-left:10px;">SEND REPORT</button>
    `;
    document.body.appendChild(diagnostic);
    return false;
};

async function sendDiagnosticReport(msg, stack) {
    printToTerminal(`[SYSTEM] Transmitting diagnostic report...`, 'sys-msg');
    await postToDiscord({
        embeds: [{
            title: '⚠️ SYSTEM CRITICAL FAILURE',
            color: 0xff0000,
            fields: [
                { name: 'Error', value: msg },
                { name: 'Stack', value: `\`\`\`\n${stack.slice(0, 1000)}\n\`\`\`` }
            ],
            timestamp: new Date().toISOString()
        }]
    });
    alert("Diagnostic report sent to Xavier Scott.");
}

// --- Initialization ---
window.addEventListener('load', async () => {
    console.log("[NEXUS] Core Shell Initialized.");
    
    // Core Elements
    window.output = document.getElementById('terminal-output');
    window.input = document.getElementById('terminal-input');
    window.guiContainer = document.getElementById('game-gui-container');
    window.guiContent = document.getElementById('gui-content');
    window.guiTitle = document.getElementById('gui-title');
    window.nexusCanvas = document.getElementById('nexus-canvas');

    // Restore History
    window.messageHistory = loadHistory(window.currentMode);

    // Identity Handshake
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    if (nexusUser && nexusUser.name) {
        revealTerminal(nexusUser.name);
    } else {
        initGoogleAuth();
    }
});

function printTypewriter(text, className = 'ai-msg') {
    const p = document.createElement('p');
    p.className = className;
    window.output.appendChild(p);
    const lines = text.split('\n');
    let lineIdx = 0, charIdx = 0;
    function tick() {
        if (lineIdx >= lines.length) return;
        p.innerHTML += lines[lineIdx][charIdx] === '\n' ? '<br>' : lines[lineIdx][charIdx];
        charIdx++;
        if (charIdx >= lines[lineIdx].length) { lineIdx++; charIdx = 0; p.innerHTML += '<br>'; }
        window.output.scrollTop = window.output.scrollHeight;
        setTimeout(tick, 1);
    }
    tick();
}

function _clearThinking() {
    document.getElementById('ai-thinking')?.remove();
}

// Keepalive & Stat Loop
setInterval(() => {
    if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
        window.termWs.send(JSON.stringify({ command: '__ping__', history: [] }));
    }
}, 30000);
