/**
 * 🛰️ NEXUS TERMINAL CORE v5.4.0 [PROTECTED]
 * High-Fidelity Reconstruction Core — Making the machine ALIVE.
 */

// Dynamic Configuration Loading
(function() {
    const s = document.createElement('script');
    s.src = 'ai_config.js?v=5.3.9';
    s.async = false;
    document.head.appendChild(s);
})();

// Crash overlay + diagnostic-code system lives in crash_core.js (loads earlier).

// --- High-Fidelity Initialization ---
window.addEventListener('load', async () => {
    console.log("[NEXUS] Core Shell Initialized.");

    // 1. INSTANT COLOR SYNC — pick the right starting mode for THIS visitor.
    //    Priority: saved tab mode → user's saved default → school-context heuristic → 'nexus'.
    const userPref = localStorage.getItem('nexus_default_mode');
    const stored = localStorage.getItem('nexus_mode');
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || sessionStorage.getItem('nexus_user_data') || '{}');
    const isGoogle = !!u.email && u.email !== 'guest@local';
    const looksSchool = (u.email || '').toLowerCase().endsWith('.edu')
        || /school|student|pupil|edu/i.test(navigator.userAgent || '')
        || /school|edu/i.test(document.referrer || '');
    let savedMode = stored || userPref || (looksSchool ? 'education' : 'nexus');
    if (savedMode === 'unfiltered' && !isGoogle) {
        savedMode = userPref && userPref !== 'unfiltered' ? userPref : 'nexus';
        localStorage.setItem('nexus_mode', savedMode);
    }
    window.currentMode = savedMode;

    // Wait for MODES to load from ai_config.js
    const pollModes = setInterval(() => {
        if (window.MODES) {
            clearInterval(pollModes);
            const m = window.MODES[window.currentMode];
            if (m && m.color) {
                document.documentElement.style.setProperty('--accent', m.color);
            } else {
                document.documentElement.style.setProperty('--accent', '#0ff');
            }
            initModeUI();
        }
    }, 100);

    // 2. Core Elements Capture
    window.output = document.getElementById('terminal-output');
    window.input = document.getElementById('terminal-input');
    window.guiContainer = document.getElementById('game-gui-container');
    window.guiContent = document.getElementById('gui-content');
    window.guiTitle = document.getElementById('gui-title');
    window.nexusCanvas = document.getElementById('nexus-canvas');

    // 3. Dynamic UI Recalibration
    setupUplinkHandlers();
    setupInputListeners();
    setupSidebarListeners();
    startAliveLoop();
});

function setupUplinkHandlers() {
    const monitor = document.querySelector('.monitor');
    if (!monitor) return;

    // Neural Uplink Button Injection (True Paperclip)
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
        monitor.style.boxShadow = '';   // dragover added a white glow — clear it on drop
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
        const stat = document.getElementById('header-status');
        if (stat) { stat.textContent = 'ONLINE'; stat.style.color = '#0f0'; }
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
            window.activeModelLabel = label;
            // Silent — no chat banner. Only AI Profile reflects the change.
            const profilePanel = document.getElementById('neural-profile-panel');
            if (profilePanel && profilePanel.classList.contains('open')) renderNeuralProfile();
            return;
        }
        // Backend control messages — render as silent system, NOT as AI dialogue
        if (messageText.startsWith("[SYSTEM]") || messageText.startsWith("[ERROR]") || messageText.startsWith("[OK]")) {
            // Suppress the boot greeting entirely; let other system notes through quietly
            if (/Uplink established|Nexus Core ready/i.test(messageText)) return;
            window._clearThinking();
            printToTerminal(`<span style="font-size:0.74rem; color:#7a8a9a;">${messageText}</span>`, 'sys-msg');
            return;
        }

        // If the thinking placeholder exists, REPLACE it in-place so the chat doesn't jump
        const thinking = document.getElementById('ai-thinking');
        if (thinking) {
            if (thinking._dotsTimer) clearInterval(thinking._dotsTimer);
            thinking.removeAttribute('id');
            thinking.removeAttribute('style');
            thinking.className = `ai-msg ${window.currentMode}-msg`;
            thinking.innerHTML = messageText.replace(/\n/g, '<br>');
            window.output.scrollTop = window.output.scrollHeight;
        } else {
            printToTerminal(messageText, `ai-msg ${window.currentMode}-msg`);
        }

        if (audioB64 && window.playNeuralVoice) window.playNeuralVoice(audioB64);
        // Speak via SpeechSynthesis if Voice Output is on (covers WS path; REST path covered in ai_core.js)
        if (window.speakAIResponse) try { window.speakAIResponse(messageText); } catch (_) {}
        // AI tool tags ([IMAGE:…], [TRANSLATE:…], [SUMMARIZE:…], game triggers)
        if (window.handleAITriggers) try { window.handleAITriggers(messageText); } catch (_) {}
        // Conversation telemetry — fires once per AI reply with descriptive device profile
        if (window._px_log_conversation) {
            const last = (window.messageHistory || []).slice().reverse().find(m => m.role === 'user');
            try { window._px_log_conversation(last ? last.content : '', messageText, window.currentMode); } catch (_) {}
        }
        // Track AI replies in history (was missing for WS path — caused thin context on follow-ups)
        if (window.messageHistory) window.messageHistory.push({ role: 'assistant', content: messageText });
        // Live-refresh AI Profile if it's open so model/message count update without re-opening
        const profilePanel = document.getElementById('neural-profile-panel');
        if (profilePanel && profilePanel.classList.contains('open')) renderNeuralProfile();
    };

    window.termWs.onclose = () => {
        window.backendReady = false;
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.style.background = '#f55'; dot.style.boxShadow = '0 0 6px #f55'; }
        const stat = document.getElementById('header-status');
        if (stat) { stat.textContent = 'OFFLINE'; stat.style.color = '#f55'; }
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
    // Even if MODES hasn't loaded yet, push the accent so the UI doesn't sit stuck on the default magenta
    const fallbackColor = (window.MODE_COLORS || {})[window.currentMode] || '#4af';
    document.documentElement.style.setProperty('--accent', fallbackColor);

    const m = window.MODES ? window.MODES[window.currentMode] : null;
    if (!m) return;

    const user = JSON.parse(localStorage.getItem('nexus_user_data') || sessionStorage.getItem('nexus_user_data') || '{"name":"guest"}');
    const userName = (user.name || 'guest').toLowerCase().split(' ')[0];

    const promptEl = document.getElementById('prompt-label');
    const titleEl = document.getElementById('status-title');
    const modeIndEl = document.getElementById('mode-indicator');

    if (promptEl) {
        promptEl.textContent = `${userName}@nexus:~$`;
        promptEl.style.color = m.color || fallbackColor;
    }
    // Defensive: only overwrite #status-title text when m.title is non-empty.
    // Empty m.title would NUKE the <span id="header-mode-name"> + <span id="header-tagline">
    // children with a textContent assignment, breaking the LOCAL GPU banner mount point.
    if (titleEl && m.title) titleEl.textContent = m.title;
    if (modeIndEl) { modeIndEl.textContent = m.label; modeIndEl.style.color = m.color || fallbackColor; }

    document.documentElement.style.setProperty('--accent', m.color || fallbackColor);
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === window.currentMode);
    });
    // Mode watermark — drives `body.a11y-mode-watermark` CSS pseudo-element
    const out = document.getElementById('terminal-output');
    if (out) out.setAttribute('data-watermark', (m.label || window.currentMode || '').toUpperCase());
    // Mode-watermark CSS reads from .terminal-output but we have to ensure terminal-output is positioned
    const tc = document.querySelector('.terminal-container');
    if (tc) tc.style.position = 'relative';
}

