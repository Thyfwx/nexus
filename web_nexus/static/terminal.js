/**
 * 🛰️ NEXUS TERMINAL CORE v5.0.0
 * The lightweight shell for the Pacific Nexus ecosystem.
 */

window.NEXUS_BOOT_START = window.NEXUS_BOOT_START || Date.now();

// --- Global Error Reporter ---
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
    `;
    document.body.appendChild(diagnostic);
    return false;
};

// --- Initialization ---
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.monitor') && !['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'].includes(e.target.tagName)) {
        setTimeout(() => { if (!window.getSelection().toString()) input.focus(); }, 0);
    }
});

// --- Terminal I/O ---
function printTypewriter(text, className, speed = 1) {
    const p = document.createElement('p');
    p.className = className;
    output.appendChild(p);
    let i = 0;
    function type() {
        if (i < text.length) {
            p.innerHTML += text[i] === '\n' ? '<br>' : text[i];
            i++;
            output.scrollTop = output.scrollHeight;
            setTimeout(type, speed);
        }
    }
    type();
}

// --- WebSocket Uplink ---
function connectWS() {
    if (termWs && (termWs.readyState === WebSocket.OPEN || termWs.readyState === WebSocket.CONNECTING)) return;
    
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${proto}//${window.RENDER_HOST}/ws/terminal`;
    
    window.termWs = new WebSocket(WS_URL);
    window.termWs.onopen = () => {
        const dot = document.getElementById('conn-dot');
        if (dot) dot.className = 'conn-dot connected';
        console.log("[WS] Neural Link Synchronized.");
    };
    window.termWs.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.text) {
            _clearThinking();
            printToTerminal(data.text, 'ai-msg');
        }
    };
}

function _clearThinking() {
    document.getElementById('ai-thinking')?.remove();
}

// --- Boot Sequence Runner ---
async function runBoot() {
    for (const step of window.BOOT_WORDS) {
        printToTerminal(`[${step.label}] ${step.text}`, 'sys-msg');
        await new Promise(r => setTimeout(r, 200));
    }
    connectWS();
}

// --- Lifecycle ---
window.addEventListener('load', () => {
    window.output = document.getElementById('terminal-output');
    window.input = document.getElementById('terminal-input');
    window.guiContainer = document.getElementById('game-gui-container');
    window.guiContent = document.getElementById('gui-content');
    window.guiTitle = document.getElementById('gui-title');
    window.nexusCanvas = document.getElementById('nexus-canvas');
    
    setupInputListeners();
    runBoot();
});
