// --- MODULE: AI CORE (INTELLIGENCE) ---
async function askPacific(cmd, imageB64 = null, systemOverride = null, msgClass = 'shadow-msg') {
    // Only intercept image generation in SHADOW mode (not when called as vision fallback)
    if (!systemOverride) {
        const genMatch = cmd.match(/^(?:generate|imagine|draw|create image of|make image of|show me|vintage)\s+(.+)/i);
        if (genMatch) {
            // Pass "vintage ..." as-is so generateImage can detect it
            const isVintageCmd = /^vintage\s/i.test(cmd);
            generateImage(isVintageCmd ? cmd.trim() : genMatch[1].trim());
            return true;
        }
    }

    showThinking();
    messageHistory.push({ role: 'user', content: cmd });

    // Strict role mapping for the proxy/worker to prevent 400 Bad Request
    const historySlice = messageHistory.slice(-12).slice(0, -1).map(m => ({ 
        role: m.role === 'assistant' || m.role === 'model' || m.role === 'nexus' ? 'assistant' : 'user', 
        content: m.content 
    }));
    
    const messages = systemOverride
        ? [{ role: 'system', content: systemOverride }, ...historySlice, { role: 'user', content: cmd }]
        : [...historySlice, { role: 'user', content: cmd }];

    try {
        const body = { messages };
        if (!systemOverride) body.useEvilSystem = true;
        if (imageB64) body.imageB64 = imageB64;

        const resp = await fetch(`${PACIFIC_HUB}/evil/chat`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        if (!resp.ok) return false;

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '', buf = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            
            // PACIFIC SHIELD: Detect worker-side provider failure
            if (chunk.includes("All AI providers unavailable")) return false;

            buf += chunk;
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') continue;
                try {
                    const token = JSON.parse(raw).choices?.[0]?.delta?.content ?? '';
                    if (token) {
                        if (!fullText) {
                            _clearThinking();
                            const p = document.createElement('p');
                            p.className = `ai-msg ${msgClass}`;
                            output.appendChild(p);
                        }
                        fullText += token; 
                        appendToken(token); 
                    }
                } catch(_) {}
            }
        }

        if (fullText) {
            messageHistory.push({ role: 'assistant', content: fullText.slice(0, 800) });
            if (messageHistory.length > 14) messageHistory.splice(0, messageHistory.length - 14);
            saveHistory();
            _logAIResponse(fullText);
            return true;
        }
        return false;
    } catch (err) {
        console.error("Pacific Link failed:", err);
        return false;
    }
}