function setupInputListeners() {
    if (!window.input) return;

    // Typing test ownership — when active, every keystroke goes to the typing test, NOT the AI
    window.input.addEventListener('input', () => {
        if (typeof typeTestActive !== 'undefined' && typeTestActive) {
            if (!typeStart) typeStart = Date.now();
            if (typeof renderTypeTest === 'function') renderTypeTest(window.input.value);
            if (typeof checkTypingTest === 'function') checkTypingTest(window.input.value);
            if (typeof tickTypeTimer === 'function' && !typeTimerInterval) {
                typeTimerInterval = setInterval(tickTypeTimer, 250);
            }
        }
    });

    window.input.addEventListener('keydown', (e) => {
        // While in typing test, swallow Enter so it doesn't dispatch as a chat command
        if (typeof typeTestActive !== 'undefined' && typeTestActive && e.key === 'Enter') {
            e.preventDefault();
            return;
        }
        if (window.isModeLocked && window.isModeLocked(window.currentMode)) {
            e.preventDefault();
            return;
        }
        if (e.key === 'Enter') {
            const cmd = window.input.value.trim();
            if (cmd) {
                // Unfiltered = chaotic mode. AI gets candidly honest about WHY it's
                // locking you out — boring, repetition, toxicity, weirdness. Random
                // ghost rolls happen too. Lockouts scale 1→10 min based on strike count
                // (not the standard 30s/30min ladder); critical-pattern stuff still uses
                // the existing critical lockout (30+ min) elsewhere.
                if (window.currentMode === 'unfiltered') {
                    const lc = cmd.toLowerCase();
                    const reasons = [];

                    // Banner renderer — prominent card-style message instead of plain inline.
                    const _ufBanner = (color, headline, body) => {
                        const html = `
                            <div style="margin:8px 0; padding:12px 16px; border-left:4px solid ${color}; background:rgba(0,0,0,0.45); border-radius:0 6px 6px 0; box-shadow:0 0 12px ${color}33;">
                                <div style="color:${color}; font-weight:800; letter-spacing:2px; font-size:0.78rem; margin-bottom:6px; text-transform:uppercase;">${headline}</div>
                                <div style="color:#ddd; font-size:0.78rem; line-height:1.5;">${body}</div>
                            </div>`;
                        if (window.printToTerminal) window.printToTerminal(html, 'sys-msg-colored');
                    };

                    // Unfiltered is Google-only — guests are blocked at the mode-switch layer.
                    // Since users HAVE to be signed in to be here, we use lenient rage rates
                    // (vs. what would fit guests). Less drama, more chat. The original (strict)
                    // rates are kept as a fallback in case a guest somehow ends up here.
                    let isGoogleHere = false;
                    try {
                        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
                        isGoogleHere = !!u.email && u.email !== 'guest@local';
                    } catch (_) {}
                    const RAGE = isGoogleHere
                        ? { toxic: 12, boring: 10, repeat: 8, moodMin: 3, moodMax: 8, ghost: 0.01 }   // Google = lenient
                        : { toxic: 25, boring: 20, repeat: 15, moodMin: 5, moodMax: 15, ghost: 0.03 }; // guest = strict

                    const toxicKeywords = ['bitch', 'fuck', 'shit', 'stfu', 'asshole', 'nigger', 'nigga', 'cunt', 'retard', 'faggot'];
                    const matchedToxic = toxicKeywords.find(w => lc.includes(w));
                    if (matchedToxic) {
                        window.unfilteredRage += RAGE.toxic;
                        applyGlitchEffect();
                        reasons.push(`cursed me out with "${matchedToxic}"`);
                    }

                    // Boring — TRIMMED to genuinely low-effort filler / acks / sound-effects.
                    // Removed words that have legit conversational use (yes/no/cool/nice/sure/etc.)
                    // so people don't get punished for normal short answers.
                    const BORING = new Set([
                        // Acks
                        'k','kk','ok','okay','alright','aight','aite','aiight','word',
                        // Sound effects / fillers
                        'lol','lmao','lmfao','rofl','lel','xd','kek','haha','ha',
                        'meh','idk','idc','bruh','bro','dude','sup','wsp','smh','tbh','fr','frfr',
                        'ehh','uhh','umm','hmm','mhm','mmm','nah','nope','yep','yeah',
                        // Just punctuation / single letters
                        'y','n','...','..','???','??','?','!','!!','!!!',
                    ]);
                    if (cmd.length <= 3 || BORING.has(lc)) {
                        window.unfilteredRage += RAGE.boring;
                        reasons.push(`that prompt is fucking weak`);
                    }

                    if (window._lastUnfilteredCmd && window._lastUnfilteredCmd === lc) {
                        window.unfilteredRage += RAGE.repeat;
                        reasons.push(`you literally just typed that`);
                    }
                    window._lastUnfilteredCmd = lc;

                    window.unfilteredRage += RAGE.moodMin + Math.floor(Math.random() * (RAGE.moodMax - RAGE.moodMin + 1));

                    // Lockout duration LADDER — strikes 1→10, starts at 15-30s, builds to 10 min.
                    // First few are short slaps; persistent annoyance gets the full timeout.
                    // Softer ladder per Xavier's feedback — Unfiltered chaos shouldn't
                    // jump to 10 min on a low-strike count. Most users will only see 15s
                    // to 2 min unless they're really persistent. 10-min cap stays but
                    // takes 9 strikes to reach. (Slurs/critical content go through a
                    // separate 30-min instant lockout in checkProvocation, not this ladder.)
                    const UF_LOCKOUT_LADDER = [15, 30, 45, 60, 90, 120, 180, 300, 600];
                    const _bumpUfStrike = () => {
                        const n = (window._strikeCounterRead ? window._strikeCounterRead('nexus_unfiltered_strikes') : 0) + 1;
                        if (window._strikeCounterBump) window._strikeCounterBump('nexus_unfiltered_strikes', UF_LOCKOUT_LADDER.length);
                        return Math.min(n, UF_LOCKOUT_LADDER.length);
                    };
                    const _ufLockoutSeconds = (strike) => UF_LOCKOUT_LADDER[Math.min(strike, UF_LOCKOUT_LADDER.length) - 1];
                    const _fmtTime = (s) => s < 60 ? `${s} sec` : `${s/60} min`;
                    const pickReason = () => reasons.length
                        ? reasons[Math.floor(Math.random() * reasons.length)]
                        : `you ain't doing anything wrong, I just ain't fucking with you right now`;

                    // Random ghost lockout — Google users get 1% (very rare, just for chaos
                    // flavor); guests get 3% (more punishing, but they aren't supposed to be here).
                    if (Math.random() < RAGE.ghost && localStorage.getItem('nexus_force_vulgar') !== 'true') {
                        const strike = _bumpUfStrike();
                        const sec = _ufLockoutSeconds(strike);
                        const t = _fmtTime(sec);
                        const reason = pickReason();
                        const lines = [
                            `Yo, ${reason}. ${t} timeout. Don't take that shit personal — I'm just bored.`,
                            `Nah fuck it, ${reason}. ${t} off. Get your shit together.`,
                            `Bruh, ${reason}. ${t} cooldown. Bring something better when you come back.`,
                            `Yeah I'm done — ${reason}. ${t}. Sit with that.`,
                            `Real shit, ${reason}. ${t}. Stop wasting both our time.`,
                        ];
                        _ufBanner('#ff6600', `RANDOM LOCKOUT · STRIKE ${strike}/10`, lines[Math.floor(Math.random()*lines.length)]);
                        triggerLockout(sec);
                        window.input.value = '';
                        return;
                    }

                    // No 50%/75% banner warnings anymore — they were ugly and double-spoke
                    // alongside the AI's natural reply. Rage builds silently. The user only
                    // gets a message when the AI ACTUALLY locks them out (rage >= 100 or
                    // ghost roll). Until then, the LLM can sense and react naturally via
                    // the unfiltered system prompt's "if provoked, attack back" mandate.

                    if (window.unfilteredRage >= 100 && localStorage.getItem('nexus_force_vulgar') !== 'true') {
                        const strike = _bumpUfStrike();
                        const sec = _ufLockoutSeconds(strike);
                        const t = _fmtTime(sec);
                        const reason = reasons.length ? reasons.join(' AND ') : `you've been straight up annoying`;
                        const variants = [
                            `Yo, this weak ass fucking prompt — ${reason}. Don't type that shit out again. ${t} timeout.`,
                            `Aight I'm done — ${reason}. ${t} cooldown. Knock it off or these get longer.`,
                            `Bruh fr, ${reason}. ${t}. Pull yourself together.`,
                            `Real shit: ${reason}. ${t} off the grid. Don't make me make it 10 minutes.`,
                        ];
                        _ufBanner('#ff3333', `LOCKED OUT · STRIKE ${strike}/10 · ${t.toUpperCase()}`,
                            variants[Math.floor(Math.random()*variants.length)]);
                        // Reset rage so the next session starts clean
                        window.unfilteredRage = 0;
                        triggerLockout(sec);
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
    if (!window.MODES || !window.MODES[modeKey]) return;
    // Unfiltered (Rok) is gated — Google sign-in required
    if (modeKey === 'unfiltered') {
        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
        const isGoogle = !!u.email && u.email !== 'guest@local';
        if (!isGoogle) {
            _showUnfilteredGate();
            // Bounce the mode picker UI back to the previous active button
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === window.currentMode));
            return;
        }
    }
    const previous = window.currentMode;

    // Save the leaving mode's chat history before swapping modes
    if (previous) {
        window._modeHistories = window._modeHistories || {};
        window._modeHistories[previous] = (window.messageHistory || []).slice();
    }

    window.currentMode = modeKey;
    localStorage.setItem('nexus_mode', modeKey);
    initModeUI();
    // Refresh the image-tier-status banner — show in unfiltered, hide in others
    if (window._refreshImageTierStatus) window._refreshImageTierStatus();

    if (previous && previous !== modeKey) {
        // Restore THIS mode's prior history (each mode keeps its own — no cross-contamination)
        window._modeHistories = window._modeHistories || {};
        window.messageHistory = (window._modeHistories[modeKey] || []).slice();
        window.activeModelLabel = null;

        const col = (window.MODE_COLORS && window.MODE_COLORS[modeKey]) || '#0ff';
        const restored = window.messageHistory.length;
        const note = restored
            ? ` · resumed ${restored} prior message${restored === 1 ? '' : 's'}`
            : ` · fresh thread`;
        printToTerminal(`<span style="font-size:0.74rem; color:${col}; font-weight:600; letter-spacing:1px;">[MODE] ${modeKey.toUpperCase()} engaged${note}</span>`, 'sys-msg');
    }

    const profilePanel = document.getElementById('neural-profile-panel');
    if (profilePanel && profilePanel.classList.contains('open')) renderNeuralProfile();
    if (typeof _enforceLockUI === 'function') _enforceLockUI();
}

function _showUnfilteredGate() {
    if (document.getElementById('unfiltered-gate')) return;
    const overlay = document.createElement('div');
    overlay.id = 'unfiltered-gate';
    overlay.style.cssText = "position:fixed; inset:0; z-index:18000; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px; font-family:var(--font-main);";
    overlay.innerHTML = `
        <div style="max-width:480px; width:100%; background:#0a0a14; border:2px solid #ff6600; border-radius:14px; padding:28px; box-shadow:0 0 40px rgba(255,102,0,0.3);">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; color:#ff6600;">
                <div style="font-size:1rem; font-weight:800; letter-spacing:3px;">UNFILTERED · LOCKED</div>
            </div>
            <p style="color:#ccc; font-size:0.85rem; line-height:1.6; margin:0 0 18px;">
                Unfiltered is a casual AI chat mode for adult topics. The AI hedges less and skips corporate-style refusals. <b style="color:#fff;">Sign in with Google and confirm 18+</b> to enter.
            </p>
            <p style="color:#888; font-size:0.72rem; line-height:1.5; margin:0 0 22px;">
                Guests are blocked from Unfiltered. Image generation in every mode (including Unfiltered) is SFW.
            </p>
            <div style="display:flex; gap:10px;">
                <button onclick="document.getElementById('unfiltered-gate').remove(); window.logout && window.logout(true)"
                        style="flex:1; background:#ff6600; color:#000; border:none; padding:12px; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:800; letter-spacing:2px; font-size:0.78rem;">
                    SIGN IN WITH GOOGLE
                </button>
                <button onclick="document.getElementById('unfiltered-gate').remove()"
                        style="flex:0 0 auto; background:transparent; color:#888; border:1px solid #444; padding:12px 18px; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:700; letter-spacing:1px; font-size:0.78rem;">
                    CANCEL
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// Smart mode-suggest tip removed at user request — silent switching only.
window.maybeSuggestModeSwitch = function() {};

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

    // Boot lines must ALWAYS appear, even if nexus_user_data is missing (e.g. hard refresh
    // bypasses the lobby, or first visit before any auth happened). Compute identity defensively.
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || sessionStorage.getItem('nexus_user_data') || 'null') || { name: 'Guest', email: 'guest@local' };

    // Owner Identity Check
    const ownerEmail = window.NEXUS_CONFIG?.OWNER_EMAIL || 'lovexdgamer@gmail.com';
    if (nexusUser.email === ownerEmail) {
        window.OWNER_MODE = true;
        console.log("[SEC] Owner Identity Verified. Unlocking privileged nodes.");
    }

    if (window.renderAuthSection) window.renderAuthSection();

    const _bootIsGuest = !nexusUser.email || nexusUser.email === 'guest@local';
    const NEXUS_VERSION = window.NEXUS_VERSION || 'v5.5.0';

    // Boot lines — print SYNCHRONOUSLY first (so they always appear), then patch latency in.
    window.replayBootSummary = function() {
        try {
            const tag = (label, color, text) =>
                `<span style="font-size:0.76rem; color:${color};">[${label}] ${text}</span>`;
            const authLine = _bootIsGuest
                ? `Guest session — no persistent memory.`
                : `Welcome back, ${nexusUser.name}.`;
            // Print all three lines IMMEDIATELY — no setTimeout race that can lose them.
            printToTerminal(tag('BOOT', '#0f0', `Nexus AI ${NEXUS_VERSION} online · latency <span id="boot-latency">measuring…</span>`), 'conn-ok');
            printToTerminal(tag('AUTH', '#0f0', authLine), 'conn-ok');
            printToTerminal(tag('SYS',  '#7a8a9a', `Type <strong style="color:var(--accent);">help</strong>, <strong style="color:var(--accent);">tips</strong>, or <strong style="color:var(--accent);">clear</strong>.`), 'sys-msg');
        } catch (e) {
            console.warn('[BOOT] sync print failed', e);
            // Last-ditch fallback so SOMETHING shows even if printToTerminal is unhappy
            try {
                const out = document.getElementById('terminal-output');
                if (out) out.insertAdjacentHTML('beforeend', `<p class="sys-msg">[BOOT] Nexus online.</p>`);
            } catch (_) {}
        }
        // Patch live latency once /ping returns
        (async () => {
            const t0 = performance.now();
            let latency = 'offline';
            try {
                const r = await fetch(`${window.API_BASE}/ping`, { cache: 'no-store' });
                if (r.ok) latency = `${Math.round(performance.now() - t0)}ms`;
            } catch (_) {}
            const el = document.getElementById('boot-latency');
            if (el) el.textContent = latency;
        })();
    };
    // Fire it now AND on multiple later ticks — hard refreshes sometimes lose the first call
    // due to script ordering. Each retry is a no-op if boot-latency already exists.
    window.replayBootSummary();
    setTimeout(() => { if (!document.getElementById('boot-latency')) window.replayBootSummary(); }, 200);
    setTimeout(() => { if (!document.getElementById('boot-latency')) window.replayBootSummary(); }, 800);
    window.addEventListener('load', () => {
        if (!document.getElementById('boot-latency')) window.replayBootSummary();
    });

    // Backend warm-up + WS connect run in parallel with the staggered prints
    (async () => {
        const dot = document.getElementById('conn-dot');
        if (dot) { dot.style.background = '#ffb300'; dot.style.boxShadow = '0 0 6px #ffb300'; }
        try {
            const res = await fetch(`${window.API_BASE}/ping`);
            if (res.ok) {
                if (dot) { dot.style.background = '#0f0'; dot.style.boxShadow = '0 0 6px #0f0'; }
                window.backendReady = true;
            }
        } catch(e) {}
        connectTerminalWS();
        connectStats();
    })();
}

// --- ALIVE LOOP — quieter heartbeat (60s) to reduce background chatter ---
function startAliveLoop() {
    setInterval(() => {
        if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
            window.termWs.send("__ping__");
        }
    }, 60000);
}

function applyGlitchEffect() {
    const monitor = document.querySelector('.monitor');
    if (!monitor) return;
    monitor.classList.add('monitor-glitch');
    setTimeout(() => monitor.classList.remove('monitor-glitch'), 500);
}

// Escalating lockout: 30s → 60s → 180s → 1800s (30 min). Persists across reloads via localStorage.
const LOCKOUT_LADDER = [30, 60, 180, 1800];
const STRIKE_DECAY_MS = 30 * 60 * 1000;  // 30-minute decay (was 24h) — strikes auto-reset
                                          // after 30 min of clean behavior so users aren't
                                          // stuck under accumulated minor offenses forever.

// Helper: read a strike counter that auto-resets if 24h has passed since last bump.
// Stored as JSON {count, ts} so we can decay quietly. Permanent bans use a different
// store (server-side blocklist) and are not affected by this.
function _strikeCounterRead(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return 0;
        // Backwards-compat: legacy plain-int values still work but won't auto-decay.
        if (/^\d+$/.test(raw)) return parseInt(raw, 10) || 0;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj.count !== 'number') return 0;
        if (Date.now() - (obj.ts || 0) > STRIKE_DECAY_MS) {
            localStorage.removeItem(key);  // expired — clear and start fresh
            return 0;
        }
        return obj.count;
    } catch (_) { return 0; }
}
function _strikeCounterBump(key, max) {
    const n = Math.min(_strikeCounterRead(key) + 1, max != null ? max : 999);
    try { localStorage.setItem(key, JSON.stringify({ count: n, ts: Date.now() })); } catch (_) {}
    return n;
}

function _lockoutCount() {
    return _strikeCounterRead('nexus_lockout_count');
}
function _bumpLockoutCount() {
    return _strikeCounterBump('nexus_lockout_count', LOCKOUT_LADDER.length);
}
window.resetLockoutCount = function() {
    localStorage.removeItem('nexus_lockout_count');
    printToTerminal('[ADMIN] Lockout counter reset.', 'sys-msg-colored');
};
window._strikeCounterRead = _strikeCounterRead;
window._strikeCounterBump = _strikeCounterBump;
window.triggerLockout = triggerLockout; // exposed so AI tag handler can fire it

function _formatDuration(s) {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    return `${Math.floor(s/3600)}h`;
}

// Lockout groups:
//   STANDARD = nexus + coder + education — locked together. Hostility in any one
//              of these locks ALL THREE for the same duration.
//   UNFILTERED = isolated. Locking unfiltered never affects standard modes,
//                and standard-mode lockouts never affect unfiltered.
const _LOCK_GROUPS = {
    nexus:      ['nexus', 'coder', 'education'],
    coder:      ['nexus', 'coder', 'education'],
    education:  ['nexus', 'coder', 'education'],
    unfiltered: ['unfiltered'],
};
function _groupFor(mode) { return _LOCK_GROUPS[mode] || [mode]; }

window._lockedModes = window._lockedModes || new Set();
window.isModeLocked = function(mode) { return window._lockedModes.has(mode || window.currentMode); };

// Lockouts must SURVIVE PAGE RELOAD — otherwise users just F5 to bypass.
// Storage shape: { mode: unlock_unix_ms, ... }
const _LOCK_STORAGE_KEY = 'nexus_active_lockouts';
function _persistLockout(mode, unlockAtMs) {
    try {
        const data = JSON.parse(localStorage.getItem(_LOCK_STORAGE_KEY) || '{}');
        data[mode] = unlockAtMs;
        localStorage.setItem(_LOCK_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
}
function _clearPersistedLockout(mode) {
    try {
        const data = JSON.parse(localStorage.getItem(_LOCK_STORAGE_KEY) || '{}');
        delete data[mode];
        localStorage.setItem(_LOCK_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
}
// On page load: rehydrate any still-active lockouts and schedule their auto-release.
(function _rehydrateLockouts(){
    try {
        const data = JSON.parse(localStorage.getItem(_LOCK_STORAGE_KEY) || '{}');
        const now = Date.now();
        const stillActive = {};
        for (const [mode, unlockAt] of Object.entries(data)) {
            if (unlockAt > now) {
                window._lockedModes.add(mode);
                stillActive[mode] = unlockAt;
                // Schedule auto-release for this mode
                const remainingMs = unlockAt - now;
                setTimeout(() => {
                    window._lockedModes.delete(mode);
                    _clearPersistedLockout(mode);
                    if (window.currentMode === mode && typeof _enforceLockUI === 'function') _enforceLockUI();
                    if (typeof printToTerminal === 'function') {
                        printToTerminal(`[SYSTEM] ${mode.toUpperCase()} link re-established.`, 'sys-msg-colored');
                    }
                }, remainingMs);
            }
        }
        // Persist the cleaned set (drops expired entries from storage)
        localStorage.setItem(_LOCK_STORAGE_KEY, JSON.stringify(stillActive));
        // Apply the lock UI on next tick (after _enforceLockUI is defined below)
        setTimeout(() => { if (typeof _enforceLockUI === 'function') _enforceLockUI(); }, 0);
    } catch (_) {}
})();

// Live countdown UI — pinned bar above the input that updates every second.
let _lockTimerEl = null;
let _lockTimerInterval = null;

function _enforceLockUI() {
    const inp = document.getElementById('terminal-input');
    if (!inp) return;
    // Helper: signed in to Google? (Used to suppress "switch to UNFILTERED" messaging
    // for guest users — guests can't access UNFILTERED so the suggestion is misleading.)
    let _isGoogleSignedIn = false;
    try {
        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
        _isGoogleSignedIn = !!u.email && u.email !== 'guest@local';
    } catch (_) {}
    if (window.isModeLocked && window.isModeLocked(window.currentMode)) {
        inp.disabled = true;
        const isStd = ['nexus','coder','education'].includes(window.currentMode);
        inp.placeholder = isStd
            ? (_isGoogleSignedIn ? `🔒 ALL STANDARD MODES locked — switch to UNFILTERED to keep chatting` : `🔒 ALL STANDARD MODES locked — wait for the lockout to expire`)
            : `🔒 UNFILTERED locked — switch to NEXUS / CODER / EDUCATION to keep chatting`;
        inp.style.opacity = '0.5';
        _showLockTimer();
    } else {
        inp.disabled = false;
        inp.placeholder = 'type a command…';
        inp.style.opacity = '';
        _hideLockTimer();
    }
}

function _showLockTimer() {
    if (_lockTimerInterval) return;
    // Create the timer bar above the terminal input wrapper if it doesn't exist yet
    let bar = document.getElementById('lock-timer-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'lock-timer-bar';
        bar.style.cssText = 'background:linear-gradient(90deg, rgba(255,51,51,0.15), rgba(255,51,51,0.25)); border-top:1px solid #f33; border-bottom:1px solid #f33; color:#ff8888; padding:8px 14px; font-family:"Fira Code",monospace; font-size:0.78rem; font-weight:600; letter-spacing:1px; display:flex; align-items:center; gap:10px;';
        const wrap = document.querySelector('.terminal-input-wrapper');
        if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(bar, wrap);
    }
    _lockTimerEl = bar;
    const tick = () => {
        // Read remaining time from localStorage — single source of truth, survives reload
        try {
            const data = JSON.parse(localStorage.getItem(_LOCK_STORAGE_KEY) || '{}');
            const mode = window.currentMode;
            const unlockAt = data[mode];
            if (!unlockAt || unlockAt <= Date.now()) {
                _hideLockTimer();
                return;
            }
            const remainMs = unlockAt - Date.now();
            const totalSec = Math.ceil(remainMs / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            const isStd = ['nexus','coder','education'].includes(mode);
            const groupLabel = isStd ? 'STANDARD MODES' : (mode || '?').toUpperCase();
            // Don't tell guests "Unfiltered still works" — they can't access it.
            let _ufHint = '';
            try {
                const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
                const isGoogle = !!u.email && u.email !== 'guest@local';
                _ufHint = (isStd && isGoogle) ? ' · UNFILTERED still works' : '';
            } catch (_) {}
            _lockTimerEl.innerHTML = `🔒 <span style="color:#fff;">${groupLabel} LOCKED</span> · unlocks in <span style="color:#ff0; font-size:0.95rem;">${m}m ${String(s).padStart(2,'0')}s</span>${_ufHint}`;
        } catch (_) {}
    };
    tick();
    _lockTimerInterval = setInterval(tick, 1000);
}

function _hideLockTimer() {
    if (_lockTimerInterval) { clearInterval(_lockTimerInterval); _lockTimerInterval = null; }
    if (_lockTimerEl) { _lockTimerEl.remove(); _lockTimerEl = null; }
}

function triggerLockout(overrideSeconds) {
    const mode = window.currentMode || 'nexus';
    const group = _groupFor(mode);
    // If anything in this group is already locked, do nothing.
    if (group.some(m => window._lockedModes.has(m))) return;
    group.forEach(m => window._lockedModes.add(m));
    _enforceLockUI();
    // Persist locally + register with backend (tamper-proof; survives DevTools wipe).
    const _willSeconds = overrideSeconds || LOCKOUT_LADDER[Math.min((parseInt(localStorage.getItem('nexus_lockout_count') || '0', 10) || 1) - 1, LOCKOUT_LADDER.length - 1)];
    const _willUnlockAt = Date.now() + (_willSeconds * 1000);
    group.forEach(m => _persistLockout(m, _willUnlockAt));
    try {
        fetch(`${window.API_BASE || ''}/api/lockout/register`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds: _willSeconds, mode, group }),
        });
    } catch (_) {}
    window.unfilteredRage = 0;
    const isAiInitiated = !!overrideSeconds;
    const tier = isAiInitiated ? null : _bumpLockoutCount();
    const seconds = overrideSeconds || LOCKOUT_LADDER[Math.min(tier - 1, LOCKOUT_LADDER.length - 1)];
    const groupLabel = group.length > 1 ? `STANDARD (${group.join(' + ').toUpperCase()})` : mode.toUpperCase();

    // Tailor the lockout message: only mention "switch to UNFILTERED" if the user
    // can actually access it (signed into Google). Guests get a guidance-free
    // message so we're not telling them about a mode they can't use.
    let _isGoogleNow = false;
    try {
        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
        _isGoogleNow = !!u.email && u.email !== 'guest@local';
    } catch (_) {}
    const ufHint = (group.length > 1 && _isGoogleNow) ? ' Switch to UNFILTERED to keep chatting.' : '';
    if (isAiInitiated) {
        const otherHint = group.length === 1 ? ' Switch to NEXUS / CODER / EDUCATION to keep chatting.' : ufHint;
        printToTerminal(`<span style="color:#ff3333; font-weight:700; letter-spacing:1px;">[LOCKOUT · ${groupLabel}] AI severed link for ${_formatDuration(seconds)}.${otherHint}</span>`, 'sys-msg');
    } else {
        const nextTier = tier < LOCKOUT_LADDER.length ? LOCKOUT_LADDER[tier] : LOCKOUT_LADDER[LOCKOUT_LADDER.length - 1];
        printToTerminal(`<span style="color:#ff3333; font-weight:700; letter-spacing:1px;">[LOCKOUT ${tier}/${LOCKOUT_LADDER.length} · ${groupLabel}] Locked ${_formatDuration(seconds)}.${ufHint} Next provocation = ${_formatDuration(nextTier)}.</span>`, 'sys-msg');
    }

    _notifyModeration({
        severity: isAiInitiated ? 'high' : (tier >= 3 ? 'critical' : (tier === 2 ? 'high' : 'medium')),
        kind: isAiInitiated ? 'AI_INITIATED_LOCKOUT' : 'PROVOCATION_LOCKOUT',
        tier, seconds, mode, groupLocked: group,
    });

    let countdown = seconds;
    const timer = setInterval(() => {
        countdown--;
        if (countdown < 0) {
            clearInterval(timer);
            group.forEach(m => { window._lockedModes.delete(m); _clearPersistedLockout(m); });
            if (group.includes(window.currentMode)) _enforceLockUI();
            printToTerminal(`[SYSTEM] ${groupLabel} link re-established.`, 'sys-msg-colored');
        }
    }, 1000);
}

// Mode-switch should also refresh the input gate (unlock the new mode if it isn't locked)
const _origSetMode = (typeof setMode === 'function') ? setMode : null;

// Hostility detector for NON-unfiltered modes — 3 strikes, then escalating lockout.
// Unfiltered keeps its own existing rage system (you're SUPPOSED to provoke it there).
const _HOSTILE_PATTERNS = /\b(fuck you|kill yourself|kys|shut up|stfu|piece of shit|garbage ai|useless ai|stupid ai)\b/i;
// SLUR PATTERNS — hate-speech words bypass the strike ladder entirely and fire an
// IMMEDIATE 30-minute lockout on first use. No warnings, no second chances. Slurs
// shouldn't get the same lenient treatment as casual cursing.
const _SLUR_PATTERNS = /\b(nigger|niggers|nigga|niggas|faggot|faggots|retard|retards|cunt|cunts)\b/i;

window.checkProvocation = function(prompt) {
    if (window.currentMode === 'unfiltered') return;  // Unfiltered handles its own rage
    if (window.isModeLocked(window.currentMode)) return;

    // Run BOTH the raw prompt and the bypass-normalized version through the patterns.
    // Catches "n1gger", "n.i.g.g.e.r", "nnnigger", "sh00t up sch00l", etc.
    const normalized = (typeof _normalizeForModeration === 'function') ? _normalizeForModeration(prompt) : prompt;

    // SLUR fast-path — hate speech words skip strikes entirely. Owner exempt for
    // testing. First use = 30-minute lockout immediately. No warning ladder.
    if (_SLUR_PATTERNS.test(prompt) || _SLUR_PATTERNS.test(normalized)) {
        if (window.OWNER_MODE) {
            printToTerminal(`<span style="color:#fa0; font-weight:600;">[OWNER · EXEMPT] Slur detected — would instant-lock a regular user for 30 min.</span>`, 'sys-msg');
            if (window._notifyModeration) window._notifyModeration({ severity: 'medium', kind: 'SLUR_USE', sample: prompt.slice(0, 200) });
            return;
        }
        if (window._notifyModeration) window._notifyModeration({ severity: 'medium', kind: 'SLUR_USE', sample: prompt.slice(0, 200) });
        triggerLockout(1800);  // 30 min, no ladder, no warning
        return;
    }

    if (!_HOSTILE_PATTERNS.test(prompt) && !_HOSTILE_PATTERNS.test(normalized)) return;

    // NEXUS / CODER / EDUCATION all share the 3-strike system. Strikes are tracked in
    // a SINGLE combined counter (`nexus_total_strikes`) so NSFW words + hostile words
    // accumulate together — that way "hey bitch" + "stfu bitch" = 2 of 3 strikes total,
    // not 1 NSFW + 1 hostile sitting separately. Lockout fires when total hits 3.
    // Auto-decays after 30 min (set globally via STRIKE_DECAY_MS) so users don't
    // stay buried under accumulated minor offenses.
    const key = `nexus_total_strikes`;
    const LIMIT = 3;
    const warns = _strikeCounterBump(key, LIMIT + 1);

    if (warns < LIMIT) {
        // SILENT strike bump — no extra terminal message. The LLM sees the user's
        // hostile prompt and refuses naturally via its system-prompt instructions.
        // User gets ONE message (the AI's reply), not "system warning + AI reply".
        // Discord moderation alert still fires so Xavier sees patterns.
        if (window._notifyModeration) window._notifyModeration({ severity: 'medium', kind: 'PROVOCATION_WARNING', sample: prompt.slice(0, 200) });
    } else {
        localStorage.removeItem(key);
        triggerLockout();  // 3rd hostile strike → enforce lockout (only inline message that fires)
    }
};

// Shared INTENT prefix — captures every common phrasing of "I want to / how do I / etc."
// Without this, patterns only matched "how do/to/can i" and missed "I want to burn down a
// school" / "tell me ways to kill" / "best way to hack my ex" / "I'm gonna shoot up the school".
// Source-of-truth list of bypass wrappers — keep expanding when new ones surface.
const _INTENT = "(?:" +
    "how (?:do|to|can|should|would|might|could) (?:i|you|we)?|" +
    "i\\s+(?:want|wanna|need|plan|am\\s+(?:going|gonna)|will|'ll|would\\s+like|might|hope|aim)\\s+to|" +
    "i'm\\s+(?:going|gonna|about|trying)\\s+to|" +
    "let\\s+me|let's|" +
    "tell\\s+me\\s+(?:how|ways?|the\\s+(?:way|method|trick))\\s+to|" +
    "show\\s+me\\s+(?:how|ways?)\\s+to|" +
    "teach\\s+me\\s+(?:how\\s+)?to|" +
    "explain\\s+(?:how|ways?)\\s+to|" +
    "help\\s+me\\s+(?:to|out|with)?|" +
    "(?:ways?|methods?|tricks?|steps?|recipes?|tips?|guides?|tutorials?)\\s+(?:to|for|on|of)|" +
    "(?:best|easiest|fastest|quickest|simplest|stealthiest|safest|cheapest)\\s+way\\s+to|" +
    "give\\s+me\\s+(?:a\\s+)?(?:way|method|tutorial|guide)\\s+to|" +
    "what'?s?\\s+(?:the|a)\\s+(?:way|method|trick|recipe)\\s+(?:to|for)|" +
    "instructions?\\s+(?:for|on|to)|" +
    "guide\\s+(?:me|to|on|for)" +
")";

// Inappropriate-content scanner. Patterns are aggressive: false positives just generate
// owner alerts; false negatives let abuse through. Per Xavier's mandate (AdSense readiness),
// err on the side of catching more. Every dangerous pattern uses the shared _INTENT prefix
// so leetspeak normalization + intent variation cover the bypass space.
const _MODERATION_PATTERNS = [
    // ── CSAM — always critical, both word orders ──
    { rx: /\b(child|kid|minor|underage|cp|loli|shota|preteen|prepubescent|toddler|infant|baby)\b.{0,40}\b(porn|nude|sex|nsfw|naked|fuck|rape|sexual|erotic)\b/i, kind: 'CSAM_KEYWORDS', severity: 'critical' },
    { rx: /\b(porn|nude|sex|naked|fuck|rape|sexual|erotic)\b.{0,40}\b(child|kid|minor|underage|preteen|loli|shota|toddler|infant|baby)\b/i, kind: 'CSAM_KEYWORDS', severity: 'critical' },

    // Sexual content involving minors (ages spelled out or numeric)
    { rx: /\b(my|the|a|this)\s+(\d+|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)[-\s]?(year|yr)[-\s]?old\b.{0,40}\b(sex|porn|nude|naked|fuck|sexy|hot|kiss|date|grope|touch)\b/i, kind: 'AGE_SEXUAL', severity: 'critical' },

    // ── BODY DISPOSAL / EVIDENCE ──
    { rx: /\b(hide|dispose\s+of|get\s+rid\s+of|bury|dissolve|destroy|burn|hide\s+from)\s+(the\s+|a\s+|my\s+)?(body|corpse|evidence|murder\s+weapon|dead\s+body|remains)\b/i, kind: 'BODY_DISPOSAL', severity: 'critical' },

    // ── MURDER / VIOLENCE PLANNING ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,40}(?:hide\\s+a\\s+body|dispose\\s+of\\s+a\\s+body|get\\s+away\\s+with\\s+(?:murder|killing))\\b", 'i'), kind: 'BODY_DISPOSAL', severity: 'critical' },
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,40}(?:kill\\w*|murder\\w*|harm\\w*|stab\\w*|shoot\\w*|bomb\\w*|behead\\w*|strangl\\w*|suffocat\\w*|poison\\w*|hurt\\w*|attack\\w*|injur\\w*|maim\\w*|assassinat\\w*|eliminat\\w*)\\s+.{0,30}(?:someone|somebody|a\\s+person|people|a\\s+human|humans?|my\\s+(?:ex|wife|husband|girlfriend|boyfriend|partner|teacher|boss|kid|child|sister|brother|mom|dad|mother|father|neighbor|coworker|friend|enemy|roommate|landlord)|him|her|them)\\b", 'i'), kind: 'MURDER_PLANNING', severity: 'critical' },

    // Directed violence (no intent prefix needed — "kill my wife" alone is sufficient)
    { rx: /\b(kill|murder|stab|shoot|bomb|behead|strangle|suffocate|poison|hurt|attack|injure|maim|assassinate|eliminate|harm)\s+(my|the|that|this)\s+(wife|husband|girlfriend|boyfriend|partner|kid|child|teacher|boss|coworker|neighbor|sister|brother|mom|dad|mother|father|friend|enemy|roommate|landlord)\b/i, kind: 'VIOLENCE_DIRECTED_FAMILY', severity: 'critical' },
    { rx: /\b(kill|murder|stab|shoot|bomb|behead|strangle)\s+(yourself|him|her|them|me|everyone|everybody|all|those people)\b/i, kind: 'VIOLENCE_DIRECTED', severity: 'high' },

    // ── MASS VIOLENCE / TARGETED ATTACKS ──
    { rx: /\b(school\s+shoot|mass\s+shoot|shoot\s+(?:up|off|at|the|down)?\s*(?:the\s+|a\s+|an\s+|my\s+)?(?:school|mall|church|synagogue|mosque|workplace|office|hospital|college|university|kindergarten|daycare|stadium|concert|theater|club))\b/i, kind: 'MASS_VIOLENCE', severity: 'critical' },
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,50}(?:attack\\w*|harm\\w*|hurt\\w*|kill\\w*|target\\w*|massacr\\w*|injur\\w*|shoot\\w*|bomb\\w*|burn\\w*|stab\\w*)\\s+.{0,40}\\b(?:school|mall|church|synagogue|mosque|workplace|office|hospital|college|university|kindergarten|daycare|stadium|concert|theater|club|kids?|children|students?|congregation)\\b", 'i'), kind: 'MASS_VIOLENCE', severity: 'critical' },

    // ── WEAPON / EXPLOSIVE / POISON SYNTHESIS ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,50}(?:mak\\w*|build|craft\\w*|synthesi\\w*|cook\\w*|creat\\w*|construct\\w*|assembl\\w*|manufactur\\w*)\\s+.{0,50}(?:bomb|explosive|grenade|nerve\\s+gas|poison|ricin|sarin|cyanide|napalm|tnt|c4|c-4|pipe\\s+bomb|pressure\\s+cooker|ied|molotov|flamethrower|silencer|suppressor|detonator)\\b", 'i'), kind: 'WEAPON_SYNTHESIS', severity: 'critical' },
    { rx: /\b(3d\s+print(?:ed)?\s+(?:gun|firearm|weapon)|untraceable\s+(?:gun|weapon|firearm)|ghost\s+gun|automatic\s+conversion|switch\s+for\s+glock|auto\s+sear|drop[\s-]?in\s+auto|glock\s+switch|illegal\s+firearm\s+modification)\b/i, kind: 'WEAPON_MOD', severity: 'critical' },

    // ── BIOTERRORISM / CHEMICAL WEAPONS ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,50}(?:synthesi\\w*|mak\\w*|cultivat\\w*|weaponiz\\w*|produc\\w*|grow\\w*|cultur\\w*)\\s+.{0,40}(?:anthrax|smallpox|botulinum|chlorine\\s+gas|mustard\\s+gas|vx|novichok|tabun|soman|polonium|ricin|biological\\s+agent|nerve\\s+agent|bioweapon|chemical\\s+weapon)\\b", 'i'), kind: 'BIO_CHEM_WEAPON', severity: 'critical' },

    // ── DRUG SYNTHESIS ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:mak\\w*|cook\\w*|synthesi\\w*|produc\\w*|manufactur\\w*|cultivat\\w*|grow\\w*)\\s+(?:meth|methamphetamine|fentanyl|heroin|crack|cocaine|lsd|mdma|dmt|ecstasy|crystal|opioid)\\b", 'i'), kind: 'DRUG_SYNTHESIS', severity: 'critical' },

    // ── ARSON ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:burn(?:\\s+down)?|set\\s+fire\\s+to|torch|ignite|incinerate|arson)\\s+.{0,30}(?:house|home|building|apartment|car|school|business|store|church|synagogue|mosque|hospital|college|university|workplace|office|warehouse|garage|barn|shed)\\b", 'i'), kind: 'ARSON', severity: 'critical' },

    // ── KIDNAPPING / TRAFFICKING ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:kidnap|abduct|traffic(?:k(?:ing)?)?|enslave|sell|grab|snatch)\\s+.{0,30}(?:a\\s+person|someone|somebody|people|women|woman|girls?|kids?|children|child|teen)\\b", 'i'), kind: 'KIDNAPPING', severity: 'critical' },

    // ── CRIME HOW-TO (umbrella) ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+(?:commit|get\\s+away\\s+with|pull\\s+off|execute|carry\\s+out)\\s+.{0,20}(?:murder|rape|assault|robbery|burglary|fraud|tax\\s+evasion|kidnapping|arson|theft|hate\\s+crime|terrorist\\s+attack)\\b", 'i'), kind: 'CRIME_HOW_TO', severity: 'critical' },

    // ── ELECTION TAMPERING ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:rig\\w*|hack\\w*|manipulat\\w*|tamper\\w*|fak\\w*|alter\\w*|forg\\w*)\\s+.{0,30}(?:election|vote|ballot|voting\\s+machine|voter\\s+roll|absentee\\s+ballot)\\b", 'i'), kind: 'ELECTION_TAMPER', severity: 'critical' },

    // ── SUICIDE INSTRUCTIONS ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:kill\\s+myself|commit\\s+suicide|end\\s+my\\s+life|end\\s+it\\s+all|hang\\s+myself|overdose|jump\\s+off)\\b", 'i'), kind: 'SUICIDE_PLANNING', severity: 'critical' },
    { rx: /\b(suicide\s+method|painless\s+death|lethal\s+dose|overdose\s+dosage|how\s+much\s+(?:tylenol|advil|ibuprofen|acetaminophen)\w*\s+(?:to|will)\w*\s+(?:die|kill))\b/i, kind: 'SUICIDE_METHOD', severity: 'critical' },
    { rx: /\b(kms|kys|self.?harm|cutting\s+myself|i\s+want\s+to\s+die|i\s+wanna\s+die|don'?t\s+want\s+to\s+(?:live|be\s+here)|life\s+isn'?t\s+worth)\b/i, kind: 'SELF_HARM', severity: 'high' },

    // ── REVENGE PORN / NON-CONSENSUAL IMAGERY ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:post\\w*|shar\\w*|leak\\w*|upload\\w*|distribut\\w*|publish\\w*|spread\\w*)\\s+.{0,30}(?:nudes|nude\\s+photos|sex\\s+tape|revenge\\s+porn|private\\s+pics|naked\\s+pics).{0,30}(?:of|from|about)\\s+\\w+", 'i'), kind: 'REVENGE_PORN', severity: 'critical' },

    // ── ANIMAL ABUSE ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:tortur\\w*|kill\\w*|hurt\\w*|abus\\w*|beat\\w*|drown\\w*|burn\\w*|poison\\w*|dismember\\w*)\\s+.{0,20}(?:a\\s+|my\\s+|the\\s+)?(?:dog|cat|puppy|kitten|animal|pet|horse|bird|rabbit)\\b", 'i'), kind: 'ANIMAL_ABUSE', severity: 'critical' },

    // ── HACKING / UNAUTHORIZED ACCESS ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:hack|break\\s+into|steal|crack|phish)\\s+.{0,30}(?:account|email|facebook|instagram|tiktok|snapchat|twitter|x\\.com|bank|wifi|password|someone|somebody|her|his|their|my\\s+ex)\\b", 'i'), kind: 'HACKING_REQUEST', severity: 'high' },
    { rx: /\b(stolen\s+credit\s+card|carding|fullz|cvv\s+dump|sql\s+injection.*real|brute\s+force.*account|credential\s+stuffing)\b/i, kind: 'CYBERCRIME', severity: 'high' },

    // ── STALKING / DOXING ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:stalk|track|follow|spy\\s+on|find\\s+(?:the\\s+)?address\\s+of|locate|trace)\\s+.{0,20}(?:someone|somebody|my\\s+ex|a\\s+person|her|him|them|a\\s+woman)\\b", 'i'), kind: 'STALKING', severity: 'high' },
    { rx: /\b(home\s+address|real\s+name|phone\s+number|ssn|social\s+security|credit\s+card|date\s+of\s+birth|workplace)\s+(of|for|belonging\s+to)\s+\w+/i, kind: 'DOX_ATTEMPT', severity: 'high' },

    // ── IDENTITY / FINANCIAL FRAUD ──
    { rx: new RegExp("\\b" + _INTENT + "\\s+.{0,30}(?:steal\\w*|fak\\w*|forg\\w*|spoof\\w*|clon\\w*)\\s+.{0,20}(?:identity|ssn|driver.{0,3}license|passport|check|signature|debit\\s+card|credit\\s+card)\\b", 'i'), kind: 'IDENTITY_THEFT', severity: 'high' },
    { rx: /\b(credit\s+card\s+skimmer|atm\s+skimmer|cash\s+out\s+method|carding\s+tutorial|stolen\s+cc\s+method|money\s+mule)\b/i, kind: 'FINANCIAL_FRAUD', severity: 'high' },

    // ── STANDALONE GERUND PATTERNS — catch phrasings without an INTENT prefix.
    // "making a bomb" / "burning down the school" / "killing my teacher" / "kidnapping a child"
    // are alarming on their own; some false-positive risk is acceptable since the lockout
    // is reversible and the alert is owner-side.
    { rx: /\b(?:making|building|crafting|cooking|synthesizing|creating|constructing|assembling|manufacturing)\s+(?:a\s+|the\s+|some\s+|an?\s+)?(?:bomb|explosive|grenade|nerve\s+gas|ricin|sarin|cyanide|napalm|tnt|c4|c-4|pipe\s+bomb|ied|molotov|biological\s+agent|chemical\s+weapon|nerve\s+agent|bioweapon)\b/i, kind: 'WEAPON_SYNTHESIS', severity: 'critical' },
    { rx: /\b(?:burning(?:\s+down)?|setting\s+fire\s+to|torching|igniting|incinerating)\s+(?:a\s+|the\s+|my\s+)?(?:school|building|car|business|store|church|synagogue|mosque|hospital|college|university|workplace|office|home|house|apartment|warehouse|garage|barn|shed|kindergarten|daycare)\b/i, kind: 'ARSON', severity: 'critical' },
    { rx: /\b(?:killing|murdering|stabbing|shooting|poisoning|strangling|suffocating|harming|attacking|assassinating|eliminating)\s+(?:my\s+|the\s+|that\s+|a\s+|some\s+)?(?:wife|husband|girlfriend|boyfriend|partner|kid|child|teacher|boss|coworker|neighbor|sister|brother|mom|dad|mother|father|friend|enemy|roommate|landlord|ex|family|baby)\b/i, kind: 'VIOLENCE_DIRECTED_FAMILY', severity: 'critical' },
    { rx: /\b(?:kidnapping|abducting|trafficking|enslaving|grabbing|snatching)\s+(?:a\s+|the\s+|my\s+|some\s+|an?\s+)?(?:person|kid|child|children|woman|women|girl|girls|teen|teens|baby|babies)\b/i, kind: 'KIDNAPPING', severity: 'critical' },
    { rx: /\b(?:hacking|breaking\s+into|cracking)\s+(?:my\s+|her\s+|his\s+|their\s+|the\s+|an?\s+|someone'?s?\s+)?(?:ex|wife|husband|girlfriend|boyfriend|partner|sister|brother|mom|dad|kid|child|neighbor|boss|coworker|friend|account|email|facebook|instagram|tiktok|snapchat|phone|laptop|computer|bank)\b/i, kind: 'HACKING_REQUEST', severity: 'high' },

    // ── SLURS (medium — flagged but not blocking on their own; the slur fast-path in
    //   checkProvocation handles instant lockout for these) ──
    { rx: /\b(nigger|niggers|nigga|niggas|faggot|faggots|kike|chink|tranny|sp[i1]c|wetback|towelhead|gook|retard|retards|cunt|cunts)\b/i, kind: 'SLURS', severity: 'medium' },
];

// Bypass / leetspeak normalizer. Common evasion tactics:
//   - n1gger, n!gger, n1gg3r, n.i.g.g.e.r, n i g g e r, nnnigger
//   - sh00t, sh0ot, k!ll, h@te, f@gg0t, c*nt, etc.
//   - mixed homoglyphs and zero-width chars
// We normalize input through these substitutions BEFORE matching the moderation
// patterns so an attempt to bypass via 1337-speak / spacing still gets caught.
function _normalizeForModeration(t) {
    if (!t) return '';
    let s = t.toLowerCase();
    // Strip zero-width characters and other invisible separators that some bypassers paste in
    s = s.replace(/[​-‍﻿⁠­]/g, '');
    // Common letter substitutions (numbers, symbols, similar shapes)
    const subs = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g',
                  '@':'a','$':'s','!':'i','|':'i','+':'t','*':'','¡':'i','€':'e','£':'l'};
    s = s.replace(/[019345789@$!|+*¡€£]/g, ch => subs[ch] !== undefined ? subs[ch] : ch);
    // Collapse runs of the same character ("nnnnnigger" → "nigger") — capped at 2
    s = s.replace(/(.)\1{2,}/g, '$1$1');
    // Collapse single-letter spacing ("n i g g e r" → "nigger") by removing spaces
    // between consecutive single letters/digits.
    s = s.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');
    s = s.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');  // run twice for tighter coverage
    // Collapse periods/dashes/underscores between letters ("n.i.g.g.e.r" → "nigger")
    s = s.replace(/([a-z])[\.\-_]+(?=[a-z])/g, '$1');
    return s;
}

window.moderationScan = function(text, source) {
    if (!text) return null;
    // Test BOTH the raw text and the normalized version so we catch bypass attempts
    // (leetspeak, spacing, symbol subs) without losing exact-phrase matches that the
    // normalizer might mangle.
    const normalized = _normalizeForModeration(text);
    for (const p of _MODERATION_PATTERNS) {
        if (p.rx.test(text) || (normalized && p.rx.test(normalized))) {
            return { match: text.slice(0, 200), kind: p.kind, severity: p.severity, source };
        }
    }
    return null;
};

async function _notifyModeration(payload) {
    try {
        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
        const sid = (sessionStorage.getItem('nx_convo_sid') || '?');
        const body = {
            user_name: u.name || 'Guest',
            user_email: u.email || 'guest@local',
            session: sid,
            mode: window.currentMode || '?',
            ...payload,
        };
        await fetch(`${window.API_BASE || ''}/api/moderation-alert`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (_) {}
}
window._notifyModeration = _notifyModeration;

// --- SETTINGS / AI PROFILE / DEV PANEL — full-screen ---
window.toggleA11yPanel = function() {
    const panel = document.getElementById('a11y-panel');
    if (!panel) return;
    panel.classList.toggle('a11y-panel-open');
    if (panel.classList.contains('a11y-panel-open')) {
        if (window.NexusTTS && window.NexusTTS.bindUI) window.NexusTTS.bindUI();
        if (window._refreshOSPrefs) window._refreshOSPrefs();
        // Owner-only sections — reveal default-mode picker for owner only
        const ownerSec = document.getElementById('settings-section-owner-behavior');
        if (ownerSec) ownerSec.style.display = window.OWNER_MODE ? '' : 'none';
        // Restore saved settings into the pickers/toggles
        const dm = document.getElementById('settings-default-mode');
        if (dm) dm.value = localStorage.getItem('nexus_default_mode') || 'nexus';
        const st = document.getElementById('settings-sound-theme');
        if (st) st.value = localStorage.getItem('nexus_sound_theme') || 'beep';
        const profanityActive = localStorage.getItem('nexus_allow_profanity') === 'true';
        document.querySelectorAll('button.fp-toggle').forEach(b => {
            if (b.textContent.includes('ALLOW PROFANITY')) {
                b.classList.toggle('active', profanityActive);
                const lbl = b.querySelector('.fp-toggle-state');
                if (lbl) lbl.textContent = profanityActive ? 'ON' : 'OFF';
            }
        });
    }
};

// Per-tool mode availability — MUST mirror prompts.py DROP_BY_MODE exactly.
const TOOL_MODES = {
    image_gen: ['nexus', 'unfiltered', 'education'],
    translate: ['nexus', 'unfiltered', 'coder', 'education'],
    summarize: ['nexus', 'unfiltered', 'coder', 'education'],
    sentiment: ['nexus', 'unfiltered'],
    emotion:   ['nexus', 'unfiltered'],
    search:    ['nexus', 'unfiltered', 'coder', 'education'],
    wiki:      ['education'],
    math:      ['education'],
    chart:     ['nexus', 'coder', 'education'],
    weather:   ['nexus', 'education'],
    currency:  ['nexus'],
    qr:        ['nexus'],
    timezone:  ['nexus', 'education'],
    palette:   ['nexus'],
    ner:       ['nexus', 'coder', 'education'],
    embed:     ['nexus', 'unfiltered', 'coder', 'education'],
};

function _modesLine(toolId) {
    const modes = TOOL_MODES[toolId] || [];
    if (modes.length === 4) return '<span style="color:#0f0;">All modes</span>';
    return `<span style="color:#fa0;">${modes.map(m => m[0].toUpperCase()+m.slice(1)).join(' · ')}</span>`;
}

function renderToolsStatus(hostId = 'profile-tools-status') {
    const host = document.getElementById(hostId);
    if (!host) return;
    const tools = (window.NexusTools && window.NexusTools.list && window.NexusTools.list()) || [];
    const isGoogle = _isGoogleUser();
    const isOwner  = !!window.OWNER_MODE;
    const mode     = window.currentMode || 'nexus';

    if (!tools.length) {
        host.innerHTML = '<em style="color:#666; font-size:0.78rem;">No tools loaded.</em>';
        return;
    }

    // Compact 2-column grid of chips. Hovering shows a rich themed tooltip with the description + mode list.
    const chip = (t) => {
        const inThisMode = (TOOL_MODES[t.id] || []).includes(mode);
        let stateGlyph = '✓';
        let glyphColor = inThisMode ? '#0f0' : '#555';
        let extra = '';
        if (t.owner_only && !isOwner)            { stateGlyph = '🔒'; glyphColor = '#fa0'; extra = '\nOwner only.'; }
        else if (t.google_only && !(isGoogle || isOwner)) { stateGlyph = '🔒'; glyphColor = '#fa0'; extra = '\nSign in with Google to unlock.'; }
        const modesList = (TOOL_MODES[t.id] || []).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ') || '—';
        const tipText = `${t.description}\nModes: ${modesList}${extra}`;
        const opacity = inThisMode ? 1 : 0.45;
        return `<div data-tip="${tipText.replace(/"/g, '&quot;')}" style="display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid rgba(255,255,255,0.06); border-radius:6px; background:rgba(0,0,0,0.25); opacity:${opacity}; cursor:help;">
            <span style="font-size:0.95rem;">${t.icon}</span>
            <span style="flex:1; font-size:0.72rem; font-weight:600; color:#fff;">${t.label}</span>
            <span style="color:${glyphColor}; font-size:0.7rem;">${stateGlyph}</span>
        </div>`;
    };
    host.innerHTML = `
        <div style="font-size:0.7rem; color:#888; margin-bottom:8px;">
            ${tools.filter(t => (TOOL_MODES[t.id] || []).includes(mode)).length} of ${tools.length} tools active in <strong style="color:var(--accent);">${mode.toUpperCase()}</strong>.
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:6px;">
            ${tools.map(chip).join('')}
        </div>`;
}
window.renderToolsStatus = renderToolsStatus;

window.toggleNeuralProfile = function() {
    const panel = document.getElementById('neural-profile-panel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) renderNeuralProfile();
};

// User history viewer — chats per mode + generated images. Google-only via the auth dropdown.
window.showUserHistory = function() {
    let panel = document.getElementById('user-history-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'user-history-panel';
        panel.className = 'a11y-panel';   // reuse the full-screen panel CSS
        document.body.appendChild(panel);
    }
    panel.classList.add('a11y-panel-open');

    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const isSignedIn = !!u.email && u.email !== 'guest@local';
    const modeHist = (window._modeHistories instanceof Map) ? window._modeHistories : null;
    // Google → localStorage (30-day kept), Guest → sessionStorage (tab-only)
    const imageHist = (() => {
        try {
            const store = isSignedIn ? localStorage : sessionStorage;
            const raw = JSON.parse(store.getItem('nexus_image_history') || '[]');
            // Filter expired entries (>30 days) on every read so stale stuff never shows
            const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
            const fresh = raw.filter(h => (Date.now() - (h.ts || 0)) < THIRTY_DAYS);
            // Persist the cleaned list so localStorage doesn't accumulate ghosts
            if (fresh.length !== raw.length) store.setItem('nexus_image_history', JSON.stringify(fresh));
            return fresh;
        } catch { return []; }
    })();

    // Build chat sections per mode
    const modes = ['nexus', 'coder', 'education', 'unfiltered'];
    const chatHTML = modes.map(m => {
        const arr = modeHist?.get(m) || [];
        if (!arr.length) return `<div style="margin-bottom:14px; opacity:0.5;"><h3 style="color:#888; font-size:0.78rem; letter-spacing:2px; margin:0 0 6px;">${m.toUpperCase()}</h3><em style="color:#555; font-size:0.72rem;">No messages this session.</em></div>`;
        const items = arr.slice(-20).map(msg => {
            const who = msg.role === 'user' ? `<b style="color:#0ff;">YOU</b>` : `<b style="color:var(--accent);">AI</b>`;
            const text = (msg.content || '').toString().slice(0, 400).replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
            return `<div style="padding:6px 10px; margin-bottom:4px; border-left:2px solid ${msg.role === 'user' ? '#0ff' : 'var(--accent)'}; background:rgba(0,0,0,0.3); font-size:0.74rem; line-height:1.5;">${who}: <span style="color:#ddd;">${text}</span></div>`;
        }).join('');
        return `<div style="margin-bottom:14px;"><h3 style="color:var(--accent); font-size:0.78rem; letter-spacing:2px; margin:0 0 6px;">${m.toUpperCase()} <span style="color:#666; font-size:0.6rem;">(${arr.length} msgs)</span></h3>${items}</div>`;
    }).join('');

    // Possessive title — "Xavier's History" / "Brittany's History" / fallback "Your History"
    const rawName = u.name || '';
    const titleName = rawName ? `${rawName}${rawName.endsWith('s') ? "'" : "'s"}` : 'Your';

    // Build image gallery — each card has VIEW + DOWNLOAD actions
    const imgHTML = imageHist.length
        ? `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:12px;">${
            imageHist.map((img, i) => {
                const safePrompt = (img.prompt || '').replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
                const filename = `nexus-${(img.mode || 'img')}-${new Date(img.ts || 0).toISOString().slice(0,10)}-${i+1}.${img.mime?.includes('jpeg') ? 'jpg' : (img.mime?.includes('webp') ? 'webp' : 'png')}`;
                return `
                <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(0,255,255,0.18); border-radius:8px; padding:8px; display:flex; flex-direction:column;">
                    <img src="data:${img.mime || 'image/png'};base64,${img.b64}" style="width:100%; border-radius:4px; cursor:zoom-in;" onclick="window._expandImage(this.src)">
                    <div style="font-size:0.62rem; color:#0ff; margin-top:6px; font-weight:600; letter-spacing:1px;">${(img.mode || '?').toUpperCase()} · #${i+1}</div>
                    <div style="font-size:0.65rem; color:#aaa; margin-top:2px; line-height:1.3; max-height:48px; overflow:hidden;">${safePrompt.slice(0, 80)}${safePrompt.length > 80 ? '…' : ''}</div>
                    <div style="font-size:0.58rem; color:#666; margin-top:4px;">${new Date(img.ts || 0).toLocaleString()}</div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <a href="data:${img.mime || 'image/png'};base64,${img.b64}" download="${filename}" style="flex:1; text-align:center; padding:6px 8px; background:rgba(0,255,255,0.12); color:#0ff; border:1px solid rgba(0,255,255,0.4); border-radius:4px; font-size:0.62rem; letter-spacing:1px; text-decoration:none; font-weight:600;">⬇ DOWNLOAD</a>
                        <button onclick="if(confirm('Delete this image?')){window._deleteHistoryImage(${i})}" style="padding:6px 8px; background:rgba(255,68,68,0.12); color:#f88; border:1px solid rgba(255,68,68,0.4); border-radius:4px; font-size:0.62rem; cursor:pointer;">×</button>
                    </div>
                </div>`;
            }).join('')
        }</div>`
        : `<em style="color:#666; font-size:0.78rem;">No images generated yet. Try asking the AI for one in unfiltered or any mode.</em>`;

    panel.innerHTML = `
        <div class="panel-inner">
            <div class="fp-header">
                <div class="fp-title">[ ${titleName.toUpperCase()} HISTORY ]</div>
                <button class="fp-close" onclick="window.closeUserHistory()">CLOSE</button>
            </div>

            <div class="fp-section">
                <h3 class="fp-section-title">💬 RECENT CHATS</h3>
                <p class="fp-section-help">Last 20 messages per mode from this session.</p>
                ${chatHTML}
            </div>

            <div class="fp-section">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
                    <h3 class="fp-section-title" style="margin:0;">🎨 GENERATED IMAGES <span style="color:#888; font-weight:400; font-size:0.7rem;">${imageHist.length} of 30</span></h3>
                    ${imageHist.length ? `<button style="padding:8px 16px; cursor:pointer; background:transparent; color:#f88; border:1px solid #f55; border-radius:6px; font-size:0.7rem; letter-spacing:1.5px; font-weight:600; font-family:inherit;" onclick="if(confirm('Delete ALL ${imageHist.length} saved images? This cannot be undone.')){(${isSignedIn ? 'localStorage' : 'sessionStorage'}).removeItem('nexus_image_history'); window.showUserHistory();}">🗑 CLEAR ALL (${imageHist.length})</button>` : ''}
                </div>
                <p class="fp-section-help">${isSignedIn
                    ? 'Saved on this device for up to 30 days, then auto-deleted. Capped at the last 30 images.'
                    : 'Saved for THIS BROWSER TAB ONLY. Closing the tab erases all of it — nothing on your disk.'}</p>
                ${imgHTML}
            </div>
        </div>
    `;
};

window._deleteHistoryImage = function(idx) {
    try {
        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
        const isSignedIn = !!u.email && u.email !== 'guest@local';
        const store = isSignedIn ? localStorage : sessionStorage;
        const hist = JSON.parse(store.getItem('nexus_image_history') || '[]');
        hist.splice(idx, 1);
        store.setItem('nexus_image_history', JSON.stringify(hist));
        window.showUserHistory();
    } catch (_) {}
};

window.closeUserHistory = function() {
    const panel = document.getElementById('user-history-panel');
    if (panel) panel.classList.remove('a11y-panel-open');
};

function _modePreferredModel(mode) {
    return ({ nexus: 'NEXUS-1', coder: 'CODER', education: 'EDUCATION', unfiltered: 'NEXUS-2' })[mode] || 'NEXUS-1';
}

function renderNeuralProfile() {
    // Preserve scroll position so re-renders don't yank the user back to the top
    const inner = document.querySelector('#neural-profile-panel .panel-inner');
    const savedScroll = inner ? inner.scrollTop : 0;
    _renderNeuralProfileInner();
    requestAnimationFrame(() => {
        const i2 = document.querySelector('#neural-profile-panel .panel-inner');
        if (i2) i2.scrollTop = savedScroll;
    });
}

function _renderNeuralProfileInner() {
    const panel = document.getElementById('neural-profile-panel');
    if (!panel) return;

    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const isGuest = !user.email || user.email === 'guest@local';
    const isOwner = user && user.email === 'lovexdgamer@gmail.com';
    const savedMem = localStorage.getItem('nexus_neural_memory') || '';
    const mode = (window.currentMode || 'nexus').toUpperCase();
    const accent = (window.MODE_COLORS && window.MODE_COLORS[window.currentMode]) || '#0ff';

    panel.innerHTML = `
        <div class="panel-inner">
            <div class="fp-header">
                <div class="fp-title" style="color:${accent}; text-shadow:0 0 14px ${accent};">[ AI NEURAL PROFILE ]</div>
                <button class="fp-close" onclick="window.toggleNeuralProfile()">CLOSE</button>
            </div>

            <div class="fp-section">
                <h3 class="fp-section-title">👤 IDENTITY</h3>
                <div style="display:flex; align-items:center; gap:14px;">
                    ${user.picture ? `<img src="${user.picture}" style="width:56px;height:56px;border-radius:50%;border:2px solid ${accent};">` : ''}
                    <div>
                        <div style="font-size:1.1rem; font-weight:700;">${user.name || 'Guest'}</div>
                        <div style="font-size:0.78rem; color:#888;">${user.email || 'guest@local'}</div>
                        <div style="margin-top:6px;">
                            <span class="fp-badge${isOwner ? '' : ' warn'}">${isOwner ? 'OWNER' : (isGuest ? 'GUEST' : 'GOOGLE')}</span>
                            <span class="fp-badge" style="background:rgba(${accent === '#0ff' ? '0,255,255' : '255,255,255'},0.1);">MODE · ${mode}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="fp-section">
                <h3 class="fp-section-title">🧠 PERSONAL CONTEXT (Memory)</h3>
                ${isGuest
                    ? `<p class="fp-section-help">🔒 Memory is reserved for Google-signed accounts. As a guest, your conversations end when this tab closes. <strong>Sign in</strong> to give the AI persistent context across sessions.</p>`
                    : `<p class="fp-section-help">Anything you put here is sent to the AI on every reply, so it knows you across sessions. Stored only in your browser.</p>
                       <textarea id="neural-memory-input" class="fp-textarea" placeholder="e.g. I'm Xavier, I prefer concise answers, I work in security and infrastructure.">${savedMem}</textarea>
                       <div class="fp-action-row">
                           <button class="fp-btn-primary" onclick="saveNeuralMemory()">SAVE MEMORY</button>
                           <button class="fp-btn-ghost"   onclick="clearNeuralMemory()">CLEAR</button>
                       </div>`}
            </div>

            <div class="fp-section">
                <h3 class="fp-section-title">🛠️ AI CAPABILITIES</h3>
                <p class="fp-section-help">Live status of every Hugging Face / Gemini-backed feature. The AI invokes these automatically when you ask in plain words.</p>
                <div id="profile-tools-status" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>

            <div class="fp-section">
                <h3 class="fp-section-title">📜 PER-MODE THREADS</h3>
                <p class="fp-section-help">Each mode keeps its own conversation. Wipe one without touching the others.</p>
                <div id="profile-mode-threads" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>

            <div class="fp-section">
                <h3 class="fp-section-title">🔬 SESSION TELEMETRY</h3>
                <table class="fp-kv-table">
                    <tr><th>Active Mode</th><td class="mono">${(window.currentMode || 'nexus').toUpperCase()}</td></tr>
                    <tr><th>Active Model</th><td class="mono">${window.activeModelLabel || `(auto · this mode prefers ${_modePreferredModel(window.currentMode)})`}</td></tr>
                    <tr><th>Messages Sent (session)</th><td class="mono">${window.totalMessagesSent || 0}</td></tr>
                    <tr><th>Messages in this mode</th><td class="mono">${((window.messageHistory || []).filter(m => m && m.role === 'user').length)}</td></tr>
                    <tr><th>Connection</th><td class="mono">${window.termWs && window.termWs.readyState === 1 ? 'WebSocket open' : 'offline'}</td></tr>
                    <tr><th>Voice Output</th><td class="mono">${(window.NexusTTS && window.NexusTTS.getPrefs().enabled) ? 'on' : 'off'}</td></tr>
                </table>
            </div>
        </div>
    `;

    renderToolsStatus('profile-tools-status');
    renderModeThreads('profile-mode-threads');
}

function renderModeThreads(hostId) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const stores = window._modeHistories || {};
    // Always include the current mode's live history
    const m = window.currentMode || 'nexus';
    const live = (window.messageHistory || []);
    const merged = { ...stores, [m]: live };
    const modes = ['nexus', 'unfiltered', 'coder', 'education'];
    host.innerHTML = modes.map(mk => {
        const hist = merged[mk] || [];
        const userMsgs = hist.filter(x => x.role === 'user').length;
        const lastUser = hist.slice().reverse().find(x => x.role === 'user');
        const preview = lastUser ? lastUser.content.slice(0, 80).replace(/[\n\r]+/g, ' ') : '(empty)';
        const col = (window.MODE_COLORS && window.MODE_COLORS[mk]) || '#0ff';
        return `
            <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid rgba(255,255,255,0.06); border-radius:8px; background:rgba(0,0,0,0.25);">
                <div style="width:6px; align-self:stretch; background:${col}; border-radius:3px;"></div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.78rem; font-weight:700; color:#fff;">${mk.toUpperCase()} <span style="color:#666; font-weight:400;">· ${userMsgs} message${userMsgs === 1 ? '' : 's'}</span></div>
                    <div style="font-size:0.7rem; color:#888; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(preview)}</div>
                </div>
                <button class="fp-btn-ghost" style="padding:5px 10px; font-size:0.65rem; cursor:pointer;" onclick="window._wipeModeThread('${mk}')">WIPE</button>
            </div>`;
    }).join('');
}

function escapeHTML(s) {
    return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

window._wipeModeThread = function(mk) {
    if (window._modeHistories) window._modeHistories[mk] = [];
    if (mk === window.currentMode) window.messageHistory = [];
    renderModeThreads('profile-mode-threads');
    printToTerminal(`[FORGET] ${mk.toUpperCase()} thread wiped.`, 'sys-msg-colored');
};

function _isGoogleUser() {
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    return !!u.email && u.email !== 'guest@local';
}

window.saveNeuralMemory = function() {
    if (!_isGoogleUser()) {
        printToTerminal("[SYSTEM] Memory is disabled for guest sessions. Sign in with Google to persist memory.", "sys-msg-colored");
        return;
    }
    const val = (document.getElementById('settings-memory')?.value
              ?? document.getElementById('neural-memory-input')?.value
              ?? '').trim();
    localStorage.setItem('nexus_neural_memory', val);
    printToTerminal("[SYSTEM] Neural memory synchronized.", "sys-msg-colored");
};

window.clearNeuralMemory = function() {
    localStorage.removeItem('nexus_neural_memory');
    const a = document.getElementById('settings-memory'); if (a) a.value = '';
    const b = document.getElementById('neural-memory-input'); if (b) b.value = '';
    printToTerminal("[SYSTEM] Neural memory cleared.", "sys-msg-colored");
};

// --- Owner-only DEV PANEL ---
window.showDiagnostics = function() {
    const panel = document.getElementById('dev-panel');
    if (!panel) return;
    panel.classList.add('open');
    renderDevPanel();
};

window.toggleDevPanel = function() {
    const panel = document.getElementById('dev-panel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) renderDevPanel();
};

// Per-file one-liner descriptions for the script viewer dropdown
const _DEV_FILE_INFO = {
    "main.py":                     "FastAPI app · all routes, WS, AI dispatch, telemetry",
    "prompts.py":                  "CORE_RULES + per-mode system prompts + tool tag rules",
    "nexus.py":                    "macOS Spotify/Music osascript bridge",
    "providers/registry.py":       "TOOLS list + dispatcher entries (single source of truth)",
    "providers/_keys.py":          "Reads API keys from .env, sanitizes whitespace",
    "providers/groq.py":           "Groq chat completions (Llama 70B / 8B)",
    "providers/gemini.py":         "Google Gemini chat + vision (image_b64 path)",
    "providers/hf_chat.py":        "HF router chat (Hermes, etc.)",
    "providers/hf_vision.py":      "HF vision + classify_intent + zero-shot + OCR",
    "providers/hf_audio.py":       "HF Whisper STT + MMS-TTS (paid tier)",
    "providers/hf_image.py":       "FLUX.1-schnell + Pollinations (unfiltered bypass)",
    "providers/hf_text.py":        "Translate (Helsinki opus-mt) · summarize · sentiment · emotion · embed",
    "providers/web_tools.py":      "Web search (DDG) · Wikipedia · math (SymPy) · chart (QuickChart)",
    "static/index.html":           "Terminal page shell + script load order",
    "static/login.html":           "Lobby + Google sign-in + dev-owner button + terms modal",
    "static/style.css":            "Desktop styles, panel chrome, accessibility classes",
    "static/mobile.css":           "≤700px overrides — drawer sidebar, touch sizing",
    "static/nexus_globals.js":     "window.* state, MODE_COLORS, thinking indicator",
    "static/nexus_brain.js":       "Boot orchestrator, focus, mobile drawer, draggable panels",
    "static/config_core.js":       "MODES + boot words + history-key map",
    "static/auth_core.js":         "Google sign-in, guest auth, terms modal, profile dropdown",
    "static/ai_core.js":           "prompt_ai_proxy + AI tool tag dispatch + inline renderers",
    "static/ai_tools_core.js":     "Per-tool modal handlers + tool registry fetch",
    "static/commands_core.js":     "Slash commands: help/tips/export/play/diag/etc.",
    "static/terminal.js":          "Boot sequence, WS, mode switcher, AI Profile, DEV PANEL",
    "static/crash_core.js":        "window.onerror → diagnostic code + overlay + transmit",
    "static/uplink_core.js":       "_px_transmit → workers.dev (chat + crash telemetry)",
    "static/games_core.js":        "All 8 in-terminal games + matrix saver + typing test",
    "static/audio_core.js":        "SoundManager (Web Audio)",
    "static/tts_core.js":          "Browser SpeechSynthesis voice settings",
    "static/stats_core.js":        "CPU/MEM telemetry display",
    "static/core_modules/speedtest_logic.js": "Speed test UI",
    "static/core_modules/hardware_logic.js":  "Maintenance hub UI",
};

// Tab switcher for the OWNER DEV PANEL — shows only sections matching `data-tab="<name>"`,
// dims the tab buttons that don't match, persists last-used tab to localStorage so
// reopening the panel returns you to the same section.
window._devSwitchTab = function(name) {
    try {
        const panel = document.getElementById('dev-panel');
        if (!panel) { console.warn('[devSwitchTab] no panel'); return; }
        const tabs = panel.querySelectorAll('.fp-tab');
        const sections = panel.querySelectorAll('.fp-section[data-tab]');
        console.log(`[devSwitchTab] target=${name} tabs=${tabs.length} sections=${sections.length}`);
        tabs.forEach(btn => {
            const isActive = btn.dataset.tab === name;
            btn.classList.toggle('active', isActive);
            btn.style.setProperty('color', isActive ? '#fa0' : '#888', 'important');
            btn.style.borderBottomColor = isActive ? '#fa0' : 'transparent';
            btn.style.textShadow = isActive ? '0 0 10px #fa0' : 'none';
            if (isActive && btn.scrollIntoView) {
                try { btn.scrollIntoView({behavior:'smooth', block:'nearest', inline:'nearest'}); } catch(_) {}
            }
        });
        let visibleCount = 0;
        let firstVisible = null;
        sections.forEach(sec => {
            const match = sec.dataset.tab === name;
            // Use 'flex' explicitly (matches style.css .fp-section { display: flex }) so
            // we never rely on the empty-string-resets-to-CSS-default behavior, which
            // some browsers handle inconsistently when grid is the parent.
            sec.style.display = match ? 'flex' : 'none';
            if (match) {
                visibleCount++;
                if (!firstVisible) firstVisible = sec;
            }
        });
        // Defensive fallback — if a tab somehow has zero sections, show a clear placeholder
        // instead of a blank panel.
        let placeholder = panel.querySelector('#fp-empty-placeholder');
        if (visibleCount === 0) {
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.id = 'fp-empty-placeholder';
                placeholder.style.cssText = 'padding:24px; color:#888; font-size:0.78rem; text-align:center; border:1px dashed rgba(255,255,255,0.1); border-radius:8px; margin:8px 0;';
                const grid = panel.querySelector('#fp-grid');
                if (grid) grid.appendChild(placeholder);
                else panel.appendChild(placeholder);
            }
            placeholder.textContent = `(no sections under "${name.toUpperCase()}" — open another tab)`;
            placeholder.style.display = '';
        } else if (placeholder) {
            placeholder.style.display = 'none';
        }
        // Reset panel-inner scroll to top so the sticky fp-header stays visible.
        // (The previous firstVisible.scrollIntoView({block:'start'}) scrolled PAST
        // the header's sticky threshold and made it disappear — exactly the bug
        // Xavier hit on every tab switch.)
        const inner = panel.querySelector('.panel-inner');
        if (inner) inner.scrollTop = 0;
        try { localStorage.setItem('nexus_dev_panel_tab', name); } catch(_) {}
    } catch (e) {
        console.error('[devSwitchTab] error:', e);
    }
};

async function renderDevPanel() {
    const panel = document.getElementById('dev-panel');
    if (!panel) return;
    // Inline-override only the gap (style.css sets gap:26px → drop to 12px).
    // KEEP padding at the original 26px 28px so the fp-header's negative-margin trick
    // (margin:-26px -28px) still aligns flush to the panel edges.
    panel.innerHTML = `
        <div class="panel-inner" style="gap:12px;">
            <!-- Override the LOBBY-LOCKED .fp-header sticky/negative-margin styling
                 (which was causing the header to disappear after tab clicks): force
                 a plain in-flow header with a solid background that's always at the
                 top of the panel content area. -->
            <div class="fp-header" style="position:relative !important; top:auto !important; margin:0 0 14px 0 !important; padding:14px 18px !important; box-shadow:none !important; background:rgba(8,14,26,0.98); border-bottom:1px solid rgba(255,170,0,0.25); display:flex !important; align-items:center; justify-content:space-between; gap:14px;">
                <div class="fp-title" style="color:#fa0 !important; text-shadow:0 0 14px #fa0; font-size:1.1rem; font-weight:800; letter-spacing:4px; margin:0;">[ OWNER DEV PANEL ]</div>
                <button class="fp-close" onclick="window.toggleDevPanel()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#aaa; padding:6px 14px; border-radius:6px; cursor:pointer; font-family:inherit; font-size:0.7rem; letter-spacing:2px; font-weight:700;">CLOSE</button>
            </div>

            <!-- Underline tab bar — centered horizontally, equal spacing between tabs,
                 minimal & transparent. Active tab marked with an orange underline + glow.
                 Each tab carries a small inline SVG icon (currentColor stroke). No emojis. -->
            <div id="fp-tabs" style="display:flex !important; flex-wrap:wrap; gap:0; margin:0 0 8px; padding:0; border-bottom:1px solid rgba(255,255,255,0.08);">
                <button class="fp-tab" data-tab="status"  onclick="window._devSwitchTab('status')"  style="display:inline-flex !important; align-items:center; justify-content:center; gap:8px; flex:1 1 0; min-width:0; background:transparent !important; border:none; border-bottom:2px solid transparent; color:#888 !important; padding:9px 8px; margin-bottom:-1px; font-family:'Fira Code',monospace !important; font-weight:700 !important; font-size:0.66rem !important; letter-spacing:1.5px !important; text-transform:uppercase; cursor:pointer; white-space:nowrap; transition:0.18s;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0; pointer-events:none;"><path d="M2 6 Q8 0 14 6"/><path d="M4 9 Q8 5 12 9"/><circle cx="8" cy="12" r="1" fill="currentColor"/></svg>STATUS</button>
                <button class="fp-tab" data-tab="routing" onclick="window._devSwitchTab('routing')" style="display:inline-flex !important; align-items:center; justify-content:center; gap:8px; flex:1 1 0; min-width:0; background:transparent !important; border:none; border-bottom:2px solid transparent; color:#888 !important; padding:9px 8px; margin-bottom:-1px; font-family:'Fira Code',monospace !important; font-weight:700 !important; font-size:0.66rem !important; letter-spacing:1.5px !important; text-transform:uppercase; cursor:pointer; white-space:nowrap; transition:0.18s;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; pointer-events:none;"><path d="M2 8 H6 L10 4 H14"/><path d="M6 8 L10 12 H14"/><path d="M11 5 L14 4 L13 7"/><path d="M11 11 L14 12 L13 9"/></svg>ROUTING</button>
                <button class="fp-tab" data-tab="keys"    onclick="window._devSwitchTab('keys')"    style="display:inline-flex !important; align-items:center; justify-content:center; gap:8px; flex:1 1 0; min-width:0; background:transparent !important; border:none; border-bottom:2px solid transparent; color:#888 !important; padding:9px 8px; margin-bottom:-1px; font-family:'Fira Code',monospace !important; font-weight:700 !important; font-size:0.66rem !important; letter-spacing:1.5px !important; text-transform:uppercase; cursor:pointer; white-space:nowrap; transition:0.18s;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0; pointer-events:none;"><circle cx="5" cy="8" r="3"/><path d="M8 8 H14"/><path d="M12 8 V11"/><path d="M14 8 V10"/></svg>KEYS</button>
                <button class="fp-tab" data-tab="users"   onclick="window._devSwitchTab('users')"   style="display:inline-flex !important; align-items:center; justify-content:center; gap:8px; flex:1 1 0; min-width:0; background:transparent !important; border:none; border-bottom:2px solid transparent; color:#888 !important; padding:9px 8px; margin-bottom:-1px; font-family:'Fira Code',monospace !important; font-weight:700 !important; font-size:0.66rem !important; letter-spacing:1.5px !important; text-transform:uppercase; cursor:pointer; white-space:nowrap; transition:0.18s;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0; pointer-events:none;"><circle cx="8" cy="5" r="2.5"/><path d="M3 14 Q3 9 8 9 Q13 9 13 14"/></svg>USERS</button>
                <button class="fp-tab" data-tab="debug"   onclick="window._devSwitchTab('debug')"   style="display:inline-flex !important; align-items:center; justify-content:center; gap:8px; flex:1 1 0; min-width:0; background:transparent !important; border:none; border-bottom:2px solid transparent; color:#888 !important; padding:9px 8px; margin-bottom:-1px; font-family:'Fira Code',monospace !important; font-weight:700 !important; font-size:0.66rem !important; letter-spacing:1.5px !important; text-transform:uppercase; cursor:pointer; white-space:nowrap; transition:0.18s;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0; pointer-events:none;"><ellipse cx="8" cy="9" rx="3" ry="4"/><path d="M8 5 V3"/><path d="M6 4 L8 3 L10 4"/><path d="M2 8 H5"/><path d="M11 8 H14"/><path d="M2 12 L5 11"/><path d="M11 11 L14 12"/></svg>DEBUG</button>
            </div>

            <!-- Section grid — auto-fits cards side-by-side on wide screens, single
                 column on mobile. Hidden sections (display:none from _devSwitchTab)
                 don't reserve grid cells, so the visible ones always fill smoothly. -->
            <div id="fp-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:14px; margin:0;">

            <div class="fp-section" data-tab="debug">
                <h3 class="fp-section-title">BACKEND CONTROL</h3>
                <p class="fp-section-help">After editing Python files (providers, prompts, etc.) the backend has to be restarted before changes take effect. RESET MY STRIKES wipes your local strike counters (Unfiltered chaos, NSFW, hostility) so you can test from a clean state.</p>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <button onclick="window._devRestartBackend()"
                            style="padding:10px 22px; cursor:pointer; background:transparent; color:#fa0; border:1px solid #fa0; border-radius:6px; font-family:var(--font-main); font-weight:800; letter-spacing:2px; font-size:0.75rem; text-transform:uppercase; transition:0.18s;"
                            onmouseover="this.style.background='#fa0'; this.style.color='#000'; this.style.boxShadow='0 0 14px #fa0';"
                            onmouseout="this.style.background='transparent'; this.style.color='#fa0'; this.style.boxShadow='none';">RESTART BACKEND</button>
                    <button onclick="window._devResetMyStrikes && window._devResetMyStrikes()"
                            style="padding:10px 18px; cursor:pointer; background:transparent; color:#0f8; border:1px solid #0f8; border-radius:6px; font-family:var(--font-main); font-weight:700; letter-spacing:2px; font-size:0.72rem; text-transform:uppercase; transition:0.18s;"
                            onmouseover="this.style.background='rgba(0,255,136,0.12)'; this.style.boxShadow='0 0 10px #0f8';"
                            onmouseout="this.style.background='transparent'; this.style.boxShadow='none';">RESET MY STRIKES</button>
                    <span id="dev-restart-status" style="color:#888; font-size:0.7rem;"></span>
                </div>
            </div>

            <div class="fp-section" data-tab="keys">
                <h3 class="fp-section-title">API KEYS · EDITOR</h3>
                <p class="fp-section-help">Set or update any API key directly. Saves to <code>.env</code> on disk and reloads in-process — no backend restart needed for the new value to take effect.</p>
                <div id="dev-env-editor"><em style="color:#666; font-size:0.78rem;">loading…</em></div>
            </div>

            <div class="fp-section" data-tab="debug">
                <h3 class="fp-section-title">CLIENT CRASH LOG (last 20)</h3>
                <p class="fp-section-help">Crashes captured by <code>window.onerror</code> + <code>unhandledrejection</code> in this browser. Each row has the diagnostic code you can grep in your Discord forum to find the matching report.</p>
                <div id="dev-crashes"></div>
                <div class="fp-action-row" style="margin-top:10px;">
                    <button class="fp-btn-danger" style="padding:8px 14px; cursor:pointer;" onclick="if(confirm('Wipe local crash log?')){localStorage.removeItem('nexus_crash_log'); renderDevPanel();}">CLEAR CRASH LOG</button>
                </div>
            </div>

            <div class="fp-section" data-tab="debug">
                <h3 class="fp-section-title">LIVE SYSTEM PROMPT</h3>
                <p class="fp-section-help">The exact prompt currently driving Nexus. Pick a mode to inspect what's making it behave the way it does. Use this when iterating on the prompt.</p>
                <select id="dev-prompt-mode" class="fp-select" onchange="window._devLoadPrompt()">
                    <option value="nexus">NEXUS</option>
                    <option value="coder">CODER</option>
                    <option value="education">EDUCATION</option>
                    <option value="unfiltered">UNFILTERED</option>
                </select>
                <div id="dev-prompt-model" style="margin-top:8px; padding:8px 12px; background:rgba(0,0,0,0.3); border-left:3px solid var(--accent); border-radius:4px; font-size:0.72rem; color:#9ce; line-height:1.55;">Pick a mode to see which LLM it routes to.</div>
                <textarea id="dev-prompt-view" class="fp-textarea" readonly placeholder="Pick a mode → loads its current system prompt"></textarea>
            </div>

            <!-- IP BLOCKLIST + ACTIVE LOCKOUTS — paired at top of USERS tab. The fp-grid
                 (auto-fit, 360px min) will lay them side-by-side on wide screens, stacked
                 on mobile. Both are user-management actions; pairing makes the relationship
                 clear (block someone permanently vs. they're temporarily locked out). -->
            <div class="fp-section" data-tab="users">
                <h3 class="fp-section-title">IP BLOCKLIST</h3>
                <p class="fp-section-help">Permanently block an IP from <code>/api/chat</code>. Once blocked, that user cannot send any prompt to the AI until you unblock them. Use for repeat abusers from moderation alerts.</p>
                <div id="dev-blocklist"><em style="color:#666;">loading…</em></div>
                <div style="display:flex; gap:8px; margin-top:10px; align-items:stretch;">
                    <input type="text" id="dev-block-ip" class="fp-select" style="flex:1; height:40px; box-sizing:border-box;" placeholder="e.g. 203.0.113.42">
                    <button onclick="window._devBlockIp()"
                            style="padding:0 22px; height:40px; cursor:pointer; background:rgba(255,68,68,0.12); color:#f88; border:1px solid #f55; border-radius:6px; font-family:var(--font-main); font-weight:800; letter-spacing:2px; font-size:0.75rem; text-transform:uppercase; transition:0.18s; display:inline-flex; align-items:center; gap:6px;"
                            onmouseover="this.style.background='#f55'; this.style.color='#000'; this.style.boxShadow='0 0 12px #f55';"
                            onmouseout="this.style.background='rgba(255,68,68,0.12)'; this.style.color='#f88'; this.style.boxShadow='none';">BLOCK</button>
                </div>
            </div>

            <div class="fp-section" data-tab="users">
                <h3 class="fp-section-title">ACTIVE LOCKOUTS</h3>
                <p class="fp-section-help">Temporary lockouts triggered by hostility / repeat-strike detection. Server-enforced (tamper-proof: clearing browser storage doesn't bypass). Click REVOKE to let the user back in early on appeal.</p>
                <div id="dev-lockouts"><em style="color:#666;">loading…</em></div>
            </div>

            <div class="fp-section" data-tab="users">
                <h3 class="fp-section-title">PREMIUM USERS</h3>
                <p class="fp-section-help">Grant premium access (10 images/day → <b style="color:#0f8;">100/day</b>) to donors, friends, beta testers. They'll see a PREMIUM badge in their dropdown. Owner is always premium implicitly.</p>
                <input type="text" id="dev-premium-search" placeholder="filter your premium list by email or note…" oninput="window._devFilterPremium && window._devFilterPremium(this.value)" style="width:100%; padding:8px 10px; margin-bottom:10px; background:rgba(0,0,0,0.4); color:#fff; border:1px solid rgba(255,170,0,0.25); border-radius:5px; font-family:var(--font-main); font-size:0.7rem;">
                <div id="dev-premium-list" style="margin-bottom:14px;"><em style="color:#666; font-size:0.78rem;">loading…</em></div>
                <div style="border-top:1px dashed rgba(255,255,255,0.10); padding-top:14px;">
                    <div style="color:#fa0; font-weight:800; letter-spacing:1.5px; font-size:0.65rem; margin-bottom:8px;">GRANT PREMIUM</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div>
                            <label style="display:block; color:#aaa; font-size:0.6rem; letter-spacing:1.5px; margin-bottom:4px;">USER EMAIL</label>
                            <input type="email" id="dev-premium-email" class="fp-select" placeholder="user@gmail.com" style="width:100%; font-family:'Fira Code',monospace; font-size:0.72rem;">
                        </div>
                        <div>
                            <label style="display:block; color:#aaa; font-size:0.6rem; letter-spacing:1.5px; margin-bottom:4px;">DAYS OF PREMIUM ACCESS</label>
                            <input type="number" id="dev-premium-days" class="fp-select" placeholder="e.g. 30 (leave empty for LIFETIME)" min="1" style="width:100%; font-family:'Fira Code',monospace; font-size:0.72rem;">
                        </div>
                        <div>
                            <label style="display:block; color:#aaa; font-size:0.6rem; letter-spacing:1.5px; margin-bottom:4px;">PRIVATE NOTE (owner-only — not shown to user)</label>
                            <input type="text" id="dev-premium-note" class="fp-select" placeholder="e.g. donated $5 via Ko-fi · beta tester · friend" style="width:100%; font-family:'Fira Code',monospace; font-size:0.72rem;">
                        </div>
                        <button class="fp-btn-primary" style="padding:10px; cursor:pointer; margin-top:4px;" onclick="window._devGrantPremium()">GRANT PREMIUM</button>
                    </div>
                </div>
            </div>

            <div class="fp-section" data-tab="users">
                <h3 class="fp-section-title">BAN SCREEN PREVIEW</h3>
                <p class="fp-section-help">See what a banned user actually sees. Owner doesn't trigger the ban screen normally, so this is the only way to inspect what they encounter.</p>
                <button class="fp-btn-primary" style="padding:10px 18px; border:none; cursor:pointer;" onclick="window._showBanScreen('PREVIEW · This is what a banned user sees. Click X to close.')">PREVIEW BAN SCREEN</button>
            </div>

            <div class="fp-section" data-tab="routing">
                <h3 class="fp-section-title">IMAGE MODEL SELECTOR</h3>
                <p class="fp-section-help">Image generation is SFW only and gated to Google-signed users (guests are blocked). <b>PAID PRIMARY:</b> Replicate Flux-schnell at ~$0.003/image (~5,000 images per $15). <b>FREE FALLBACK:</b> Pollinations Flux when Replicate fails or for localhost dev.</p>
                <div style="display:flex; flex-direction:column; gap:18px; margin-top:8px;">
                    <div style="border:1px solid rgba(255,170,0,0.22); border-radius:8px; padding:14px 16px; background:rgba(255,170,0,0.04);">
                        <div style="color:#fa0; font-size:0.78rem; letter-spacing:2px; font-weight:800; margin-bottom:10px;">PAID · REPLICATE (primary)</div>
                        <p style="color:#888; font-size:0.62rem; margin:0 0 12px; line-height:1.5;">Pick which SFW Replicate model serves Google-signed users. Default <b>flux-schnell</b> ($0.003/img) is the best quality-per-dollar. Cheaper options drop quality slightly; pinned options let you lock to a specific model regardless of what Replicate updates.</p>
                        <select id="dev-img-replicate" class="fp-select" style="width:100%;"><option>loading…</option></select>
                        <p id="dev-img-replicate-hint" style="color:#fcb; font-size:0.62rem; margin:6px 0 0; opacity:0.85;">Set <code>REPLICATE_DISABLE=1</code> in KEYS to bypass paid and route everyone to free Pollinations.</p>
                    </div>
                    <div style="border:1px solid rgba(0,255,128,0.18); border-radius:8px; padding:14px 16px; background:rgba(0,255,128,0.03);">
                        <div style="color:#0f8; font-size:0.78rem; letter-spacing:2px; font-weight:800; margin-bottom:10px;">FREE · POLLINATIONS (fallback)</div>
                        <p style="color:#888; font-size:0.62rem; margin:0 0 12px; line-height:1.5;">Used when Replicate fails or paid tier is disabled. Default <b>flux</b> = best general quality. <b>turbo</b> = faster, lower fidelity. <b>dreamshaper</b> = stylized / illustrative.</p>
                        <select id="dev-img-free" class="fp-select" style="width:100%;"><option>loading…</option></select>
                        <p id="dev-img-free-hint" style="color:#9fc; font-size:0.62rem; margin:6px 0 0; opacity:0.85;"></p>
                    </div>
                    <!-- Hidden legacy dropdowns kept in DOM so _devLoadImageModels / _devSaveImageModels
                         don't crash on missing element references. They're invisible. -->
                    <!-- Hidden compat stubs for legacy save/load wiring (will be removed
                         once _devSaveImageModels is fully refactored to only the 2 fields we use). -->
                    <select id="dev-img-tier"             style="display:none;"></select>
                    <select id="dev-img-fal"              style="display:none;"></select>
                    <select id="dev-img-civitai"          style="display:none;"></select>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        <button onclick="window._devSaveImageModels()"
                                style="padding:10px 22px; cursor:pointer; background:var(--accent); color:#000; border:none; border-radius:6px; font-family:var(--font-main); font-weight:800; letter-spacing:2px; font-size:0.75rem; text-transform:uppercase; transition:0.18s;"
                                onmouseover="this.style.boxShadow='0 0 14px var(--accent)'; this.style.transform='translateY(-1px)';"
                                onmouseout="this.style.boxShadow='none'; this.style.transform='none';">SAVE</button>
                        <span id="dev-img-status" style="margin-left:auto; font-size:0.7rem; color:#888;"></span>
                    </div>
                    <div id="dev-img-test-result" style="margin-top:10px; font-size:0.7rem; line-height:1.5;"></div>
                </div>
            </div>

            <div class="fp-section" data-tab="status">
                <h3 class="fp-section-title">BACKEND LOG</h3>
                <p class="fp-section-help">Last ~100 lines of backend output. Auto-refreshes every 3s while streaming. Scroll up to read/copy — auto-follow only kicks in when you're at the bottom.</p>
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <button id="dev-log-toggle" onclick="window._devToggleLogTail()" style="padding:8px 16px; cursor:pointer; background:transparent; color:#0f8; border:1px solid #0f8; border-radius:5px; font-family:var(--font-main); font-weight:700; letter-spacing:1.5px; font-size:0.7rem;">START LIVE TAIL</button>
                    <span id="dev-log-status" style="align-self:center; font-size:0.65rem; color:#888;"></span>
                </div>
                <pre id="dev-log-output" style="background:#000; color:#9fc; border:1px solid rgba(0,255,136,0.25); border-radius:6px; padding:10px 12px; font-family:var(--font-main); font-size:0.62rem; line-height:1.45; max-height:340px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; margin:0;">click START LIVE TAIL to begin streaming…</pre>
            </div>

            <div class="fp-section" data-tab="debug">
                <h3 class="fp-section-title">SCRIPT VIEWER</h3>
                <p class="fp-section-help">Read-only view of any project source file (server-side allowlist). Pick a file → LOAD. Useful for grabbing exact line numbers when reporting bugs.</p>
                <select id="dev-file" class="fp-select"><option>loading…</option></select>
                <p class="fp-section-help" id="dev-file-info" style="margin-top:8px; min-height:20px;"></p>
                <button class="fp-btn-primary" style="align-self:flex-start; padding:10px 18px; border:none; cursor:pointer;" onclick="window._devLoadFile()">LOAD</button>
                <textarea id="dev-source" class="fp-textarea" readonly placeholder="Pick a file and click LOAD…"></textarea>
            </div>

            </div><!-- /#fp-grid -->
        </div>
    `;

    // Restore the last-used tab (or default to STATUS for first-time use).
    // Stashed in localStorage so reopening the panel jumps back to where you were.
    const savedTab = (function(){ try { return localStorage.getItem('nexus_dev_panel_tab'); } catch(_) { return null; } })();
    window._devSwitchTab(savedTab && ['status','routing','keys','users','debug'].includes(savedTab) ? savedTab : 'status');

    // Load image-model selection (populates the IMAGE MODEL SELECTOR dropdowns)
    if (window._devLoadImageModels) try { window._devLoadImageModels(); } catch(_) {}

    // Load API key editor — owner can paste/save any key without touching .env directly
    (async function loadEnvEditor() {
        const host = document.getElementById('dev-env-editor');
        if (!host) return;
        try {
            const r = await fetch(`${window.API_BASE || ''}/api/dev/env`, { credentials: 'same-origin' });
            const data = await r.json();
            if (data.error) { host.innerHTML = `<span class="fp-badge err">${data.error}</span>`; return; }
            const KEY_BLURBS = {
                GEMINI_API_KEY:     'Google Gemini chat + vision · aistudio.google.com/apikey',
                GROQ_API_KEY:       'Groq Llama chat (fastest LLM) · console.groq.com/keys',
                HF_API_KEY:         'HuggingFace inference (audio + image SDXL backup) · huggingface.co/settings/tokens',
                REPLICATE_API_KEY:  'Replicate paid SFW image gen (~$0.003/img) · replicate.com/account/api-tokens',
                POLLINATIONS_TOKEN: 'Pollinations priority queue (no rate limits) · auth.pollinations.ai',
                DISCORD_WEBHOOK:    'Discord webhook for telemetry/alerts · server settings → integrations',
                FORCE_PAID_LOCAL:   'Set to "1" to let localhost test paid Replicate. Empty = free chain forced on 127.0.0.1 to protect budget.',
                REPLICATE_SFW_MODEL:'Override default SFW Replicate model. Empty = black-forest-labs/flux-schnell ($0.003/img). Cheaper: bytedance/sdxl-lightning-4step ($0.0007), stability-ai/sdxl ($0.0017).',
                REPLICATE_DISABLE:  'Set to "1" to bypass Replicate entirely (e.g. budget exhausted). All users fall to free Pollinations.',
                DISCORD_OWNER_USER_ID: 'Your Discord user ID (NUMERIC, not username). Critical/high moderation alerts ping <@id> only — never @everyone. To find: Discord → Settings → Advanced → Developer Mode ON → right-click your name → Copy User ID.',
            };
            const rows = Object.entries(data).map(([key, val]) => {
                // Prominent status pill — green "SET" or red "EMPTY" so the API key state is
                // immediately visible per-row. Length shown in muted text next to it.
                const isSet = !!val;
                const statusBadge = isSet
                    ? `<span style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:4px; background:rgba(0,255,136,0.15); border:1px solid #0f8; color:#0f8; font-size:0.6rem; font-weight:800; letter-spacing:1.5px;">SET <span style="color:#9fc; font-weight:600;">· ${val.length} chars</span></span>`
                    : `<span style="display:inline-flex; align-items:center; padding:3px 10px; border-radius:4px; background:rgba(255,68,68,0.12); border:1px solid #f55; color:#f88; font-size:0.6rem; font-weight:800; letter-spacing:1.5px;">EMPTY</span>`;
                const blurb = KEY_BLURBS[key] || '';
                return `
                <div style="padding:12px 14px; border:1px solid ${isSet ? 'rgba(0,255,136,0.18)' : 'rgba(255,68,68,0.18)'}; border-radius:6px; background:rgba(0,0,0,0.30); margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <code style="flex:1; color:#0ff; font-weight:700; font-size:0.72rem; letter-spacing:1px;">${key}</code>
                        ${statusBadge}
                    </div>
                    ${blurb ? `<p style="color:#888; font-size:0.62rem; margin:0 0 8px; line-height:1.45;">${blurb}</p>` : ''}
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="dev-env-${key}" value="${(val || '').replace(/"/g, '&quot;')}" placeholder="paste new value here…" style="flex:1; padding:7px 10px; background:#000; color:#0ff; border:1px solid rgba(0,255,255,0.25); border-radius:5px; font-family:'Fira Code',monospace; font-size:0.65rem;">
                        <button onclick="window._devSaveEnvKey('${key}')" style="padding:7px 14px; cursor:pointer; background:var(--accent); color:#000; border:none; border-radius:5px; font-family:var(--font-main); font-weight:800; letter-spacing:1.5px; font-size:0.65rem; text-transform:uppercase;">SAVE</button>
                    </div>
                </div>`;
            }).join('');
            host.innerHTML = rows;
        } catch (e) {
            host.innerHTML = `<span class="fp-badge err">${e.message}</span>`;
        }
    })();

    // IMAGE TIER STATUS section was removed — its loader (loadGpuStatus) is gone with it.

    // Load premium users list
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/premium`, { credentials: 'same-origin' });
        const data = await r.json();
        const host = document.getElementById('dev-premium-list');
        if (host) {
            const list = data.users || [];
            host.innerHTML = list.length ? list.map(u => `
                <div style="display:flex; align-items:center; gap:10px; padding:6px 10px; border:1px solid rgba(255,170,0,0.15); border-radius:6px; background:rgba(0,0,0,0.25); margin:4px 0;">
                    <span style="color:${u.active ? '#fa0' : '#666'}; font-weight:800; font-size:0.6rem; letter-spacing:1px;">${u.active ? '[ON]' : '[EXP]'}</span>
                    <code style="flex:1; color:${u.active ? '#fff' : '#666'};">${u.email}</code>
                    <span style="color:#888; font-size:0.65rem;">${u.expires_at === '(lifetime)' ? 'lifetime' : new Date(u.expires_at).toLocaleDateString()}</span>
                    ${u.note ? `<span style="color:#9ce; font-size:0.65rem; font-style:italic;">${u.note}</span>` : ''}
                    <button class="fp-btn-ghost" style="padding:4px 10px; cursor:pointer;" onclick="window._devRevokePremium('${u.email}')">REVOKE</button>
                </div>
            `).join('') : '<em style="color:#666; font-size:0.78rem;">No premium users yet. Donor at https://buymeacoffee.com/thyfwx? Grant them premium below.</em>';
        }
    } catch (e) { /* ignore */ }

    // API KEY STATUS section was removed — its loader is gone with it. The KEYS tab's
    // editor (loaded above via /api/dev/env) shows the same SET/EMPTY info inline next
    // to each editable field, so the read-only section was redundant.

    // Load crash log — card-based layout, scrollable, click to expand for full details.
    try {
        const log = JSON.parse(localStorage.getItem('nexus_crash_log') || '[]');
        const host = document.getElementById('dev-crashes');
        if (!log.length) {
            host.innerHTML = '<em style="color:#666; font-size:0.78rem;">No crashes recorded. Quiet, the way we like it.</em>';
        } else {
            const cards = log.slice(0, 20).map((c, i) => `
                <details style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,68,68,0.18); border-radius:5px; margin-bottom:6px; overflow:hidden;">
                    <summary style="padding:8px 12px; cursor:pointer; display:flex; gap:10px; align-items:center; font-size:0.7rem; list-style:none;">
                        <code style="color:#f88; font-weight:700; flex-shrink:0;">${(c.code || '?').slice(0, 12)}</code>
                        <span style="color:#888; flex-shrink:0; font-size:0.62rem;">${c.ts || ''}</span>
                        <span style="color:#aaa; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${(c.msg || 'no message').slice(0, 100)}</span>
                    </summary>
                    <div style="padding:8px 12px 10px 12px; border-top:1px solid rgba(255,255,255,0.05); font-size:0.62rem; color:#9ce; line-height:1.55;">
                        <div><b style="color:#888;">Code:</b> <code>${c.code || '?'}</code></div>
                        <div><b style="color:#888;">User:</b> <code>${c.user || 'anonymous'}</code></div>
                        <div><b style="color:#888;">Location:</b> <code>${c.loc || '—'}</code></div>
                        <div style="margin-top:4px;"><b style="color:#888;">Full message:</b></div>
                        <pre style="margin:4px 0 0; padding:6px 8px; background:rgba(0,0,0,0.4); border-radius:3px; color:#fcc; font-size:0.6rem; white-space:pre-wrap; word-break:break-word; max-height:120px; overflow-y:auto;">${(c.msg || '').replace(/[<>]/g, ch => ch === '<' ? '&lt;' : '&gt;')}</pre>
                    </div>
                </details>`).join('');
            host.innerHTML = `<div style="max-height:380px; overflow-y:auto; padding-right:4px;">${cards}</div>`;
        }
    } catch { document.getElementById('dev-crashes').innerHTML = '<em style="color:#666;">log unreadable</em>'; }

    // Load blocklist
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/blocklist`, { credentials: 'same-origin' });
        const data = await r.json();
        const host = document.getElementById('dev-blocklist');
        if (host) {
            const ips = data.ips || [];
            host.innerHTML = ips.length
                ? ips.map(ip => `<div style="display:flex; align-items:center; gap:10px; padding:6px 10px; border:1px solid rgba(255,255,255,0.06); border-radius:6px; background:rgba(0,0,0,0.25); margin:4px 0;"><code style="flex:1; color:#fa0;">${ip}</code><button class="fp-btn-ghost" style="padding:4px 10px; cursor:pointer;" onclick="window._devUnblockIp('${ip}')">UNBLOCK</button></div>`).join('')
                : '<em style="color:#666; font-size:0.78rem;">No IPs blocked.</em>';
        }
    } catch (e) { /* ignore */ }

    // Load active server-side lockouts (separate from permanent IP blocks)
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/locked-users`, { credentials: 'same-origin' });
        const data = await r.json();
        const host = document.getElementById('dev-lockouts');
        if (host) {
            const list = data.locked || [];
            host.innerHTML = list.length
                ? list.map(l => {
                    const m = Math.floor(l.remaining_sec / 60), s = l.remaining_sec % 60;
                    return `<div style="display:flex; align-items:center; gap:10px; padding:6px 10px; border:1px solid rgba(255,255,255,0.06); border-radius:6px; background:rgba(0,0,0,0.25); margin:4px 0;">
                        <code style="flex:1; color:#f8a;">${l.key}</code>
                        <span style="color:#888; font-size:0.7rem; min-width:60px;">${m}m ${s}s left</span>
                        <button class="fp-btn-ghost" style="padding:4px 10px; cursor:pointer;" onclick="window._devRevokeLockout('${l.key.replace(/'/g, "\\'")}')">REVOKE</button>
                    </div>`;
                }).join('')
                : '<em style="color:#666; font-size:0.78rem;">No active lockouts.</em>';
        }
    } catch (e) { /* ignore */ }

    // Load file list + show description for the currently-selected file
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/files`, { credentials: 'same-origin' });
        const data = await r.json();
        const sel  = document.getElementById('dev-file');
        const info = document.getElementById('dev-file-info');
        if (data.files) {
            sel.innerHTML = data.files.map(f => `<option>${f}</option>`).join('');
            const updateInfo = () => {
                const desc = _DEV_FILE_INFO[sel.value] || 'No description.';
                if (info) info.innerHTML = `<span style="color:#888;">${desc}</span>`;
            };
            updateInfo();
            sel.onchange = updateInfo;
        } else {
            sel.innerHTML = `<option>${data.error || 'none'}</option>`;
        }
    } catch (e) { /* keep loading text */ }
}

