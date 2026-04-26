/**
 * 🛰️ NEXUS TERMINAL CORE v5.3.0 [PROTECTED]
 * High-Fidelity Reconstruction Core — Making the machine ALIVE.
 */

// --- Global Diagnostic Reporter ---
window.onerror = function(msg, url, line, col, error) {
    console.error("[NEXUS CRASH]", msg, "at", url, ":", line);

    const stack    = error?.stack || 'No stack trace available.';
    const user     = (() => { try { return JSON.parse(localStorage.getItem('nexus_user_data') || '{}').name || 'Guest'; } catch(_) { return 'Unknown'; } })();
    const ts       = new Date().toISOString();
    const mode     = window.currentMode || 'unknown';
    const ver      = window.NEXUS_VERSION || '?';
    const ua       = navigator.userAgent;
    const pageUrl  = location.href;

    const reportText = [
        `=== NEXUS CRASH REPORT ===`,
        `Time:    ${ts}`,
        `Version: ${ver}`,
        `User:    ${user}`,
        `Mode:    ${mode}`,
        `URL:     ${pageUrl}`,
        ``,
        `ERROR:   ${msg}`,
        `File:    ${url}`,
        `Line:    ${line}  Col: ${col}`,
        ``,
        `STACK TRACE:`,
        stack,
        ``,
        `USER AGENT: ${ua}`,
    ].join('\n');

    const diagnostic = document.createElement('div');
    diagnostic.id = 'nexus-crash-overlay';
    diagnostic.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,0,0,0.97);backdrop-filter:blur(20px);color:#f55;padding:40px;z-index:99999;font-family:'Fira Code',monospace;overflow:auto;line-height:1.6;box-sizing:border-box;";

    // Safely set text content via DOM (avoids XSS from error strings)
    diagnostic.innerHTML = `
        <div style="max-width:860px;margin:0 auto;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;border-bottom:1px solid #500;padding-bottom:18px;">
                <div style="width:14px;height:14px;border-radius:50%;background:#f00;box-shadow:0 0 12px #f00;flex-shrink:0;"></div>
                <h1 style="color:#fff;margin:0;letter-spacing:4px;font-size:1.1rem;">[ SYSTEM CRITICAL FAILURE ]</h1>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
                <div style="background:rgba(255,0,0,0.07);padding:14px;border:1px solid #400;border-radius:8px;">
                    <div style="font-size:0.55rem;color:#f55;letter-spacing:2px;margin-bottom:8px;">ERROR DETAIL</div>
                    <div id="err-msg" style="color:#fff;font-size:0.75rem;word-break:break-all;"></div>
                    <div style="margin-top:8px;font-size:0.6rem;color:#666;">
                        <span id="err-file"></span><br>
                        LINE <span id="err-line"></span> · COL <span id="err-col"></span>
                    </div>
                </div>
                <div style="background:rgba(0,0,0,0.3);padding:14px;border:1px solid #222;border-radius:8px;">
                    <div style="font-size:0.55rem;color:#f55;letter-spacing:2px;margin-bottom:8px;">SESSION INFO</div>
                    <div style="font-size:0.65rem;color:#aaa;line-height:1.9;">
                        <span style="color:#555;">USER</span> &nbsp;<span id="err-user" style="color:#fff;"></span><br>
                        <span style="color:#555;">MODE</span> &nbsp;<span style="color:#fff;">${mode.toUpperCase()}</span><br>
                        <span style="color:#555;">VER </span> &nbsp;<span style="color:#fff;">${ver}</span><br>
                        <span style="color:#555;">TIME</span> &nbsp;<span style="color:#fff;">${ts}</span>
                    </div>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <div style="font-size:0.55rem;color:#f55;letter-spacing:2px;margin-bottom:8px;">STACK TRACE</div>
                <pre id="err-stack" style="background:rgba(0,0,0,0.6);padding:16px;color:#777;white-space:pre-wrap;max-height:220px;overflow:auto;border-radius:8px;border:1px solid #222;font-size:0.65rem;margin:0;"></pre>
            </div>

            <div style="margin-bottom:20px;">
                <div style="font-size:0.55rem;color:#555;letter-spacing:2px;margin-bottom:6px;">BROWSER</div>
                <div id="err-ua" style="font-size:0.55rem;color:#444;word-break:break-all;"></div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button onclick="location.reload()" style="background:#c00;color:#fff;border:none;padding:11px 22px;cursor:pointer;font-weight:bold;border-radius:5px;font-family:inherit;font-size:0.7rem;letter-spacing:1px;">REBOOT NODE</button>
                <button id="err-copy-btn" style="background:transparent;color:#f55;border:1px solid #f55;padding:11px 22px;cursor:pointer;font-weight:bold;border-radius:5px;font-family:inherit;font-size:0.7rem;letter-spacing:1px;">COPY REPORT</button>
                <button id="err-email-btn" style="background:transparent;color:#4af;border:1px solid #4af;padding:11px 22px;cursor:pointer;font-weight:bold;border-radius:5px;font-family:inherit;font-size:0.7rem;letter-spacing:1px;">EMAIL TO DEV</button>
                <button onclick="document.getElementById('nexus-crash-overlay').remove()" style="background:transparent;color:#555;border:1px solid #333;padding:11px 22px;cursor:pointer;font-weight:bold;border-radius:5px;font-family:inherit;font-size:0.7rem;letter-spacing:1px;">DISMISS</button>
            </div>
        </div>
    `;

    document.body.appendChild(diagnostic);

    // Safely inject text to prevent XSS
    document.getElementById('err-msg').textContent  = msg;
    document.getElementById('err-file').textContent = url;
    document.getElementById('err-line').textContent = line;
    document.getElementById('err-col').textContent  = col;
    document.getElementById('err-user').textContent = user;
    document.getElementById('err-stack').textContent = stack;
    document.getElementById('err-ua').textContent   = ua;

    document.getElementById('err-copy-btn').onclick = () => {
        navigator.clipboard.writeText(reportText).then(() => {
            document.getElementById('err-copy-btn').textContent = 'COPIED!';
        }).catch(() => {
            prompt('Copy the report below:', reportText);
        });
    };

    const mailSubject = encodeURIComponent(`[NEXUS CRASH] ${msg.slice(0, 80)}`);
    const mailBody    = encodeURIComponent(reportText);
    document.getElementById('err-email-btn').onclick = () => {
        location.href = `mailto:lovexdgamer@gmail.com?subject=${mailSubject}&body=${mailBody}`;
    };

    return false;
};