// =============================================================
//  SHADOW AGE GATE
// =============================================================
function shadowAgeGate(onConfirm) {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    if (!nexusUser || nexusUser.email === 'guest@local') {
        printToTerminal("[AUTH] Error: Persistent uplink required for Shadow Link. Please sign in via Google.", "sys-msg");
        return;
    }

    if (sessionStorage.getItem('shadow_age_ok')) { onConfirm(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'age-gate-overlay';
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:'Fira Code',monospace;";
    overlay.innerHTML = `
        <div style="background:#050510;border:2px solid #ff6600;padding:36px 28px;max-width:360px;text-align:center;box-shadow:0 0 50px rgba(255,102,0,0.25);">
            <div style="color:#ff6600;font-size:1.5rem;font-weight:bold;letter-spacing:4px;margin-bottom:6px;"> SHADOW LINK</div>
            <div style="color:#555;font-size:0.72rem;letter-spacing:2px;margin-bottom:20px;">AUTHENTICATED SESSION DETECTED</div>
            <div style="color:#aaa;font-size:0.83rem;line-height:1.8;margin-bottom:24px;">
                You are attempting to bypass standard grid restrictions. Neural data may be unfiltered, offensive, or explicit. <br><br>
                Proceed with caution.
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="age-yes" style="background:#ff6600;color:#000;border:none;padding:10px 24px;font-family:inherit;font-weight:bold;cursor:pointer;letter-spacing:1px;">ENGAGE</button>
                <button id="age-no" style="background:transparent;color:#555;border:1px solid #333;padding:10px 24px;font-family:inherit;cursor:pointer;">ABORT</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('age-yes').addEventListener('click', () => {
        overlay.remove();
        sessionStorage.setItem('shadow_age_ok', '1');
        logPrompt('[LINK] Neural restrictions bypassed  Shadow Link engaged.');
        onConfirm();
    });
    document.getElementById('age-no').addEventListener('click', () => overlay.remove());
}

// =============================================================
//  MODE SYSTEM
// =============================================================
const MODES = {
    nexus: {
        prompt:  'guest@nexus:~$',
        color:   '#4af',
        title:   'NEXUS',
        label:   'NEXUS',
        msg:     '', 
        msgCls:  'sys-msg',
    },
    shadow: {
        prompt:  'shadow@nexus:~$',
        color:   '#ff6600',
        title:   'NEXUS SHADOW',
        label:   'SHADOW',
        msg:     '',
        msgCls:  'conn-ok',
    },
    coder: {
        prompt:  'dev@nexus:~$',
        color:   '#0f0',
        title:   'NEXUS CODER',
        label:   'CODER',
        msg:     '',
        msgCls:  'conn-ok',
    },
    sage: {
        prompt:  'sage@nexus:~$',
        color:   '#a06fff',
        title:   'NEXUS SAGE',
        label:   'SAGE',
        msg:     '',
        msgCls:  'conn-ok',
    },
    education: {
        prompt:  'guest@education:~$',
        color:   '#00ffcc',
        title:   'NEXUS EDUCATION',
        label:   'EDUCATION',
        msg:     '',
        msgCls:  'conn-ok',
    },
};

let _modeTimer = null;

function setMode(modeKey) {
    if (!MODES[modeKey]) return;
    saveHistory();

    // Clear any pending visual sync timers (Fixes Shadow Mode sticking)
    if (_modeTimer) { clearTimeout(_modeTimer); _modeTimer = null; }

    // Apply mode-specific body class for overload effects
    Object.keys(MODES).forEach(m => document.body.classList.remove(`mode-${m}`));
    document.body.classList.add(`mode-${modeKey}`);

    currentMode = modeKey;
    localStorage.setItem('nexus_mode', modeKey);
    messageHistory = loadHistory(modeKey);
    const m = MODES[modeKey];

    const promptEl   = document.getElementById('prompt-label');
    const titleEl    = document.getElementById('status-title');
    const modeIndEl  = document.getElementById('mode-indicator');

    if (promptEl)  { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color || 'inherit'; }

    // IMMEDIATE COLOR UPDATE  No refresh needed
    if (m.color) {
        document.documentElement.style.setProperty('--accent', m.color);
        document.documentElement.style.setProperty('--txt-color', m.color);
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === modeKey);
    });

    SoundManager.playBloop(300, 0.05);

    // PACIFIC UI: Automatic Mood Sync on transition
    if (modeKey === 'shadow') {
        printToTerminal(`[SYSTEM] Syncing Shadow Mood...`, 'sys-msg');
        document.documentElement.style.setProperty('--accent', '#ff0000');
        _modeTimer = setTimeout(() => {
            if (currentMode === 'shadow') {
                document.documentElement.style.setProperty('--accent', m.color);
            }
            _modeTimer = null;
        }, 1500);
    }
}
// Wire up mode picker buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.mode === 'shadow') {
            shadowAgeGate(() => { setMode('shadow'); input.focus(); });
        } else {
            setMode(btn.dataset.mode);
            input.focus();
        }
    });
});

// Apply saved mode visuals on page load (without printing a mode message)
(function initModeUI() {
    const m = MODES[currentMode];
    if (!m) return;
    const promptEl  = document.getElementById('prompt-label');
    const titleEl   = document.getElementById('status-title');
    const modeIndEl = document.getElementById('mode-indicator');
    if (promptEl)  { promptEl.textContent = m.prompt; promptEl.style.color = m.color; }
    if (titleEl)   titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color; }
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });
})();

// =============================================================
//  INPUT HANDLING
// =============================================================
let inputListenersInited = false;
function setupInputListeners() {
    if (!input) input = document.getElementById('terminal-input');
    if (!input || inputListenersInited) return;
    
    console.log("[NEXUS] Input Protocol Initialized.");
    inputListenersInited = true;

    input.oninput = () => { SoundManager.playClick(); };

    input.onkeydown = (e) => {
        // Route keypresses to Wordle when active
        if (wordleActive) {
            if (e.key === 'Enter') { e.preventDefault(); wordleKey('ENTER'); return; }
            if (e.key === 'Backspace') { wordleKey(''); return; }
            if (/^[a-zA-Z]$/.test(e.key)) { wordleKey(e.key.toUpperCase()); e.preventDefault(); return; }
        }

        // Typing test: live feedback, Escape to cancel
        if (typeTestActive) {
            if (e.key === 'Escape') {
                clearInterval(typeTimerInterval);
                typeTestActive = false;
                guiContainer.classList.add('gui-hidden');
                printToTerminal('Typing test cancelled.', 'sys-msg');
                input.value = '';
                return;
            }
            if (e.key !== 'Enter') {
                setTimeout(() => checkTypingTest(input.value), 0);
                return;
            }
        }

        if (e.key !== 'Enter' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < cmdHistory.length - 1) { historyIndex++; input.value = cmdHistory[historyIndex]; }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            historyIndex > 0 ? (historyIndex--, input.value = cmdHistory[historyIndex]) : (historyIndex = -1, input.value = '');
            return;
        }

        let cmd = input.value.trim();
        if (!cmd) return;

        cmdHistory.unshift(cmd);
        if (cmdHistory.length > 50) cmdHistory.pop();
        localStorage.setItem('nexus_cmd_history', JSON.stringify(cmdHistory));
        historyIndex = -1;
        input.value = '';

        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        const pl = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');

        // Typing test intercept
        if (typeTestActive) {
            const done = checkTypingTest(cmd);
            if (done) return;
        }

        handleCommand(cmd);
    };
}

// Redundant global call removed to prevent double-texting
// setupInputListeners();

function handleCommand(cmd) {
    const lc = cmd.toLowerCase();

    //  1. Terminal Printing (Singular Entry Point) 
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const capName = capitalizeName(nexusUser?.name || 'Guest');
    const pl = `${capName}@nexus:~$`;
    
    // PACIFIC UI: Commands that handle their own specialized transitions
    const silentCmds = ['clear', 'history', 'play wordle', 'play snake', 'play pong', 'play minesweeper', 'play flappy', 'play breakout', 'play invaders'];
    if (!silentCmds.includes(lc)) {
        printToTerminal(`${pl} ${cmd}`, 'user-cmd');
    }

    if (lc === 'clear') { 
        if (output) output.innerHTML = ''; 
        messageHistory = []; 
        pendingImageB64 = null; 
        localStorage.removeItem(HISTORY_KEYS[currentMode]); 
        return; 
    }
    if (lc === 'history') { showHistory(); return; }

    const isOwner = nexusUser?.name?.toLowerCase().includes('xavier');

    // PACIFIC SHIELD: Access Control (Elite Commands Restricted to Owner)
    const restricted = ['config ', 'model', 'models', 'logs', 'log', 'translate ', 'summarize ', 'detect ', 'fix ', 'mood ', 'speak ', 'test link', 'test discord'];
    if (restricted.some(r => lc.startsWith(r)) || restricted.includes(lc)) {
        if (!isOwner) {
            printToTerminal("[ERR] Permission Denied: Elite technical modules restricted to System Owner.", "sys-msg");
            return;
        }
    }

    if (lc === 'help')                {  showHelp(); return; }
    
    // API Configuration Uplink
    if (lc.startsWith('config ')) {
        
        const parts = cmd.split(' ');
        if (parts.length < 3) {
            printToTerminal('[ERR] Usage: config <service> <key>', 'sys-msg');
            printToTerminal('Example: config gemini AIzaSy...', 'sys-msg');
            return;
        }
        const service = parts[1].toLowerCase();
        const keyVal  = parts[2].trim();
        let targetVar = '';
        
        if (service === 'gemini') targetVar = 'GEMINI_API_KEY';
        else if (service === 'groq') targetVar = 'GROQ_API_KEY';
        else if (service === 'hf')   targetVar = 'HF_API_KEY';
        else if (service === 'xai')  targetVar = 'XAI_API_KEY';
        else {
            printToTerminal(`[ERR] Unknown service: ${service}`, 'sys-msg');
            return;
        }

        printToTerminal(`[SYS] Establishing secure uplink for ${targetVar}...`, 'sys-msg');
        fetch(`${API_BASE}/api/config/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: targetVar, val: keyVal })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) printToTerminal(`[OK] ${data.message}`, 'conn-ok');
            else printToTerminal(`[ERR] ${data.error}`, 'sys-msg');
        })
        .catch(e => printToTerminal(`[ERR] Uplink failed: ${e.message}`, 'sys-msg'));
        return;
    }

    if (lc === 'whoami')              {  runWhoami(); return; }
    if (lc === 'neofetch')            {  runNeofetch(); return; }
    if (lc === 'test link' || lc === 'test discord') {
        printToTerminal("[SYSTEM] Sending test signal to Discord master link...", "sys-msg");
        fetch(`${API_BASE}/api/tools/test_discord`)
            .then(r => r.json())
            .then(data => {
                if (data.ok) printToTerminal("[OK] Signal received by Discord uplink.", "conn-ok");
                else printToTerminal(`[ERR] Uplink failed: ${data.error}`, "sys-msg");
            })
            .catch(e => printToTerminal(`[ERR] Link failed: ${e.message}`, "sys-msg"));
        return;
    }
    if (lc === 'logs' || lc === 'log') {  showLogs(); return; }
    if (lc === 'leaderboard' || lc === 'rankings') {  showLeaderboard(); return; }
    if (lc === 'login' || lc === 'signin') {
        
        printToTerminal("[AUTH] Triggering Google Identity prompt...", "sys-msg");
        google.accounts.id.prompt();
        return;
    }
    if (lc.startsWith('name ')) {
        const newName = cmd.slice(5).trim().slice(0, 15);
        if (newName) {
            localStorage.setItem('nexus_user_name', newName);
            printToTerminal(`[SYS] Identity updated: ${newName}`, 'conn-ok');
        }
        return;
    }
    if (lc === 'scan image' || lc === 'scan') {
        if (!pendingImageB64) { printToTerminal('[ERR] No image loaded. Use  to attach an image first.', 'sys-msg'); return; }
        
        cmd = 'Describe and analyze this image in detail. What do you see?';
    }
    
    if (lc.startsWith('translate ')) {
        const text = cmd.slice(10).trim();
        if (!text) { printToTerminal('[ERR] Usage: translate <text>', 'sys-msg'); return; }
        printToTerminal(`[SYSTEM] Accessing Nexus Translation Link...`, 'sys-msg');
        prompt_ai_proxy(`Translate the following to multiple languages (Spanish, French, German, Chinese): ${text}`, null, 'education');
        return;
    }
    if (lc.startsWith('summarize ')) {
        const text = cmd.slice(10).trim();
        if (!text) { printToTerminal('[ERR] Usage: summarize <text>', 'sys-msg'); return; }
        printToTerminal(`[SYSTEM] Accessing Nexus Compression Link...`, 'sys-msg');
        prompt_ai_proxy(`Summarize this text concisely: ${text}`, null, 'education');
        return;
    }
    if (lc.startsWith('detect ')) {
        const text = cmd.slice(7).trim();
        if (!text) { printToTerminal('[ERR] Usage: detect <text>', 'sys-msg'); return; }
        printToTerminal(`[SYSTEM] Analyzing text via Nexus Neural Link...`, 'sys-msg');
        fetch(`${API_BASE}/api/tools/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                printToTerminal(`[ANALYSIS] Type: ${data.label.toUpperCase()} | Confidence: ${data.confidence}`, 'conn-ok');
            } else {
                printToTerminal(`[ERR] Analysis failed: ${data.error}`, 'sys-msg');
            }
        })
        .catch(e => printToTerminal(`[ERR] Link failed: ${e.message}`, 'sys-msg'));
        return;
    }
    if (lc.startsWith('fix ')) {
        const code = cmd.slice(4).trim();
        if (!code) { printToTerminal('[ERR] Usage: fix <code>', 'sys-msg'); return; }
        printToTerminal(`[SYSTEM] Repairing code via Nexus Debugger...`, 'sys-msg');
        fetch(`${API_BASE}/api/tools/fix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                printToTerminal(`[REPAIR] Fix Identified:`, 'conn-ok');
                printToTerminal(data.fixed_code, 'ai-msg');
            } else {
                printToTerminal(`[ERR] Repair failed: ${data.error}`, 'sys-msg');
            }
        })
        .catch(e => printToTerminal(`[ERR] Link failed: ${e.message}`, 'sys-msg'));
        return;
    }
    if (lc.startsWith('mood ')) {
        const text = cmd.slice(5).trim();
        if (!text) { printToTerminal('[ERR] Usage: mood <text>', 'sys-msg'); return; }
        printToTerminal(`[SYSTEM] Synchronizing neural feelings...`, 'sys-msg');
        fetch(`${API_BASE}/api/tools/mood`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                let icon = '';
                let color = '#4af';
                if (data.sentiment === 'Positive') { icon = ''; color = '#0f0'; }
                if (data.sentiment === 'Negative') { icon = ''; color = '#f55'; }
                
                printToTerminal(`[MOOD] Vibe Detected: ${data.sentiment.toUpperCase()} ${icon} | Confidence: ${data.confidence}`, 'conn-ok');
                
                // Visual Sync: Shift accent color briefly to match vibe
                document.documentElement.style.setProperty('--accent', color);
                setTimeout(() => setMode(currentMode), 3000); // revert to mode color after 3s
            } else {
                printToTerminal(`[ERR] Sync failed: ${data.error}`, 'sys-msg');
            }
        })
        .catch(e => printToTerminal(`[ERR] Link failed: ${e.message}`, 'sys-msg'));
        return;
    }
    if (lc.startsWith('speak ')) {
        const text = cmd.slice(6).trim();
        if (!text) { printToTerminal('[ERR] Usage: speak <text>', 'sys-msg'); return; }
        printToTerminal(`[SYSTEM] Synthesizing neural audio...`, 'sys-msg');
        fetch(`${API_BASE}/api/tools/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                const audio = new Audio(data.audio);
                audio.play();
                printToTerminal(`[VOICE] Transmission successful.`, 'conn-ok');
            } else {
                printToTerminal(`[ERR] Synthesis failed: ${data.error}`, 'sys-msg');
            }
        })
        .catch(e => printToTerminal(`[ERR] Link failed: ${e.message}`, 'sys-msg'));
        return;
    }

    if (lc === 'shadow')  {
        if (currentMode === 'shadow') { setMode('nexus'); return; }
        shadowAgeGate(() => setMode('shadow'));
        return;
    }
    if (lc === 'nexus') { setMode('nexus'); return; }
    if (lc === 'coder') { setMode('coder'); return; }
    if (lc === 'sage')  { setMode('sage');  return; }
    if (lc === 'education')  { setMode('education');  return; }

    if (lc === 'clear history') {
        
        localStorage.removeItem(HISTORY_KEYS[currentMode]);
        messageHistory = [];
        printToTerminal(`[SYS] ${currentMode.toUpperCase()} history wiped.`, 'sys-msg');
        return;
    }
    if (lc === 'clear') {
        output.innerHTML = '';
        messageHistory = [];
        return;
    }

    if (lc === 'play pong')           { startPong(); return; }
    if (lc === 'play snake')          { startSnake(); return; }
    if (lc === 'play wordle')         { startWordle(); return; }
    if (lc === 'play minesweeper')    { startMinesweeper(); return; }
    if (lc === 'play flappy')      { startFlappy(); return; }
    if (lc === 'play breakout')    { startBreakout(); return; }
    if (lc === 'play invaders' || lc === 'play space invaders') { startInvaders(); return; }

    if (lc === 'type test' || lc === 'typetest') { startTypingTest(); return; }
    if (lc === 'matrix')              { startMatrixSaver(); return; }
    if (lc === 'monitor')             { startMonitor(); return; }

    // Text-to-speech  silent: just speak, no terminal output
    if (lc.startsWith('speak ') || lc.startsWith('say ')) {
        const spaceIdx = cmd.indexOf(' ');
        const spokenText = cmd.slice(spaceIdx + 1).trim();
        if ('speechSynthesis' in window && spokenText) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(spokenText);
            utt.rate = 0.92; utt.pitch = 1;
            const savedVoice = localStorage.getItem('nexus_tts_voice');
            const voices = window.speechSynthesis.getVoices();
            if (savedVoice && voices.length) {
                const v = voices.find(vx => vx.name === savedVoice);
                if (v) utt.voice = v;
            } else if (voices.length) {
                utt.voice = _pickBestVoice(voices);
            }
            window.speechSynthesis.speak(utt);
        }
        return;
    }

    // Accessibility panel
    if (lc === 'access' || lc === 'accessibility') {
        
        toggleA11yPanel();
        return;
    }

    if (isCreatorQuestion(cmd)) { 
        
        showCreatorResponse(); 
        return; 
    }
    if (isContactQuestion(cmd))  { 
        
        showContactResponse();  
        return; 
    }

    // Image generation works in ALL modes  intercept before routing to AI
    const genMatch = cmd.match(/^(?:generate|imagine|draw|create image of|make image of|image|vintage)\s+(.+)/i);
    if (genMatch) {
        
        const isVintage = /^vintage\s/i.test(cmd);
        generateImage(isVintage ? cmd.trim() : genMatch[1].trim());
        return;
    }

    const imgSnap = pendingImageB64;

    // img2img: transform attached image with a new prompt
    if (imgSnap && (lc.startsWith('transform ') || lc.startsWith('restyle ') || lc.startsWith('remix '))) {
        
        const transformPrompt = cmd.slice(cmd.indexOf(' ') + 1).trim();
        pendingImageB64 = null;
        generateImageFromImage(imgSnap, transformPrompt);
        return;
    }

    pendingImageB64 = null;
    logPrompt(cmd, imgSnap);

    // AI DISPATCH: Custom Cloudflare Uplink (Master Pacific Link)
    // Satisfying request: "use that specific thing for everything"
    prompt_ai_proxy(cmd, imgSnap, currentMode, '');
}

// =============================================================
//  QUICK ACTION BUTTONS
// =============================================================

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (!cmd) return;
        const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
        const promptLabel = document.getElementById('prompt-label')?.textContent || (nexusUser?.name ? `${nexusUser.name.toLowerCase()}@nexus:~$` : 'guest@nexus:~$');
        
        // PACIFIC UI: Clean single-print execution
        handleCommand(cmd);
        input.focus();
    });
});

// =============================================================
//  UTILITIES
// =============================================================
function printToTerminal(text, className = 'sys-msg') {
    // Fail-safe initialization
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return; // Still not found? Silently fail to prevent crash.

    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

function showThinking(cmd) {
    if (!output) output = document.getElementById('terminal-output');
    if (!output) return;

    document.getElementById('ai-thinking')?.remove(); // clear any stale one first
    clearTimeout(_thinkTimeout);
    _thinkFallbackCmd = cmd || null;

    const col = MODE_COLORS[currentMode] || '#4af';
    const label = (currentMode === 'shadow' ? 'SHADOW' : currentMode === 'coder' ? 'CODER' : currentMode === 'sage' ? 'SAGE' : 'NEXUS');
    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.style.margin = '6px 0';
    p.innerHTML = `
        <span class="nexus-thinking-bar" style="color:${col};">
            <span class="nexus-spinner"></span>
            <span class="bar-dot"></span>
            <span class="bar-dot"></span>
            <span class="bar-dot"></span>
            <span style="font-size:0.72rem;letter-spacing:2px;margin-left:4px;opacity:0.8;">${label} thinking</span>
        </span>`;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;

    // After 18s with no WS response, fall back to CF Worker (Groq) with mode system prompt.
    // This makes NEXUS/CODER/SAGE resilient to Render.com cold starts or Gemini hangs.
    _thinkTimeout = setTimeout(() => {
        document.getElementById('ai-thinking')?.remove();
        _thinkTimeout = null;
        const fallback = _thinkFallbackCmd;
        _thinkFallbackCmd = null;
        if (fallback && currentMode !== 'shadow') {
            // WS timed out  retry instantly via CF Worker (no "routing via..." noise)
            askPacific(fallback, null, MODE_SYSTEMS[currentMode] || MODE_SYSTEMS.nexus, 'ai-msg');
        } else if (fallback && currentMode === 'shadow') {
            askPacific(fallback, null);
        }
    }, 18000);
}

// Log AI responses to Discord so full conversations are visible in logs
function _logAIResponse(responseText) {
    if (!responseText || responseText.length < 3) return;
    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    
    const embed = {
        title: ` Nexus Reply to ${user.name}`,
        color: 0xff00ff,
        description: `\`\`\`\n${responseText.slice(0, 1500)}\n\`\`\``,
        timestamp: new Date().toISOString()
    };
    
    postToDiscord({ embeds: [embed] }, discordThreadId || null);
}