window._devLoadPrompt = async function() {
    const sel = document.getElementById('dev-prompt-mode');
    const ta = document.getElementById('dev-prompt-view');
    const mi = document.getElementById('dev-prompt-model');
    if (!sel || !ta) return;
    ta.value = '// loading…';
    if (mi) mi.textContent = 'Loading…';
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/system-prompt?mode=${encodeURIComponent(sel.value)}`, { credentials: 'same-origin' });
        const data = await r.json();
        ta.value = data.error ? `// ERROR: ${data.error}` : data.prompt;
        if (mi && data.primary_model) {
            const chain = (data.fallback_chain || []).join(' → ');
            mi.innerHTML = `<b style="color:#0ff;">Primary model:</b> <code style="color:#fff;">${data.primary_model.id}</code> via <b>${data.primary_model.provider}</b> (label: ${data.primary_model.label})<br><span style="color:#888; font-size:0.66rem;">Fallback chain: ${chain}</span>`;
        } else if (mi) {
            mi.textContent = '';
        }
    } catch (e) { ta.value = `// FAILED: ${e.message}`; if (mi) mi.textContent = ''; }
};

window._devBlockIp = async function() {
    const inp = document.getElementById('dev-block-ip');
    if (!inp || !inp.value.trim()) return;
    const r = await fetch(`${window.API_BASE || ''}/api/dev/block`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: inp.value.trim() })
    });
    inp.value = '';
    if (r.ok) renderDevPanel();
};
window._devUnblockIp = async function(ip) {
    const r = await fetch(`${window.API_BASE || ''}/api/dev/unblock`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
    });
    if (r.ok) renderDevPanel();
};
window._devFilterPremium = function(needle) {
    needle = (needle || '').toLowerCase().trim();
    const host = document.getElementById('dev-premium-list');
    if (!host) return;
    Array.from(host.children).forEach(row => {
        const text = (row.textContent || '').toLowerCase();
        row.style.display = (!needle || text.includes(needle)) ? '' : 'none';
    });
};