// --- High-Fidelity Initialization ---
window.addEventListener('load', async () => {
    console.log("[NEXUS] Core Shell Initialized.");
    
    // Core Elements Capture
    window.output = document.getElementById('terminal-output');
    window.input = document.getElementById('terminal-input');
    window.guiContainer = document.getElementById('game-gui-container');
    window.guiContent = document.getElementById('gui-content');
    window.guiTitle = document.getElementById('gui-title');
    window.nexusCanvas = document.getElementById('nexus-canvas');

    // Restore State
    initModeUI();

    // WIRE LISTENERS IMMEDIATELY (Before sync)
    setupInputListeners();
    setupSidebarListeners();
    startAliveLoop();

    // Boot Sequence (WebSocket + Stats established inside, non-blocking)
    await initiateBootSequence();
});

function connectTerminalWS() {
    if (window.termWs) window.termWs.close();
    window.termWs = new WebSocket(window.WS_URL);

    window.termWs.onopen = () => {
        console.log("[WS] Terminal link established.");
        window.backendReady = true;
    };

    window.termWs.onmessage = (e) => {
        if (e.data === "__pong__") return;
        if (e.data.startsWith("[MODEL:")) {
            const label = e.data.match(/\[MODEL:(.*?)\]/)[1];
            console.log("[WS] Model Active:", label);
            return;
        }
        if (e.data.startsWith("[TRIGGER:")) {
            const tag = e.data.match(/\[TRIGGER:(.*?)\]/)[1];
            window.handleCommand(`play ${tag}`);
            return;
        }

        window._clearThinking();
        printToTerminal(e.data, `ai-msg ${window.currentMode}-msg`);
    };

    window.termWs.onclose = () => {
        window.backendReady = false;
        setTimeout(connectTerminalWS, 5000);
    };
}

