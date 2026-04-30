/**
 * 🛰️ NEXUS TERMINAL CORE v5.3.9 [PROTECTED]
 * High-Fidelity Reconstruction Core — Making the machine ALIVE.
 */

// Dynamic Configuration Loading
(function() {
    const s = document.createElement('script');
    s.src = 'ai_config.js?v=5.3.9';
    s.async = false;
    document.head.appendChild(s);
})();

// --- Global Diagnostic Reporter ---
window.onerror = function(msg, url, line, col, error) {
    const ts = new Date().toLocaleTimeString();
    const fileName = url ? url.split('/').pop() : 'unknown';
    const stack = error?.stack || 'unavailable';
    const user  = (() => { try { return JSON.parse(localStorage.getItem('nexus_user_data') || '{}').name || 'Guest'; } catch(_) { return 'Unknown'; } })();
    
    const reportData = [
        `=== NEXUS CRASH REPORT ===`,
        `Time:    ${new Date().toISOString()}`,
        `Version: ${window.NEXUS_VERSION || '?'}`,
        `User:    ${user}`,
        `Mode:    ${window.currentMode || '?'}`,
        `URL:     ${location.href}`,
        `ERROR:   ${msg}`,
        `LOC:     ${fileName}:${line}:${col}`,
        `STACK:\n${stack}`
    ].join('\n');
    
    console.error("[NEXUS CRASH]", msg, "at", url, ":", line);
    const errDetail = `[${ts}] ERROR: ${msg}\n  > LOCATION: ${fileName}:${line}:${col}\n  > STACK: ${stack.split('\n')[1]?.trim() || 'N/A'}`;
    if (window.nexusErrors) window.nexusErrors.push(errDetail);

    // Show high-fidelity crash UI
    const overlay = document.createElement('div');
    overlay.id = 'nexus-crash-overlay';
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,0,0,0.98);backdrop-filter:blur(25px);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:'Fira Code',monospace;color:#fff;padding:20px;";
    overlay.innerHTML = `
        <div style="max-width:600px; width:100%; border:2px solid #f00; border-radius:15px; background:rgba(20,0,0,0.9); padding:40px; box-shadow:0 0 50px rgba(255,0,0,0.2);">
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:30px; border-bottom:1px solid #400; padding-bottom:20px;">
                <div style="width:20px; height:20px; border-radius:50%; background:#f00; box-shadow:0 0 15px #f00; animation: pulse 1.5s infinite;"></div>
                <h2 style="margin:0; letter-spacing:5px; font-size:1.2rem;">NODE_FAILURE</h2>
            </div>
            
            <div style="font-size:0.7rem; line-height:1.6; margin-bottom:30px;">
                <p style="color:#f55; font-weight:bold;">[ SYSTEM_EXCEPTION_DETECTED ]</p>
                <p style="color:#666;">A critical error has occurred in the neural bridge. Diagnostic data has been captured.</p>
                <div style="background:#000; padding:15px; border:1px solid #311; margin:15px 0; color:#888; font-size:0.6rem; overflow-x:auto;">
                    ${msg}<br>at ${fileName}:${line}
                </div>
            </div>

            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button onclick="location.reload()" style="flex:1; background:#f00; color:#fff; border:none; padding:12px; cursor:pointer; font-weight:bold; border-radius:6px; font-family:inherit; font-size:0.7rem; letter-spacing:1px; transition:0.2s;">REBOOT_NODE</button>
                <button id="transmit-report-btn" style="flex:1; background:#0ff; color:#000; border:none; padding:12px; cursor:pointer; font-weight:bold; border-radius:6px; font-family:inherit; font-size:0.7rem; letter-spacing:1px; transition:0.2s;">TRANSMIT_TO_DEVELOPER</button>
                <button onclick="document.getElementById('nexus-crash-overlay').remove()" style="width:100%; background:transparent; color:#444; border:1px solid #333; padding:8px; cursor:pointer; margin-top:10px; border-radius:6px; font-family:inherit; font-size:0.6rem; letter-spacing:1px;">DISMISS_OVERLAY</button>
            </div>
            <p id="transmit-status" style="text-align:center; font-size:0.6rem; margin-top:20px; color:#555;"></p>
        </div>
        <style> @keyframes pulse { 0% { opacity:0.6; } 50% { opacity:1; } 100% { opacity:0.6; } } </style>
    `;
    document.body.appendChild(overlay);

    // Wire up transmission
    setTimeout(() => {
        const btn = document.getElementById('transmit-report-btn');
        const status = document.getElementById('transmit-status');
        if (!btn) return;
        btn.onclick = async () => {
            btn.disabled = true; btn.textContent = 'TRANSMITTING...';
            try {
                const res = await fetch(`${window.API_BASE || ''}/api/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ report: reportData })
                });
                if (res.ok) {
                    status.textContent = 'NEURAL UPLINK SUCCESSFUL. REPORT TRANSMITTED TO XAVIER SCOTT.';
                    status.style.color = '#0f0';
                    btn.textContent = 'TRANSMITTED';
                } else { throw new Error(); }
            } catch(e) {
                status.textContent = 'TRANSMISSION FAILURE. VERIFY NETWORK STABILITY.';
                status.style.color = '#f55';
                btn.textContent = 'RETRY_TRANSMIT'; btn.disabled = false;
            }
        };
    }, 100);

    return false;
};

// --- High-Fidelity Initialization ---
window.addEventListener('load', async () => {
    console.log("[NEXUS] Core Shell Initialized.");
    
    // 1. INSTANT COLOR SYNC (No more grey drift)
    const savedMode = localStorage.getItem('nexus_mode') || 'nexus';
    window.currentMode = savedMode;
    const m = window.MODES[savedMode];
    if (m && m.color) {
        document.documentElement.style.setProperty('--accent', m.color);
    } else {
        document.documentElement.style.setProperty('--accent', '#0ff');
    }

    // 2. Core Elements Capture
    window.output = document.getElementById('terminal-output');
    window.input = document.getElementById('terminal-input');
    window.guiContainer = document.getElementById('game-gui-container');
    window.guiContent = document.getElementById('gui-content');
    window.guiTitle = document.getElementById('gui-title');
    window.nexusCanvas = document.getElementById('nexus-canvas');

    // --- Dynamic UI Reconstruction ---
    // 1. Add Neural Uplink Button (True Paperclip)
    const inputWrapper = document.querySelector('.terminal-input-wrapper');
    if (inputWrapper && !document.getElementById('uplink-trigger')) {
        const uplinkBtn = document.createElement('button');
        uplinkBtn.id = 'uplink-trigger';
        uplinkBtn.className = 'uplink-btn';
        uplinkBtn.title = 'Neural Uplink (Attach Image)';
        uplinkBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="m21.251 10.43-8.839 8.839a5.617 5.617 0 1 1-7.943-7.943l9.043-9.043a3.83 3.83 0 1 1 5.416 5.416l-9.043 9.043a2.042 2.042 0 1 1-2.887-2.888l8.327-8.327-.721-.722-8.327 8.327a3.064 3.064 0 1 0 4.331 4.331l9.043-9.043a4.852 4.852 0 1 0-6.861-6.861l-9.043 9.043a6.639 6.639 0 1 0 9.389 9.389l8.839-8.839-.721-.721Z"/>
            </svg>
        `;
        uplinkBtn.onclick = () => document.getElementById('neural-uplink')?.click();
        inputWrapper.appendChild(uplinkBtn);
    }

    const picker = document.querySelector('.mode-picker');
    if (picker && !document.querySelector('.mode-education')) {
        const eduBtn = document.createElement('button');
        eduBtn.className = 'mode-btn mode-education';
        eduBtn.dataset.mode = 'education';
        eduBtn.title = 'Mentor Mode';
        eduBtn.textContent = 'Education';
        picker.appendChild(eduBtn);
        
        // Wire listener
        eduBtn.addEventListener('click', () => {
            setMode('education');
            window.input.focus();
        });
    }

    // Update Settings Icon (Gear)
    const settingsBtn = document.querySelector('.a11y-open-btn');
    if (settingsBtn) {
        settingsBtn.title = 'System Settings';
        settingsBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right:8px;">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7-3.21 2.11-1.63a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a8.4 8.4 0 0 0-1.04-.6l-.37-2.65a.5.5 0 0 0-.5-.43h-4a.5.5 0 0 0-.5.43l-.37 2.65c-.37.16-.72.36-1.04.6l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64L5 12.29v.42l-2.11 1.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.32.24.67.44 1.04.6l.37 2.65a.5.5 0 0 0 .5.43h4a.5.5 0 0 0 .5-.43l.37-2.65c.37-.16.72-.36 1.04-.6l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64L19 12.71v-.42Z"/>
            </svg>
            SETTINGS
        `;
    }

    // Clean up Status Bar (Top)
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
        statusBar.style.justifyContent = 'space-between';
        statusBar.style.padding = '0 25px';
        statusBar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        statusBar.style.background = 'rgba(0,0,0,0.4)';
    }

    // Restore State
    initModeUI();

    // WIRE LISTENERS IMMEDIATELY (Before sync)
    setupInputListeners();
    setupSidebarListeners();
    setupUplinkHandlers(); // New Image Vision Handlers
    startAliveLoop();
});

function setupUplinkHandlers() {
    const monitor = document.querySelector('.monitor');
    if (!monitor) return;

    // Drag and Drop
    monitor.addEventListener('dragover', (e) => {
        e.preventDefault();
        monitor.style.borderColor = '#fff';
        monitor.style.boxShadow = '0 0 30px #fff';
    });
    monitor.addEventListener('dragleave', () => {
        const m = window.MODES[window.currentMode];
        monitor.style.borderColor = m?.color || 'var(--accent)';
        monitor.style.boxShadow = '';
    });
    monitor.addEventListener('drop', (e) => {
        e.preventDefault();
        const m = window.MODES[window.currentMode];
        monitor.style.borderColor = m?.color || 'var(--accent)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImageUplink(file);
    });

    // Hidden input for manual uplink
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'neural-uplink';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImageUplink(file);
    };
    document.body.appendChild(input);
}

function handleImageUplink(file) {
    printToTerminal(`[SYSTEM] Syncing neural image: ${file.name}...`, 'sys-msg');
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        printToTerminal(`<img src="${base64}" style="max-width:200px; border:1px solid var(--accent); margin:10px 0; display:block;">`, 'sys-msg');
        window.prompt_ai_proxy("Describe this image and analyze it.", base64, window.currentMode);
    };
    reader.readAsDataURL(file);
}

function connectTerminalWS() {
    if (window.termWs) window.termWs.close();
    window.termWs = new WebSocket(window.WS_URL);

    window.termWs.onopen = () => {
        console.log("[WS] Terminal link established.");
        window.backendReady = true;
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.style.background = '#0f0'; dot.style.boxShadow = '0 0 6px #0f0'; }
        const nodeEl = document.getElementById('node-display');
        if (nodeEl && nodeEl.textContent === 'OFFLINE') nodeEl.textContent = `ONLINE · ${window.NEXUS_VERSION}`;
    };

    window.termWs.onmessage = (e) => {
        if (e.data === "__pong__") return;
        
        let messageText = e.data;
        let audioB64 = null;

        try {
            const json = JSON.parse(e.data);
            if (json.text) {
                messageText = json.text;
                audioB64 = json.audio;
            }
        } catch(_) {}

        if (messageText.startsWith("[MODEL:")) {
            const label = messageText.match(/\[MODEL:(.*?)\]/)[1];
            console.log("[WS] Model Active:", label);
            return;
        }
        if (messageText.startsWith("[TRIGGER:")) {
            const tag = messageText.match(/\[TRIGGER:(.*?)\]/)[1];
            window.handleCommand(`play ${tag}`);
            return;
        }

        window._clearThinking();
        if (window.printTypewriter) {
            window.printTypewriter(messageText, `ai-msg ${window.currentMode}-msg`);
        } else {
            printToTerminal(messageText, `ai-msg ${window.currentMode}-msg`);
        }

        if (audioB64) playNeuralVoice(audioB64);
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

    // Get current user name for prompt
    const user = JSON.parse(localStorage.getItem('nexus_user_data') || sessionStorage.getItem('nexus_user_data') || '{"name":"guest"}');
    const userName = (user.name || 'guest').toLowerCase().split(' ')[0];

    const promptEl = document.getElementById('prompt-label');
    const titleEl = document.getElementById('status-title');
    const modeIndEl = document.getElementById('mode-indicator');

    if (promptEl) { 
        promptEl.textContent = `${userName}@nexus:~$`; 
        promptEl.style.color = m.color; 
    }
    if (titleEl) titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color; }
    
    if (m.color) {
        document.documentElement.style.setProperty('--accent', m.color);
        const settingsBtn = document.querySelector('.a11y-open-btn');
        if (settingsBtn) {
            settingsBtn.style.borderColor = m.color;
            settingsBtn.style.color = m.color;
            settingsBtn.querySelector('svg')?.style.setProperty('color', m.color);
        }
    }
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === window.currentMode);
    });
}

function setupInputListeners() {
    if (!window.input) return;
    window.input.addEventListener('keydown', (e) => {
        if (window.isLockedOut) {
            e.preventDefault();
            return;
        }
        if (e.key === 'Enter') {
            const cmd = window.input.value.trim();
            if (cmd) {
                // If in unfiltered mode, check for toxicity to increase rage
                if (window.currentMode === 'unfiltered') {
                    const isForceVulgar = localStorage.getItem('nexus_force_vulgar') === 'true';
                    const toxicKeywords = ['bitch', 'fuck', 'shit', 'slow', 'dumb', 'stupid', 'stfu', 'asshole', 'nigger', 'nigga'];
                    
                    if (toxicKeywords.some(word => cmd.toLowerCase().includes(word))) {
                        window.unfilteredRage += 25;
                        applyGlitchEffect();
                    }
                    
                    // If Force Vulgar is ON, disable lockout and just go hard
                    if (window.unfilteredRage >= 100 && !isForceVulgar) {
                        triggerLockout();
                        window.input.value = '';
                        return;
                    }
                }

                window.cmdHistory.push(cmd);
                if (window.cmdHistory.length > 50) window.cmdHistory.shift();
                localStorage.setItem('nexus_cmd_history', JSON.stringify(window.cmdHistory));
                window.historyIndex = window.cmdHistory.length;
                window.handleCommand(cmd);
                window.input.value = '';
            }
        }
 else if (e.key === 'ArrowUp') {
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
    
    const m = window.MODES[modeKey];
    printToTerminal(`[SYSTEM] Neural link switched to ${modeKey.toUpperCase()} mode.`, `sys-msg-persistent-${modeKey}`);
}

let _isBooted = false;
window.toggleTips = function() {
    const disabled = localStorage.getItem('nexus_tips_disabled') === 'true';
    localStorage.setItem('nexus_tips_disabled', !disabled);
    updateTipsBtn();
    printToTerminal(`[SYSTEM] Neural tips ${!disabled ? 'DEACTIVATED' : 'ENGAGED'}.`, "sys-msg-colored");
};

function updateTipsBtn() {
    const btn = document.querySelector('button[onclick="window.toggleTips()"]');
    if (!btn) return;
    const disabled = localStorage.getItem('nexus_tips_disabled') === 'true';
    btn.classList.toggle('active', !disabled);
    btn.textContent = `NEURAL TIPS: ${!disabled ? 'ON' : 'OFF'}`;
}

async function initiateBootSequence() {
    if (_isBooted) return;
    _isBooted = true;

    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const isGuest = !user.email || user.email === 'guest@local';
    const persistenceMsg = document.getElementById('settings-persistence-msg');
    if (persistenceMsg) {
        persistenceMsg.textContent = isGuest 
            ? "GUEST_MODE: SETTINGS ARE EPHEMERAL AND WILL BE PURGED." 
            : "NODE IDENTITY SYNCED: CONFIGURATION IS PERSISTENT.";
    }
    
    updateTipsBtn();

    // 1. Fetch Dynamic Status
    try {
        const res = await fetch(`status.json?v=${Date.now()}`);
        const s = await res.json();
        window.MAINTENANCE_MODE = s.maintenance === true;
        window.MAINTENANCE_MESSAGE = s.message || 'AI kernel is offline while improvements deploy.';
    } catch(e) {
        window.MAINTENANCE_MODE = false;
    }

    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || sessionStorage.getItem('nexus_user_data') || 'null');

    if (!nexusUser || !nexusUser.name) {
        if (document.getElementById('auth-screen')) return;
        window.location.replace('./login.html');
        return;
    }

    // Owner Identity Check
    const ownerEmail = window.NEXUS_CONFIG?.OWNER_EMAIL || 'lovexdgamer@gmail.com';
    if (nexusUser.email === ownerEmail) {
        window.OWNER_MODE = true;
        console.log("[SEC] Owner Identity Verified. Unlocking privileged nodes.");
    }

    // Non-blocking backend wake
    const welcomeMsg = window.OWNER_MODE 
        ? `<span style="font-size:0.75rem;">[BOOT] Identity: ${nexusUser.name} (OWNER) — established. Unlocking Filter Bypass.</span>`
        : `<span style="font-size:0.75rem;">[BOOT] Identity: ${nexusUser.name} — establishing neural link...</span>`;
    
    printToTerminal(welcomeMsg, 'sys-msg');

    (async () => {
        const startWake = Date.now();
        const MAX_WAKE_TIME = 25000;
        let online = false;

        const dot = document.getElementById('conn-dot');
        if (dot) { dot.style.background = '#ffb300'; dot.style.boxShadow = '0 0 6px #ffb300'; }

        while (Date.now() - startWake < MAX_WAKE_TIME) {
            try {
                const res = await fetch(`${window.API_BASE}/ping`);
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    const ver = data.version || window.NEXUS_VERSION;
                    const nodeEl = document.getElementById('node-display');
                    if (nodeEl) nodeEl.textContent = `ONLINE · ${ver}`;
                    if (dot) { dot.style.background = '#0f0'; dot.style.boxShadow = '0 0 6px #0f0'; }
                    online = true;
                    window.backendReady = true;
                    printToTerminal('<span style="font-size:0.75rem; color:#0f0;">[LINK] Pacific Hub is online. AI ready.</span>', 'conn-ok');
                    break;
                }
            } catch(e) {}
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!online) {
            const nodeEl = document.getElementById('node-display');
            if (nodeEl) nodeEl.textContent = 'DEGRADED';
            if (dot) { dot.style.background = '#444'; dot.style.boxShadow = 'none'; }
            window.backendReady = false;
        }

        connectTerminalWS();
        connectStats();
    })();

    if (window.renderAuthSection) renderAuthSection();
    printToTerminal(`<span style="font-size:0.75rem; color:#0f0;">[AUTH] Identity Verified: ${nexusUser.name}. Welcome to the Grid.</span>`, 'conn-ok');
    printToTerminal(`<span style="font-size:0.75rem;">Nexus online. Type 'help' for command manifest.</span>`, 'sys-msg');

    if (window.MAINTENANCE_MODE) {
        setTimeout(() => {
            printToTerminal('<span style="color:#ffb300;letter-spacing:1px;">╔══════════════════════════════════════════════════════╗</span>', 'sys-msg');
            printToTerminal('<span style="color:#ffb300;">║</span>  <span style="color:#ffb300;font-weight:bold;letter-spacing:2px;">⚡  PACIFIC HUB — UPGRADE IN PROGRESS  ⚡</span>  <span style="color:#ffb300;">║</span>', 'sys-msg');
            printToTerminal('<span style="color:#ffb300;">╠══════════════════════════════════════════════════════╣</span>', 'sys-msg');
            printToTerminal(`<span style="color:#ffb300;">║</span>  <span style="color:#aaa;">${window.MAINTENANCE_MESSAGE.padEnd(46)}</span>  <span style="color:#ffb300;">║</span>`, 'sys-msg');
            printToTerminal('<span style="color:#ffb300;">║</span>  <span style="color:#aaa;">Terminal commands remain active. Check back soon.  </span>  <span style="color:#ffb300;">║</span>', 'sys-msg');
            printToTerminal('<span style="color:#ffb300;">╚══════════════════════════════════════════════════════╝</span>', 'sys-msg');
            const nodeEl = document.getElementById('node-display');
            if (nodeEl) nodeEl.textContent = 'MAINTENANCE';
            const dot = document.getElementById('conn-dot');
            if (dot) { dot.style.background = '#ffb300'; dot.style.boxShadow = '0 0 8px #ffb300'; }
        }, 600);
    }
}

// --- ALIVE LOOP (Autonomous Machine) ---
function startAliveLoop() {
    setInterval(() => {
        if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
            window.termWs.send("__ping__");
        }
    }, 30000);
}

function applyGlitchEffect() {
    const monitor = document.querySelector('.monitor');
    if (!monitor) return;
    monitor.classList.add('monitor-glitch');
    setTimeout(() => monitor.classList.remove('monitor-glitch'), 500);
}

function triggerLockout() {
    window.isLockedOut = true;
    window.unfilteredRage = 0;
    const originalPrompt = document.getElementById('prompt-label').textContent;
    const promptEl = document.getElementById('prompt-label');
    
    printToTerminal("[CRITICAL] NEURAL LINK SEVERED. Link unstable due to high hostility.", "sys-msg-persistent-unfiltered");
    
    let countdown = 30;
    const timer = setInterval(() => {
        if (promptEl) promptEl.textContent = `LOCKOUT [${countdown}s]`;
        countdown--;
        if (countdown < 0) {
            clearInterval(timer);
            window.isLockedOut = false;
            if (promptEl) promptEl.textContent = originalPrompt;
            printToTerminal("[SYSTEM] Neural link re-established. Control your aggression.", "sys-msg-colored");
        }
    }, 1000);
}

// --- ACCESSIBILITY ---
window.toggleA11yPanel = function() {
    const panel = document.getElementById('a11y-panel');
    if (panel) panel.classList.toggle('a11y-panel-open');
};

window.toggleNeuralProfile = function() {
    const panel = document.getElementById('neural-profile-panel');
    if (panel) {
        panel.classList.toggle('open');
        renderNeuralProfile();
    }
};

function renderNeuralProfile() {
    const panel = document.getElementById('neural-profile-panel');
    if (!panel) return;

    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const isGuest = !user.email || user.email === 'guest@local';
    const savedMem = localStorage.getItem('nexus_neural_memory') || '';
    const savedLang = localStorage.getItem('nexus_ai_lang') || 'en-US';

    panel.innerHTML = `
        <div class="panel-header">
            <span>[ AI NEURAL PROFILE ]</span>
            <button onclick="window.toggleNeuralProfile()" class="a11y-close">
                 <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>
        
        <div class="a11y-section">
            <div class="a11y-section-label">PERSONAL CONTEXT (MEMORY)</div>
            <textarea id="neural-memory-input" placeholder="Tell Nexus about your projects, preferences, or name..." 
                style="width:100%; height:100px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:#fff; font-family:inherit; font-size:0.7rem; padding:12px; border-radius:8px; outline:none; resize:none;">${savedMem}</textarea>
            <button class="a11y-toggle" onclick="saveNeuralMemory()" style="margin-top:5px; height:40px;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" style="margin-right:5px;"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.58z"/></svg>
                SYNC DATA CORE
            </button>
        </div>

        <div class="a11y-section">
            <div class="a11y-section-label">NEURAL VOICE CONFIG</div>
            <div class="a11y-row">
                <button id="tts-toggle" class="a11y-toggle" onclick="toggleNeuralVoice()">VOICE: OFF</button>
                <select id="ai-lang-select" class="a11y-toggle" onchange="saveAILang(this.value)" style="appearance:none; text-align:center;">
                    <option value="en-US" ${savedLang === 'en-US' ? 'selected' : ''}>ENGLISH (US)</option>
                    <option value="en-GB" ${savedLang === 'en-GB' ? 'selected' : ''}>ENGLISH (UK)</option>
                    <option value="es-ES" ${savedLang === 'es-ES' ? 'selected' : ''}>SPANISH</option>
                    <option value="fr-FR" ${savedLang === 'fr-FR' ? 'selected' : ''}>FRENCH</option>
                </select>
            </div>
        </div>

        <div class="a11y-section unfiltered-only">
            <div class="a11y-section-label">ADVANCED OVERRIDE</div>
            <button id="vulgar-toggle" class="a11y-toggle" onclick="toggleForceVulgar()">FORCE VULGARITY: OFF</button>
        </div>

        <p class="a11y-tip">${isGuest ? 'GUEST_SESSION: DATA PURGED ON TERMINATION' : 'NODE IDENTITY SYNCED VIA GOOGLE AUTH'}</p>
    `;
    
    updateUplinkUI();
}

const NEURAL_TIPS = [
    "Type 'uplink' to select and analyze an image file.",
    "Drag and drop any image onto the monitor to scan it.",
    "The 'diag' command provides real-time owner-only telemetry.",
    "Custom neural memory is saved to your identity in AI PROFILE.",
    "Neural Voice can be toggled in the AI PROFILE menu.",
    "Click your profile card to access Diagnostics and Settings."
];

function showNeuralTip() {
    if (localStorage.getItem('nexus_tips_disabled') === 'true') return;
    
    const existing = document.querySelector('.neural-tip');
    if (existing) existing.remove();

    const tip = NEURAL_TIPS[Math.floor(Math.random() * NEURAL_TIPS.length)];
    const el = document.createElement('div');
    el.className = 'neural-tip';
    el.innerHTML = `
        <div class="tip-header">[ NEURAL_TIP ]</div>
        <button class="tip-close" onclick="this.parentElement.remove()">X</button>
        <div class="tip-body">${tip}</div>
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 10000);
}

// Show first tip after 5 seconds, then every 3 minutes
setTimeout(showNeuralTip, 5000);
setInterval(showNeuralTip, 180000);

window.saveNeuralMemory = function() {
    const val = document.getElementById('neural-memory-input').value.trim();
    localStorage.setItem('nexus_neural_memory', val);
    printToTerminal("[SYSTEM] Neural memory synchronized. Personal context active.", "sys-msg-colored");
};

window.saveAILang = function(lang) {
    localStorage.setItem('nexus_ai_lang', lang);
    printToTerminal(`[SYSTEM] Neural voice language set to: ${lang}`, "sys-msg-colored");
};

window.toggleForceVulgar = function() {
    const active = localStorage.getItem('nexus_force_vulgar') === 'true';
    localStorage.setItem('nexus_force_vulgar', !active);
    updateUplinkUI();
    printToTerminal(`[SYSTEM] Force-Vulgarity protocol ${!active ? 'ENGAGED' : 'DEACTIVATED'}.`, "sys-msg-colored");
};

window.toggleNeuralVoice = function() {
    const active = localStorage.getItem('nexus_tts_active') === 'true';
    localStorage.setItem('nexus_tts_active', !active);
    updateUplinkUI();
    printToTerminal(`[SYSTEM] Neural voice synthesis ${!active ? 'ENGAGED' : 'DEACTIVATED'}.`, "sys-msg-colored");
};

function updateUplinkUI() {
    const ttsBtn = document.getElementById('tts-toggle');
    const vulgarBtn = document.getElementById('vulgar-toggle');
    if (ttsBtn) {
        const active = localStorage.getItem('nexus_tts_active') === 'true';
        ttsBtn.classList.toggle('active', active);
        ttsBtn.textContent = `VOICE: ${active ? 'ON' : 'OFF'}`;
    }
    if (vulgarBtn) {
        const active = localStorage.getItem('nexus_force_vulgar') === 'true';
        vulgarBtn.classList.toggle('active', active);
        vulgarBtn.textContent = `FORCE VULGARITY: ${active ? 'ON' : 'OFF'}`;
    }
}

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
    
    setTimeout(() => {
        window.output.scrollTo({ top: window.output.scrollHeight, behavior: 'smooth' });
    }, 10);
}

function printTypewriter(text, className = 'ai-msg', speed = 15) {
    if (!window.output) return;
    const p = document.createElement('p');
    p.className = className;
    window.output.appendChild(p);
    
    const lines = text.split('\n');
    let lineIdx = 0, charIdx = 0;
    
    function tick() {
        if (lineIdx >= lines.length) {
            window.output.scrollTop = window.output.scrollHeight;
            return;
        }
        const line = lines[lineIdx];
        if (charIdx < line.length) {
            p.innerHTML += line[charIdx];
            charIdx++;
            setTimeout(tick, speed);
        } else {
            p.innerHTML += '<br>';
            lineIdx++;
            charIdx = 0;
            setTimeout(tick, speed * 2);
        }
        if (charIdx % 5 === 0) window.output.scrollTop = window.output.scrollHeight;
    }
    tick();
}

// Global Exports
window.printToTerminal = printToTerminal;
window.printTypewriter = printTypewriter;
window.setMode = setMode;
window.initiateBootSequence = initiateBootSequence;
window.startTypingTest = startTypingTest;

function startTypingTest() { window.handleCommand("type test"); }