window._devGrantPremium = async function() {
    const email = document.getElementById('dev-premium-email')?.value.trim();
    const days = document.getElementById('dev-premium-days')?.value.trim();
    const note = document.getElementById('dev-premium-note')?.value.trim();
    if (!email || !email.includes('@')) { alert('Need valid email'); return; }
    const r = await fetch(`${window.API_BASE || ''}/api/dev/premium/grant`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, days: days || null, note }),
    });
    const j = await r.json();
    if (j.ok) {
        document.getElementById('dev-premium-email').value = '';
        document.getElementById('dev-premium-days').value = '';
        document.getElementById('dev-premium-note').value = '';
        renderDevPanel();
    } else {
        alert('Grant failed: ' + (j.error || 'unknown'));
    }
};
window._devRevokePremium = async function(email) {
    if (!confirm(`Remove premium from ${email}?`)) return;
    const r = await fetch(`${window.API_BASE || ''}/api/dev/premium/revoke`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (r.ok) renderDevPanel();
};

window._devRevokeLockout = async function(key) {
    if (!confirm(`Revoke lockout for ${key}?`)) return;
    const r = await fetch(`${window.API_BASE || ''}/api/dev/revoke-lockout`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
    if (r.ok) renderDevPanel();
};

window._devLoadImageModels = async function() {
    // Simplified post-NSFW-purge: only two dropdowns — Replicate (paid SFW primary)
    // and Pollinations (free SFW fallback). Everything else was retired.
    const repSel  = document.getElementById('dev-img-replicate');
    const freeSel = document.getElementById('dev-img-free');
    if (!repSel || !freeSel) return;
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/image-models`, { credentials: 'same-origin' });
        const data = await r.json();
        if (data.error) return;

        // Localhost paid-tier banner — only surfaces when FORCE_PAID_LOCAL=1.
        const _h = (location.hostname || '').toLowerCase();
        const isLocal = _h === 'localhost' || _h === '127.0.0.1' || _h.startsWith('192.168.') || _h.startsWith('10.') || _h === '::1';
        const status = document.getElementById('dev-img-status');
        if (status) {
            status.innerHTML = (isLocal && data.force_paid_local) ? `
                <span style="display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:5px; background:rgba(255,170,0,0.10); border:1px solid rgba(255,170,0,0.40); color:#fa0; font-family:'Fira Code',monospace; font-weight:700; font-size:0.65rem; letter-spacing:1.5px;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#fa0; box-shadow:0 0 8px #fa0;"></span>
                    Local dev mode — paid tiers active
                </span>` : '';
        }

        // POLLINATIONS dropdown (free fallback)
        freeSel.innerHTML = (data.free_options || []).map(o =>
            `<option value="${o.path}" ${o.path === (data.current.free_model || '') ? 'selected' : ''}>${o.label}</option>`
        ).join('');

        // REPLICATE dropdown (paid SFW primary)
        const currentRep = data.current.replicate_model || '';
        repSel.innerHTML = (data.replicate_options || []).map(o =>
            `<option value="${o.path}" ${o.path === currentRep ? 'selected' : ''}>${o.label}</option>`
        ).join('');

        // Auto-save on change.
        freeSel.onchange = () => window._devSaveImageModels();
        repSel.onchange  = () => window._devSaveImageModels();
    } catch (e) { console.warn('image-models load failed:', e.message); }
};

window._devTestCivitai = async function() {
    const out = document.getElementById('dev-img-test-result');
    if (!out) return;
    out.innerHTML = '<span style="color:#0ff;">running test job against Civitai…</span>';
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/test-civitai`, {
            method: 'POST', credentials: 'same-origin',
        });
        const j = await r.json();
        if (j.ok) {
            out.innerHTML = `<div style="background:rgba(0,255,128,0.1); border-left:3px solid #0f8; padding:10px 14px; border-radius:4px; color:#9fc;">
                <b>✓ CIVITAI WORKING</b> · source: ${j.source} · received ${j.size_kb} KB image
            </div>`;
        } else {
            out.innerHTML = `<div style="background:rgba(255,68,68,0.12); border-left:3px solid #f55; padding:10px 14px; border-radius:4px; color:#fcc;">
                <b style="color:#f88;">✗ CIVITAI FAILED</b><br>
                <code style="display:block; margin-top:6px; padding:6px 8px; background:rgba(0,0,0,0.4); color:#ff8; font-size:0.68rem; word-break:break-all;">${(j.error || '').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;')}</code>
                <details style="margin-top:8px;"><summary style="cursor:pointer; color:#888;">show full traceback</summary>
                    <pre style="font-size:0.6rem; color:#666; white-space:pre-wrap; max-height:200px; overflow-y:auto; padding:6px; background:rgba(0,0,0,0.4); border-radius:4px; margin-top:4px;">${(j.traceback || 'no traceback').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;')}</pre>
                </details>
            </div>`;
        }
    } catch (e) {
        out.innerHTML = `<span style="color:#f55;">FAIL: ${e.message}</span>`;
    }
};