let statsWs;
function connectStats() {
    if (statsWs) statsWs.close();
    statsWs = new WebSocket(window.STATS_URL);
    statsWs.onmessage = (e) => {
        try {
            const d = JSON.parse(e.data);
            if (window.cpuStat) window.cpuStat.textContent = d.cpu.toFixed(1) + '%';
            if (window.memStat) window.memStat.textContent = d.mem.toFixed(1) + '%';
        } catch(_) {}
    };
    statsWs.onclose = () => setTimeout(connectStats, 5000);
}

function initModeUI() {
    const m = window.MODES[window.currentMode];
    if (!m) return;
    const promptEl = document.getElementById('prompt-label');
    const titleEl = document.getElementById('status-title');
    const modeIndEl = document.getElementById('mode-indicator');
    if (promptEl) { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl) titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color; }
    if (m.color) {
        document.documentElement.style.setProperty('--accent', m.color);
        document.documentElement.style.setProperty('--txt-color', m.color);
    }
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === window.currentMode);
    });
}

function setupInputListeners() {
    if (!window.input) return;
    window.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const cmd = window.input.value.trim();
            if (cmd) {
                window.cmdHistory.push(cmd);
                if (window.cmdHistory.length > 50) window.cmdHistory.shift();
                localStorage.setItem('nexus_cmd_history', JSON.stringify(window.cmdHistory));
                window.historyIndex = window.cmdHistory.length;
                window.handleCommand(cmd);
                window.input.value = '';
            }
        } else if (e.key === 'ArrowUp') {
            if (window.historyIndex > 0) {
                window.historyIndex--;
                window.input.value = window.cmdHistory[window.historyIndex];
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (window.historyIndex < window.cmdHistory.length - 1) {
                window.historyIndex++;
                window.input.value = window.cmdHistory[window.historyIndex];
            } else {
                window.historyIndex = window.cmdHistory.length;
                window.input.value = '';
            }
            e.preventDefault();
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.monitor') && !['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'].includes(e.target.tagName) && !e.target.closest('.a11y-panel')) {
            if (!window.getSelection().toString()) window.input.focus();
        }
    });
}

function setupSidebarListeners() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.getAttribute('data-cmd');
            if (cmd) window.handleCommand(cmd);
            window.input.focus();
        });
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
            window.input.focus();
        });
    });
}

function setMode(modeKey) {
    if (!window.MODES[modeKey]) return;
    window.currentMode = modeKey;
    localStorage.setItem('nexus_mode', modeKey);
    initModeUI();
    printToTerminal(`[SYSTEM] Neural link switched to ${modeKey.toUpperCase()} mode.`, 'sys-msg');
}

async function initiateBootSequence() {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');

    if (!nexusUser || !nexusUser.name) {
        window.location.replace('./login.html');
        return;
    }

    // Update header user display
    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.textContent = nexusUser.name.toUpperCase();

    // Non-blocking backend wake: show a banner line, keep terminal fully usable
    printToTerminal(`[BOOT] Identity: ${nexusUser.name} — establishing neural link...`, 'sys-msg');

    // Kick off backend ping in the background; don't block typing
    (async () => {
        const startWake = Date.now();
        const MAX_WAKE_TIME = 25000;
        let online = false;
        while (Date.now() - startWake < MAX_WAKE_TIME) {
            try {
                const res = await fetch(`${window.API_BASE}/ping`);
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    const ver = data.version || window.NEXUS_VERSION;
                    const nodeEl = document.getElementById('node-display');
                    if (nodeEl) nodeEl.textContent = `ONLINE · ${ver}`;
                    const dot = document.getElementById('conn-dot');
                    if (dot) { dot.style.background = '#0f0'; dot.style.boxShadow = '0 0 6px #0f0'; }
                    online = true;
                    window.backendReady = true;
                    break;
                }
            } catch(e) {}
            await new Promise(r => setTimeout(r, 2000));
        }
        if (!online) {
            printToTerminal('[WARN] Backend cold-start timeout. AI may be unavailable; try again in 30s.', 'conn-err');
            const nodeEl = document.getElementById('node-display');
            if (nodeEl) nodeEl.textContent = 'DEGRADED';
            window.backendReady = false;
        }
        connectTerminalWS();
        connectStats();
    })();

    // Render auth card and show welcome immediately — don't wait for backend
    if (window.renderAuthSection) renderAuthSection();
    printToTerminal(`[AUTH] Identity Verified: ${nexusUser.name}. Welcome to the Grid.`, 'conn-ok');
    printToTerminal(`Nexus online. Type 'help' for command manifest.`, 'sys-msg');
}