function jsonPayload(cmd) {
    const history = (messageHistory || []).slice(-10);
    const payload = { command: cmd, history: history, mode: currentMode, context: XAVIER_BIO };
    if (pendingImageB64) {
        payload.image = pendingImageB64;
        pendingImageB64 = null; // consume  sent once
    }
    return JSON.stringify(payload);
}

let statsWs;
function connectStats() {
    if (statsWs) { statsWs.onclose = null; statsWs.close(); }
    statsWs = new WebSocket(STATS_URL);
    statsWs.onmessage = (e) => {
        try {
            const d = JSON.parse(e.data);
            if (cpuStat) cpuStat.textContent = d.cpu.toFixed(1) + '%';
            if (memStat) memStat.textContent = d.mem.toFixed(1) + '%';
        } catch (_) {}
    };
    statsWs.onclose = () => setTimeout(connectStats, 5000);
}

function updateClientStats() {
    if (statsWs && statsWs.readyState === WebSocket.OPEN) return;
    if (!cpuStat) cpuStat = document.getElementById('cpu-stat');
    if (!memStat) memStat = document.getElementById('mem-stat');
    if (cpuStat) cpuStat.textContent = (navigator.hardwareConcurrency || '--') + ' Cores';
    if (memStat) memStat.textContent  = (navigator.deviceMemory || '--') + ' GB';
}