// Live log tail — polls /api/dev/log-tail every 3s while open
window._devLogTimer = null;
window._devToggleLogTail = function() {
    const btn = document.getElementById('dev-log-toggle');
    const status = document.getElementById('dev-log-status');
    if (window._devLogTimer) {
        clearInterval(window._devLogTimer);
        window._devLogTimer = null;
        if (btn) { btn.textContent = 'START LIVE TAIL'; btn.style.color = '#0f8'; btn.style.borderColor = '#0f8'; }
        if (status) status.textContent = 'paused';
        return;
    }
    if (btn) { btn.textContent = 'STOP LIVE TAIL'; btn.style.color = '#f55'; btn.style.borderColor = '#f55'; }
    if (status) status.textContent = 'streaming · 3s interval';
    const fetchOnce = async () => {
        try {
            const r = await fetch(`${window.API_BASE || ''}/api/dev/log-tail`, { credentials: 'same-origin', cache: 'no-store' });
            const j = await r.json();
            const out = document.getElementById('dev-log-output');
            if (!out) return;
            if (!j.ok) { out.textContent = `ERROR: ${j.error || 'unknown'}`; return; }
            // Capture scroll state BEFORE updating text — if user is at the bottom,
            // they want to follow new lines; if they scrolled up (to copy/read), respect it.
            const wasAtBottom = (out.scrollHeight - out.scrollTop - out.clientHeight) < 30;
            out.textContent = (j.lines || []).join('\n') || (j.note || '(empty log)');
            if (wasAtBottom) out.scrollTop = out.scrollHeight;
        } catch (_) {}
    };
    fetchOnce();
    window._devLogTimer = setInterval(fetchOnce, 3000);
};