// --- ALIVE LOOP (Autonomous Machine) ---
function startAliveLoop() {
    // Periodic System Logs
    setInterval(() => {
        const logs = [
            "[OK] Neural link heartbeat detected.",
            "[INFO] Encrypted data packet transmitted.",
            "[SYS] Sub-millisecond latency maintained.",
            "[OK] Core temperature nominal.",
            "[SEC] 256-bit encryption verified."
        ];
        if (Math.random() > 0.8 && window.guiContainer && window.guiContainer.classList.contains('gui-hidden')) {
            printToTerminal(logs[Math.floor(Math.random() * logs.length)], "sys-msg");
        }
    }, 15000);
}

// --- ACCESSIBILITY ---
window.toggleA11yPanel = function() {
    const panel = document.getElementById('a11y-panel');
    if (panel) {
        panel.classList.toggle('a11y-panel-open');
        return;
    }

    const el = document.createElement('div');
    el.id = 'a11y-panel';
    el.className = 'a11y-panel a11y-panel-open';
    el.innerHTML = `
        <div class="a11y-panel-header">
            <span>[ SYSTEM SETTINGS ]</span>
            <button onclick="window.toggleA11yPanel()" class="a11y-close">X</button>
        </div>
        <div class="a11y-section-label">VISUALS</div>
        <div class="a11y-row">
            <button class="a11y-toggle active" data-class="crt-mode" onclick="window.toggleA11yClass('crt-mode', this)">CRT Mode</button>
            <button class="a11y-toggle" onclick="location.reload()">Reset UI</button>
        </div>
        <div class="a11y-section-label">TEXT SIZE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" onclick="window.toggleA11yClass('a11y-large', this)">Large</button>
            <button class="a11y-toggle" onclick="window.toggleA11yClass('a11y-xl', this)">X-Large</button>
        </div>
        <div class="a11y-section-label">THEME OVERRIDE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" onclick="window.toggleA11yClass('a11y-high-contrast', this)">High Contrast</button>
            <button class="a11y-toggle" onclick="window.toggleA11yClass('a11y-dim', this)">Dim Mode</button>
        </div>
        <div class="a11y-tip">Settings applied to local node.</div>
    `;
    document.body.appendChild(el);
};

window.toggleA11yClass = function(cls, btn) {
    document.body.classList.toggle(cls);
    if (btn) btn.classList.toggle('active');
};

// --- UTILITIES ---
function printToTerminal(text, className = 'sys-msg') {
    if (!window.output) return;
    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    window.output.appendChild(p);
    window.output.scrollTop = window.output.scrollHeight;
}

function printTypewriter(text, className = 'ai-msg') {
    if (!window.output) return;
    const p = document.createElement('p');
    p.className = className;
    window.output.appendChild(p);
    
    const lines = text.split('\n');
    let lineIdx = 0, charIdx = 0;
    
    function tick() {
        if (lineIdx >= lines.length) return;
        const line = lines[lineIdx];
        if (charIdx < line.length) {
            p.innerHTML += line[charIdx];
            charIdx++;
            setTimeout(tick, 2);
        } else {
            p.innerHTML += '<br>';
            lineIdx++;
            charIdx = 0;
            setTimeout(tick, 50);
        }
        window.output.scrollTop = window.output.scrollHeight;
    }
    tick();
}

// Typing Test Link
function startTypingTest() {
    window.handleCommand("type test");
}