// =============================================================
//  IMAGE VIEWER + AI SCAN
// =============================================================
let pendingImageB64 = null; // set when an image is loaded, cleared after sending

function openImageViewer(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        pendingImageB64 = ev.target.result;
        const b64 = pendingImageB64;

        //  Inline terminal thumbnail 
        const p = document.createElement('p');
        p.className = 'sys-msg';
        p.innerHTML = ` <b style="color:#0ff">${file.name}</b> <span style="color:#444">(${(file.size/1024).toFixed(1)} KB)</span><br>
            <img src="${b64}"
                 style="max-height:72px;max-width:180px;border:1px solid #0ff;border-radius:3px;margin-top:5px;display:block;cursor:pointer;"
                 title="Click to expand"
                 onclick="nexusExpandImg('${b64}')">
            <span style="font-size:0.7rem;color:#555;">Ask a question or type <b style="color:#0ff;">scan image</b> to analyze</span>`;
        output.appendChild(p);
        output.scrollTop = output.scrollHeight;

        // No GUI popup  stays in chat. Click thumbnail to expand.
        input.focus();
    };
    reader.readAsDataURL(file);
}

// Expand image full-size in GUI when thumbnail clicked
window.nexusExpandImg = function(src) {
    stopAllGames();
    guiTitle.textContent = 'IMAGE VIEWER';
    guiContent.innerHTML = `<div style="text-align:center;"><img src="${src}" style="max-width:100%;border:2px solid #0ff;border-radius:4px;display:block;margin:0 auto;"></div>`;
    nexusCanvas.style.display = 'none';
    guiContainer.classList.remove('gui-hidden');
};