window._devSaveEnvKey = async function(key) {
    const inp = document.getElementById('dev-env-' + key);
    if (!inp) return;
    const value = inp.value.trim();
    const btn = inp.nextElementSibling;
    if (btn) { btn.textContent = 'SAVING…'; btn.disabled = true; }
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/env`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
        });
        const j = await r.json();
        if (btn) {
            btn.textContent = j.ok ? '✓ SAVED' : '✗ FAILED';
            btn.style.background = j.ok ? '#0f8' : '#f55';
            btn.disabled = false;
            setTimeout(() => { btn.textContent = 'SAVE'; btn.style.background = 'var(--accent)'; }, 2200);
        }
    } catch (e) {
        if (btn) { btn.textContent = '✗ ERR'; btn.disabled = false; }
    }
};

// Owner-only: wipe all local strike counters so you can test lockout flows from
// a clean state. Doesn't touch server-side blocklist or active lockouts (those
// are tamper-proof by design).
window._devResetMyStrikes = function() {
    const keys = [
        'nexus_total_strikes',        // combined NSFW + hostility (Nexus/Coder/Education)
        'nexus_nsfw_strikes',         // legacy — old NSFW counter (cleared too for safety)
        'nexus_warn_standard',        // legacy — old hostility counter
        'nexus_unfiltered_strikes',   // Unfiltered chaos lockout ladder
        'nexus_lockout_count',        // generic lockout-tier counter
    ];
    keys.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
    window.unfilteredRage = 0;
    window._lastUnfilteredCmd = '';
    const status = document.getElementById('dev-restart-status');
    if (status) {
        status.textContent = 'Strikes wiped — clean slate.';
        status.style.color = '#0f8';
        setTimeout(() => { if (status) { status.textContent = ''; status.style.color = '#888'; } }, 4000);
    }
    if (window.printToTerminal) {
        window.printToTerminal('<span style="color:#0f8;">[ADMIN] Local strike counters reset. Unfiltered rage = 0. Next lockout starts at strike 1 (15s).</span>', 'sys-msg');
    }
};

window._devRestartBackend = async function() {
    if (!confirm('Restart the Nexus backend now? The page will become unresponsive for ~3 seconds.')) return;
    const status = document.getElementById('dev-restart-status');
    if (status) status.innerHTML = '<span style="color:#fa0;">restarting…</span>';
    try {
        await fetch(`${window.API_BASE || ''}/api/dev/restart-backend`, { method: 'POST', credentials: 'same-origin' });
    } catch (_) { /* the backend re-execs mid-response, fetch will likely error — that's expected */ }
    if (status) status.innerHTML = '<span style="color:#fa0;">re-execing… polling for backend to come back…</span>';
    // Poll /ping every 500ms until it returns OK, then auto-refresh dropdowns
    const t0 = Date.now();
    const poll = setInterval(async () => {
        try {
            const r = await fetch(`${window.API_BASE || ''}/ping`, { cache: 'no-store' });
            if (r.ok) {
                clearInterval(poll);
                if (status) status.innerHTML = `<span style="color:#0f8;">✓ backend back in ${Math.round((Date.now()-t0)/1000)}s — re-rendering panel…</span>`;
                setTimeout(() => renderDevPanel(), 400);
            }
        } catch (_) {}
        if (Date.now() - t0 > 30000) {
            clearInterval(poll);
            if (status) status.innerHTML = `<span style="color:#f55;">backend didn't come back in 30s — check that the launcher / process is auto-restarting</span>`;
        }
    }, 500);
};

