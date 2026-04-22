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

// --- Keyboard Hooks ---
let _keyBuf = "";
let _isPinEntry = false;
let _pinCallback = null;
let _pinBuffer = "";

document.addEventListener('keydown', (e) => {
    if (_isPinEntry) {
        e.preventDefault();
        if (e.key === 'Enter') {
            const cb = _pinCallback;
            const val = _pinBuffer;
            _isPinEntry = false; _pinBuffer = ""; _pinCallback = null;
            if (cb) cb(val);
        } else if (e.key === 'Backspace') {
            _pinBuffer = _pinBuffer.slice(0, -1);
            updatePinDisplay();
        } else if (e.key.length === 1 && /[0-9]/.test(e.key)) {
            if (_pinBuffer.length < 4) _pinBuffer += e.key;
            updatePinDisplay();
        }
        return;
    }
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.length === 1) {
        _keyBuf = (_keyBuf + e.key.toLowerCase()).slice(-4);
        if (_keyBuf === "hack") {
            window.handleCommand("sudo hack");
            _keyBuf = "";
        }
    }
});

function updatePinDisplay() {
    const el = document.getElementById('pin-display');
    if (el) el.textContent = '*'.repeat(_pinBuffer.length);
}

window.askForPin = (callback) => {
    _isPinEntry = true;
    _pinCallback = callback;
    _pinBuffer = "";
    const overlay = document.createElement('div');
    overlay.id = 'pin-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box" style="max-width:300px; text-align:center; padding:30px;">
            <div style="color:var(--accent); font-size:0.7rem; letter-spacing:3px; margin-bottom:15px;">SECURE ACCESS REQUIRED</div>
            <div id="pin-display" style="font-size:2rem; letter-spacing:10px; color:#fff; min-height:40px;"></div>
            <div style="color:#444; font-size:0.6rem; margin-top:15px;">ENTER 4-DIGIT SYSTEM PIN</div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Auto-remove on completion
    const originalCb = _pinCallback;
    _pinCallback = (val) => {
        overlay.remove();
        if (originalCb) originalCb(val);
    };
};

async function sendDiagnosticReport(msg, stack) {
    printToTerminal(`[SYSTEM] Encrypting diagnostic payload...`, 'sys-msg');
    const rawData = JSON.stringify({ error: msg, stack: stack, userAgent: navigator.userAgent });
    const encrypted = _px_encrypt(rawData);
    
    await _px_transmit({
        type: 'DIAGNOSTIC_ENCRYPTED',
        payload: encrypted,
        timestamp: new Date().toISOString()
    });
    
    alert("Encrypted diagnostic report sent to Xavier Scott.");
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

    // Top Tap Trigger (Standardized with Main Site)
    const header = document.querySelector('.status-bar');
    if (header) {
        let taps = 0;
        header.onclick = () => {
            taps++;
            if (taps >= 5) {
                document.getElementById('hack-menu').style.display = 'flex';
                taps = 0;
            }
            setTimeout(() => taps = 0, 2000); // Reset after 2s
        };
    }
});

function printTypewriter(text, className = 'ai-msg') {
    const p = document.createElement('p');
    p.className = className;
    window.output.appendChild(p);
    
    // De-slop: Remove common AI system tags if they leak through
    const cleanText = text.replace(/\[TRIGGER:.*?\]/g, '').trim();
    const lines = cleanText.split('\n');
    let lineIdx = 0, charIdx = 0;
    
    function tick() {
        if (lineIdx >= lines.length) return;
        const line = lines[lineIdx];
        if (charIdx < line.length) {
            p.innerHTML += line[charIdx];
            charIdx++;
            setTimeout(tick, 2); // Fast but smooth
        } else {
            p.innerHTML += '<br>';
            lineIdx++;
            charIdx = 0;
            setTimeout(tick, 50); // Pause on line break
        }
        window.output.scrollTop = window.output.scrollHeight;
    }
    tick();
}

function _clearThinking() {
    document.getElementById('ai-thinking')?.remove();
}

// Keepalive & Stat Loop
let _lastActivity = Date.now();
document.addEventListener('keydown', () => _lastActivity = Date.now());
document.addEventListener('mousedown', () => _lastActivity = Date.now());

setInterval(() => {
    // 1. Keepalive
    if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
        window.termWs.send(JSON.stringify({ command: '__ping__', history: [] }));
    }

// 2. Auto-Wipe (5 Minute Inactivity)
const inactiveMs = Date.now() - _lastActivity;
if (inactiveMs > 300000) { // 5 minutes
    console.log("[SYSTEM] Inactivity detected. Executing Auto-Wipe.");
    window.logout(true);
} else if (inactiveMs > 270000 && !window._hasWipeWarned) { // 4.5 minutes        window._hasWipeWarned = true;
        printToTerminal("[SYSTEM] WARNING: Inactivity detected. Neural link Auto-Wipe in 30s.", "sys-msg");
    } else if (inactiveMs < 270000) {
        window._hasWipeWarned = false;
    }
}, 30000);