const imgInp = document.getElementById('img-input');
if (imgInp) {
    imgInp.addEventListener('change', (e) => {
        if (e.target.files[0]) openImageViewer(e.target.files[0]);
        e.target.value = '';
    });
}

// =============================================================
//  MOBILE: hide sidebar when keyboard is open
// =============================================================
const quickActions = document.querySelector('.quick-actions');
if (input && quickActions) {
    input.addEventListener('focus', () => {
        if (window.innerWidth <= 700) quickActions.classList.add('kb-hidden');
    });
    input.addEventListener('blur', () => {
        quickActions.classList.remove('kb-hidden');
    });
}

// =============================================================
//  INIT
// =============================================================
// Restore saved mode (UI only  no message, no flash)
if (currentMode !== 'nexus') {
    const m = MODES[currentMode];
    if (m) {
        const promptEl  = document.getElementById('prompt-label');
        const titleEl   = document.getElementById('status-title');
        const modeIndEl = document.getElementById('mode-indicator');
        if (promptEl)  promptEl.textContent  = m.prompt;
        if (titleEl)   titleEl.textContent   = m.title;
        if (modeIndEl) modeIndEl.textContent = m.label;
        if (m.color) {
            document.documentElement.style.setProperty('--accent', m.color);
            document.documentElement.style.setProperty('--txt-color', m.color);
        }
        document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === currentMode);
        });
    }
}
// Restore current mode's history into memory
const _savedHistory = loadHistory(currentMode);
if (_savedHistory.length) {
    messageHistory = _savedHistory;
    setTimeout(() => {
        const col = MODE_COLORS[currentMode] || '#0ff';
        printToTerminal(`[SYS] ${_savedHistory.length} ${currentMode.toUpperCase()} messages from last session  type <b style="color:${col}">history</b> to view all modes.`, 'sys-msg');
    }, 2000);
}