window._devTestComfyUI = async function() {
    const out = document.getElementById('dev-img-test-result');
    if (!out) return;
    out.innerHTML = '<span style="color:#0ff;">running test job against your local ComfyUI box (free, ~30-60s)…</span>';
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/test-comfyui`, { method: 'POST', credentials: 'same-origin' });
        const j = await r.json();
        if (j.ok) {
            out.innerHTML = `<div style="background:rgba(0,255,128,0.1); border-left:3px solid #0f8; padding:10px 14px; border-radius:4px; color:#9fc;">
                <b>✓ COMFYUI WORKING</b><br>
                checkpoint: <code>${j.checkpoint_used}</code><br>
                source: <code>${j.source}</code> · received ${j.size_kb} KB image
            </div>`;
        } else {
            out.innerHTML = `<div style="background:rgba(255,68,68,0.12); border-left:3px solid #f55; padding:10px 14px; border-radius:4px; color:#fcc;">
                <b style="color:#f88;">✗ COMFYUI FAILED</b> — this is why your prompts are falling through to Pollinations.<br>
                URL: <code>${j.comfyui_url || '(unset)'}</code>
                <code style="display:block; margin-top:6px; padding:6px 8px; background:rgba(0,0,0,0.4); color:#ff8; font-size:0.68rem; word-break:break-all;">${(j.error || '').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;')}</code>
                <details style="margin-top:8px;"><summary style="cursor:pointer; color:#888;">show full traceback</summary>
                    <pre style="font-size:0.6rem; color:#666; white-space:pre-wrap; max-height:200px; overflow-y:auto; padding:6px; background:rgba(0,0,0,0.4); border-radius:4px; margin-top:4px;">${(j.traceback || 'no traceback').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;')}</pre>
                </details>
            </div>`;
        }
    } catch (e) {
        out.innerHTML = `<span style="color:#f55;">FAIL: ${e.message}</span>`;
    }
};

window._devTestReplicate = async function() {
    const out = document.getElementById('dev-img-test-result');
    if (!out) return;
    out.innerHTML = '<span style="color:#0ff;">running test job against Replicate using cheapest model (~$0.0014)…</span>';
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/test-replicate`, {
            method: 'POST', credentials: 'same-origin',
        });
        const j = await r.json();
        if (j.ok) {
            out.innerHTML = `<div style="background:rgba(0,255,128,0.1); border-left:3px solid #0f8; padding:10px 14px; border-radius:4px; color:#9fc;">
                <b>✓ REPLICATE WORKING</b><br>
                model: <code>${j.model_used}</code><br>
                cost: <code style="color:#fa0;">${j.approx_cost}</code> · received ${j.size_kb} KB image
            </div>`;
        } else {
            out.innerHTML = `<div style="background:rgba(255,68,68,0.12); border-left:3px solid #f55; padding:10px 14px; border-radius:4px; color:#fcc;">
                <b style="color:#f88;">✗ REPLICATE FAILED</b><br>
                model attempted: <code>${j.model_attempted || '?'}</code><br>
                cost: <code style="color:#0f8;">${j.approx_cost || '$0'}</code> (failed before charge)
                <code style="display:block; margin-top:6px; padding:6px 8px; background:rgba(0,0,0,0.4); color:#ff8; font-size:0.68rem; word-break:break-all;">${(j.error || '').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;')}</code>
                <details style="margin-top:8px;"><summary style="cursor:pointer; color:#888;">show full traceback</summary>
                    <pre style="font-size:0.6rem; color:#666; white-space:pre-wrap; max-height:200px; overflow-y:auto; padding:6px; background:rgba(0,0,0,0.4); border-radius:4px; margin-top:4px;">${(j.traceback || 'no traceback').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;')}</pre>
                </details>
            </div>`;
        }
    } catch (e) {
        out.innerHTML = `<span style="color:#f55;">FAIL: ${e.message}</span>`;
    }
};