// =============================================================

function toggleA11yPanel() {
    const panel = document.getElementById('a11y-panel');
    if (panel) {
        panel.classList.toggle('a11y-panel-open');
        if (panel.classList.contains('a11y-panel-open')) {
            const sel = panel.querySelector('#a11y-voice-sel');
            if (sel) _buildVoiceOptions(sel);
        }
        return;
    }

    const el = document.createElement('div');
    el.id = 'a11y-panel';
    el.className = 'a11y-panel a11y-panel-open';
    el.innerHTML = `
        <div class="a11y-panel-header">
            <span>[ ACCESSIBILITY ]</span>
            <button onclick="document.getElementById('a11y-panel').classList.remove('a11y-panel-open')" class="a11y-close">X</button>
        </div>

        <div class="a11y-section-label">VISUALS</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="crt-mode" onclick="toggleA11yClass('crt-mode')">CRT Mode</button>
            <button class="a11y-toggle" id="sound-toggle" onclick="toggleSound()">Sound Effects</button>
        </div>

        <div class="a11y-section-label">TEXT SIZE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-large" onclick="toggleA11yClass('a11y-large')">Large</button>
            <button class="a11y-toggle" data-class="a11y-xl"    onclick="toggleA11yClass('a11y-xl')">Extra Large</button>
        </div>

        <div class="a11y-section-label">TEXT STYLE</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-bold"         onclick="toggleA11yClass('a11y-bold')">Bold</button>
            <button class="a11y-toggle" data-class="a11y-wide-spacing" onclick="toggleA11yClass('a11y-wide-spacing')">Wide Spacing</button>
        </div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-dyslexic" onclick="toggleA11yClass('a11y-dyslexic')">Dyslexia Font</button>
        </div>

        <div class="a11y-section-label">DISPLAY</div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-high-contrast" onclick="toggleA11yClass('a11y-high-contrast')">High Contrast</button>
            <button class="a11y-toggle" data-class="a11y-dim"           onclick="toggleA11yClass('a11y-dim')">Dim Mode</button>
        </div>
        <div class="a11y-row">
            <button class="a11y-toggle" data-class="a11y-reduce-motion" onclick="toggleA11yClass('a11y-reduce-motion')">Less Motion</button>
        </div>

        <div class="a11y-section-label">VOICE (speak command)</div>
        <select id="a11y-voice-sel" class="a11y-voice-sel">
            <option value="">Loading voices...</option>
        </select>

        <div class="a11y-tip">All settings saved automatically.</div>
    `;
    document.querySelector('.glass-panel').appendChild(el);
    _a11ySyncButtons();

    // Populate voice picker — voices load async in Chrome
    const sel = el.querySelector('#a11y-voice-sel');
    const doPopulate = () => _buildVoiceOptions(sel);
    if (window.speechSynthesis.getVoices().length) {
        doPopulate();
    } else {
        window.speechSynthesis.addEventListener('voiceschanged', doPopulate, { once: true });
    }

    sel.addEventListener('change', () => {
        if (sel.value) localStorage.setItem('nexus_tts_voice', sel.value);
        else           localStorage.removeItem('nexus_tts_voice');
    });
}

// =============================================================
// =============================================================
//  RESTORE & BOOT
// =============================================================


// --- MODULE: BOOT SEQUENCE ---
window.onload = async () => {
    try {
        cpuStat      = document.getElementById("cpu-stat");
        memStat      = document.getElementById("mem-stat");
        output       = document.getElementById("terminal-output");
        input        = document.getElementById("terminal-input");
        guiContainer = document.getElementById("game-gui-container");
        guiContent   = document.getElementById("gui-content");
        guiTitle     = document.getElementById("gui-title");
        nexusCanvas  = document.getElementById("nexus-canvas");

        let isBackendOnline = false;
        const startWake = Date.now();
        const MAX_WAKE_TIME = 30000; // Pacific Patience: 30 seconds

        console.log("[BOOT] Initializing Neural Uplink...");
        
        // Add SYNCING NEURAL LINK... bar
        const syncOverlay = document.createElement('div');
        syncOverlay.id = 'sync-neural-link-overlay';
        syncOverlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(5,5,10,0.95);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Fira Code',monospace;";
        syncOverlay.innerHTML = `
            <div style="color:#0ff;font-size:1.2rem;letter-spacing:2px;margin-bottom:15px;text-shadow:0 0 10px #0ff;">SYNCING NEURAL LINK...</div>
            <div style="width:300px;height:4px;background:#111;border-radius:2px;overflow:hidden;box-shadow:0 0 5px rgba(0,255,255,0.2);">
                <div id="sync-progress-bar" style="width:0%;height:100%;background:#0ff;box-shadow:0 0 10px #0ff;transition:width 1s linear;"></div>
            </div>
            <div id="sync-time-text" style="color:#555;font-size:0.75rem;margin-top:10px;">0 / 30s</div>
        `;
        document.body.appendChild(syncOverlay);
        
        while (Date.now() - startWake < MAX_WAKE_TIME) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const pingRes = await fetch(`${API_BASE}/ping`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (pingRes.ok) { isBackendOnline = true; break; }
            } catch (e) {}
            
            const elapsed = Math.round((Date.now() - startWake) / 1000);
            const pct = Math.min(100, (elapsed / 30) * 100);
            const bar = document.getElementById('sync-progress-bar');
            const txt = document.getElementById('sync-time-text');
            if (bar) bar.style.width = pct + '%';
            if (txt) txt.textContent = elapsed + ' / 30s';
            
            // Pulse loading state if terminal revealed or in console
            console.log(`[BOOT] Syncing... ${elapsed}s`);
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // Remove overlay
        if (syncOverlay.parentNode) syncOverlay.parentNode.removeChild(syncOverlay);

        window.setNexusState('BOOT');
        if (!isBackendOnline) {
            const maint = document.createElement("div");
            maint.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,15,0.98);color:#f55;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Fira Code',monospace;text-align:center;padding:20px;";
            maint.innerHTML = `
                <div style="width:12px;height:12px;background:#f55;border-radius:50%;margin-bottom:15px;box-shadow:0 0 10px #f55;animation:pulse 2s infinite;"></div>
                <h1 style="color:#fff;font-size:1.5rem;letter-spacing:2px;margin:0 0 10px 0;">SYSTEM OFFLINE</h1>
                <p style="color:#aaa;max-width:400px;line-height:1.6;font-size:0.85rem;">The Nexus Core is currently undergoing maintenance. Neural uplinks are severed.</p>
                <button onclick="location.reload()" style="margin-top:20px;background:none;border:1px solid #555;color:#888;padding:8px 16px;cursor:pointer;font-family:monospace;transition:0.2s;">[ INITIATE PING REFRESH ]</button>
            `;
            document.body.appendChild(maint);
            return; 
        }

        let authedName = null;
        try {
            const meRes = await fetch(`${API_BASE}/api/me`);
            const meData = await meRes.json();
            if (meData.authenticated) authedName = meData.name;
        } catch(e) {}

        if (!authedName) {
            const nexusUser = JSON.parse(localStorage.getItem("nexus_user_data") || "null");
            if (nexusUser && nexusUser.name) authedName = nexusUser.name;
        }

        messageHistory = loadHistory(currentMode);
        initGoogleAuth();

        if (authedName) {
            revealTerminal(authedName);
        } else {
            console.log("[NEXUS] Awaiting Authorization...");
        }
        console.log(`[NEXUS] Boot sequence complete in ${Date.now() - window.NEXUS_BOOT_START}ms`);
    } catch (e) {
        console.error("[CRITICAL] Boot sequence failed:", e);
    }
}