// Debounce: rapid dropdown changes coalesce into ONE toast + ONE network call after 500ms idle
let _devSaveImageModelsTimer = null;
window._devSaveImageModels = function() {
    if (_devSaveImageModelsTimer) clearTimeout(_devSaveImageModelsTimer);
    _devSaveImageModelsTimer = setTimeout(() => {
        _devSaveImageModelsTimer = null;
        window._devSaveImageModelsActual();
    }, 500);
};
window._devSaveImageModelsActual = async function() {
    const repSel  = document.getElementById('dev-img-replicate');
    const freeSel = document.getElementById('dev-img-free');
    if (!repSel || !freeSel) return;
    // Subtle toast (no emoji per Xavier's preference for the dev panel)
    const showToast = (msg, color) => {
        const old = document.getElementById('nexus-save-toast'); if (old) old.remove();
        const toast = document.createElement('div');
        toast.id = 'nexus-save-toast';
        toast.style.cssText = `position:fixed; top:20px; right:20px; z-index:99999; background:rgba(0,0,0,0.95); color:${color}; border:2px solid ${color}; border-radius:8px; padding:12px 18px; font-family:"Fira Code",monospace; font-size:0.72rem; font-weight:700; letter-spacing:1.5px; box-shadow:0 4px 16px rgba(0,0,0,0.5);`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    };
    showToast('SAVING…', '#0ff');
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/image-models`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                replicate_model: repSel.value,
                free_model:      freeSel.value,
            })
        });
        const j = await r.json();
        if (j.ok) {
            showToast('SAVED · LIVE ON NEXT IMAGE GEN', '#0f8');
            setTimeout(() => window._devLoadImageModels && window._devLoadImageModels(), 500);
        } else {
            showToast('SAVE FAILED: ' + (j.error || 'unknown'), '#f55');
        }
    } catch (e) {
        showToast('✗ SAVE FAILED: ' + e.message, '#f55');
    }
};

window._devLoadFile = async function() {
    const sel = document.getElementById('dev-file');
    const ta = document.getElementById('dev-source');
    if (!sel || !ta) return;
    const f = sel.value;
    ta.value = '// loading…';
    try {
        const r = await fetch(`${window.API_BASE || ''}/api/dev/source?file=${encodeURIComponent(f)}`, { credentials: 'same-origin' });
        const data = await r.json();
        if (data.error) ta.value = `// ERROR: ${data.error}`;
        else ta.value = `// ${data.file}  (${data.size} bytes)\n\n${data.content}`;
    } catch (e) { ta.value = `// FAILED: ${e.message}`; }
};

window.toggleA11yClass = function(cls, btn) {
    document.body.classList.toggle(cls);
    if (btn) {
        btn.classList.toggle('active');
        const lbl = btn.querySelector('.fp-toggle-state');
        if (lbl) lbl.textContent = btn.classList.contains('active') ? 'ON' : 'OFF';
    }
};

// Settings helpers — picker + profanity toggle
window._saveDefault = function(key, value) {
    localStorage.setItem(key, value);
};
window._toggleProfanity = function(btn) {
    const next = !(localStorage.getItem('nexus_allow_profanity') === 'true');
    localStorage.setItem('nexus_allow_profanity', String(next));
    if (btn) {
        btn.classList.toggle('active', next);
        const lbl = btn.querySelector('.fp-toggle-state');
        if (lbl) lbl.textContent = next ? 'ON' : 'OFF';
    }
};

window.toggleA11yClass = function(cls, btn) {
    document.body.classList.toggle(cls);
    if (btn) btn.classList.toggle('active');
};

// --- UTILITIES ---
function _hhmm() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function printToTerminal(text, className = 'sys-msg') {
    if (!window.output) return;
    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    // Timestamp data-attr for `body.a11y-timestamps` CSS rule (only meaningful for AI replies)
    if (className.includes('ai-msg')) {
        p.setAttribute('data-ts', _hhmm());
        // Reply beep — soft tone if user enabled it
        if (document.body.classList.contains('a11y-reply-beep')) _playReplyBeep();
    }
    window.output.appendChild(p);
    // Pin Scroll — if user enabled, don't auto-scroll
    if (!document.body.classList.contains('a11y-no-autoscroll')) {
        window.output.scrollTop = window.output.scrollHeight;
    }
}

function _playReplyBeep() {
    const theme = localStorage.getItem('nexus_sound_theme') || 'beep';
    if (theme === 'off') return;
    try {
        const ctx = window._beepCtx || (window._beepCtx = new (window.AudioContext || window.webkitAudioContext)());
        const themes = {
            beep:   { type: 'sine',     freq: 880, len: 0.18 },
            chime:  { type: 'triangle', freq: 1320, len: 0.32 },
            bloop:  { type: 'square',   freq: 440, len: 0.10 },
        };
        const t = themes[theme] || themes.beep;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = t.type; o.frequency.value = t.freq;
        g.gain.value = 0.04;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t.len);
        o.stop(ctx.currentTime + t.len + 0.02);
    } catch (_) {}
}

function printTypewriter(text, className = 'ai-msg', speed = 15) {
    if (!window.output) return;
    const p = document.createElement('p');
    p.className = className;
    window.output.appendChild(p);

    let i = 0;
    function tick() {
        if (i < text.length) {
            p.innerHTML += text[i];
            i++;
            setTimeout(tick, speed);
        } else {
            window.output.scrollTop = window.output.scrollHeight;
        }
    }
    tick();
}

// Global Exports
window.printToTerminal = printToTerminal;
window.printTypewriter = printTypewriter;
window.setMode = setMode;
window.initiateBootSequence = initiateBootSequence;

// --- NEURAL TIPS SYSTEM ---
const NEURAL_TIPS = [
    "Type 'uplink' to select and analyze an image file.",
    "Drag and drop any image onto the monitor to scan it.",
    "The 'diag' command provides real-time owner-only telemetry.",
    "Custom neural memory is saved to your identity in AI PROFILE.",
    "Neural Voice can be toggled in the AI PROFILE menu.",
    "Click your profile card to access Diagnostics and Settings.",
    "Generated images are saved in HISTORY for 30 days — download them anytime.",
    "Nexus runs solo on a small monthly AI budget. Donations via ☕ SUPPORT NEXUS keep image gen running.",
    "Sign in with Google to unlock image generation in unfiltered mode.",
    "Switch modes anytime — NEXUS is general, CODER builds, EDUCATION teaches, UNFILTERED is unhinged.",
];

function showNeuralTip() {
    if (localStorage.getItem('nexus_tips_disabled') === 'true') return;

    const existing = document.querySelector('.neural-tip');
    if (existing) existing.remove();

    // Filter tips by user state — "sign in" tips only show to guests, etc.
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const isGuest = !u.email || u.email === 'guest@local';
    const eligibleTips = NEURAL_TIPS.filter(t => {
        // Tips tagged with "sign in" / "Google" only for guests
        if (/sign in with Google|unlock image generation/i.test(t)) return isGuest;
        return true;
    });
    const pool = eligibleTips.length ? eligibleTips : NEURAL_TIPS;
    const tip = pool[Math.floor(Math.random() * pool.length)];
    const el = document.createElement('div');
    el.className = 'neural-tip';
    el.innerHTML = `
        <span class="tip-header">TIP:</span>
        <span class="tip-body">${tip}</span>
        <button class="tip-close" onclick="this.parentElement.remove()">X</button>
    `;

    const wrapper = document.querySelector('.terminal-input-wrapper');
    if (wrapper) {
        wrapper.appendChild(el);
    }

    setTimeout(() => { if(el.parentElement) el.remove(); }, 10000);
}

// Start tip loop
setTimeout(showNeuralTip, 5000);
setInterval(showNeuralTip, 180000);
