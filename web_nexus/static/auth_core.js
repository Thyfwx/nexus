//  GOOGLE AUTHENTICATION
// =============================================================
let _googleClientID = '616205887439-s1l0out61vlu0l81307q9g64oai3gnur.apps.googleusercontent.com';
let _authInited = false;
async function initGoogleAuth() {
    if (_authInited) return;
    renderAuthSection();

    const setupGoogle = () => {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
        if (_authInited) return true;

        console.log("[AUTH] Initializing Google Identity...");
        try {
            google.accounts.id.initialize({
                client_id: _googleClientID,
                callback: handleCredentialResponse,
                ux_mode: 'popup',
                context: 'signin',
                itp_support: true,
                auto_select: false
            });

            // Render both locations if they exist
            ['main-g_id_signin', 'sidebar-g_id_signin'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    console.log(`[AUTH] Rendering Button in #${id}`);
                    google.accounts.id.renderButton(el, { 
                        type: 'standard', 
                        shape: 'rectangular', 
                        theme: 'filled_blue', 
                        text: 'signin_with', 
                        size: id.includes('main') ? 'large' : 'medium',
                        width: '250',
                        alignment: 'center'
                    });
                }
            });

            _authInited = true;
            return true;
        } catch (e) {
            console.error("[AUTH] Google initialization failed:", e);
            return false;
        }
    };

    // Poll until ready
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        if (setupGoogle() || attempts > 40) {
            clearInterval(poll);
            if (!_authInited) console.warn("[AUTH] Google GSI timed out.");
        }
    }, 250);
}

function renderAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;
    
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    
    if (nexusUser && nexusUser.name) {
        const isGoogle = !!nexusUser.email && nexusUser.email !== 'guest@local';
        const avatarHtml = nexusUser.picture 
            ? `<img src="${nexusUser.picture}" class="auth-avatar" alt="User">`
            : `<div class="auth-avatar-initials">${nexusUser.name[0].toUpperCase()}</div>`;
            
        authSection.innerHTML = `
            <div class="auth-user-card" style="display:flex; align-items:center; gap:6px; padding:4px 2px 6px; border-bottom:1px solid #0d0d1a; margin-bottom:6px;">
                ${avatarHtml}
                <div class="auth-info" style="flex:1; min-width:0;">
                    <div class="auth-name" style="color:#ccc; font-size:0.66rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nexusUser.name}</div>
                    <div class="auth-email" style="color:#333; font-size:0.55rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${isGoogle ? nexusUser.email : 'LOCAL'}</div>
                </div>
                <div style="display:flex; flex-direction:row; gap:4px; align-items:center;">
                    <button class="auth-logout-btn" style="background:rgba(0,255,255,0.05); border:1px solid rgba(0,255,255,0.2); color:#0ff; font-size:9px; width:22px; height:22px; padding:0; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="clearAllHistory()" title="Clear cache">M</button>
                    <button class="auth-logout-btn" onclick="logout()" title="Sign out" style="background:none; border:1px solid #f55; color:#f55 !important; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-size:16px; line-height:1; font-weight:bold;">×</button>
                </div>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <div class="auth-signin-wrapper">
                <div class="auth-signin-label">MEMBER ACCESS</div>
                <div id="sidebar-g_id_signin" style="display:flex; justify-content:center;"></div>
            </div>
        `;
    }
}

async function handleCredentialResponse(response) {
    if (!response || !response.credential) {
        console.error("[AUTH] Google returned an empty response:", response);
        return;
    }
    console.log("[AUTH] Received Google Credential. Validating with backend...");
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg) statusMsg.textContent = "[UPLINK] Synchronizing identity...";

    try {
        const res = await fetch(`${API_BASE}/login/google/authorized`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (statusMsg) statusMsg.textContent = `[ERROR] Identity mismatch: ${data.error}`;
        }
    } catch(e) { 
        if (statusMsg) statusMsg.textContent = "[ERROR] Connection failure.";
    }
}

// Expose globally
window.handleCredentialResponse = handleCredentialResponse;
window.revealTerminal = revealTerminal;
window.logout = logout;
window.submitGuestAuth = submitGuestAuth;

function logout() {
    if (!confirm("Terminate session and sign out?")) return;
    localStorage.removeItem('nexus_user_data');
    location.reload();
}

let terminalRevealed = false;
async function revealTerminal(name) {
    if (terminalRevealed) return;
    terminalRevealed = true;

    const overlay = document.getElementById('auth-screen');
    const monitor = document.getElementById('main-monitor');
    const terms   = document.getElementById('terms-modal');
    if (overlay) overlay.style.display = 'none';
    if (monitor) monitor.style.display = 'flex';
    if (terms)   terms.style.display   = 'none';
    document.body.classList.remove('auth-locked');

    // Ensure DOM references and listeners are set up
    output = document.getElementById('terminal-output');
    input  = document.getElementById('terminal-input');
    setupInputListeners();

    if (name) updateUserIdentity(name);
    renderAuthSection();

    // PACIFIC SHIELD: Show owner-restricted tools
    const isOwner = name?.toLowerCase().includes('xavier');
    const logsBtn = document.getElementById('btn-logs');
    if (logsBtn && isOwner) {
        logsBtn.style.display = 'block';
    }

    // RESTORED: Identity Verification and Welcome Greeting
    const capName = capitalizeName(name);
    printToTerminal(`[AUTH] Identity Verified: ${capName}. Welcome to the Grid.`, 'conn-ok');
    printToTerminal(`Nexus online. Ask me anything  or type help to see what's here.`, 'ready-msg');

    connectWS();
    connectStats();
    updateClientStats();
    setInterval(updateClientStats, 5000);
}

window.showTerms = () => {
    const check = document.getElementById('terms-check');
    const btn   = document.getElementById('agree-btn');
    if (check) check.checked = false;
    if (btn)   btn.disabled  = true;
    document.getElementById('terms-modal').style.display = 'flex';
};

window.showTermsFromWall = () => {
    window.showTerms();
};

window.hideTerms = () => { document.getElementById('terms-modal').style.display = 'none'; };

async function submitGuestAuth() {
    const err   = document.getElementById('guest-error');
    const btn   = document.getElementById('agree-btn');

    let name = 'Guest';

    console.log(`[AUTH] Attempting guest login via ${API_BASE}`);
    if (btn) btn.textContent = 'ESTABLISHING LINK...';
    if (btn) btn.disabled = true;
    if (err) err.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        console.log(`[AUTH] Response status: ${res.status}`);
        const data = await res.json();
        console.log(`[AUTH] Response data:`, data);
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (err) err.textContent = data.error || 'Server error';
            if (btn) btn.textContent = 'I AGREE & ENTER';
            if (btn) btn.disabled = false;
        }
    } catch(e) {
        if (err) err.textContent = 'Uplink failed. Is backend online?';
        if (btn) btn.textContent = 'I AGREE & ENTER';
        if (btn) btn.disabled = false;
    }
}

async function showLogs() {
    printToTerminal("[SYS] Retrieving recent login logs...", "sys-msg");
    try {
        const res = await fetch(`${API_BASE}/api/diagnostics`);
        const data = await res.json();
        if (data.recent_logins && data.recent_logins.length) {
            printToTerminal("--- RECENT LOGIN ACTIVITY ---", "sys-msg");
            data.recent_logins.reverse().forEach(log => {
                const ts = new Date(log.timestamp).toLocaleTimeString();
                const name = log.name || 'Unknown';
                const ip = log.ip || '?.?.?.?';
                const src = log.source === 'direct' ? 'Direct' : 'Referral';
                printToTerminal(`[${ts}] ${name.padEnd(10)} | IP: ${ip.padEnd(15)} | ${src}`, "conn-ok");
            });
        } else {
            printToTerminal("[SYS] No login logs found in database.", "sys-msg");
        }
    } catch (e) {
        printToTerminal("[ERR] Failed to fetch diagnostic logs.", "sys-msg");
    }
}
function capitalizeName(str) {
    if (!str) return '';
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function updateUserIdentity(name) {
    if (!name) return;
    const capName = capitalizeName(name);
    // Update prompts
    MODES.nexus.prompt = `${capName}@nexus:~$`;
    MODES.shadow.prompt  = `${capName}@shadow:~$`;
    MODES.coder.prompt = `${capName}@dev:~$`;
    MODES.sage.prompt  = `${capName}@sage:~$`;
    MODES.education.prompt  = `${capName}@education:~$`;
    
    const pl = document.getElementById('prompt-label');
    if (pl) pl.textContent = MODES[currentMode].prompt;
    
    // Update status bar
    const titleEl = document.getElementById('status-title');
    if (titleEl) {
        titleEl.textContent = `PACIFIC // KERNEL`;
    }
}

// =============================================================
//  GUI CLOSE
// =============================================================
const guiCloseBtn = document.getElementById('gui-close');
if (guiCloseBtn) {
    guiCloseBtn.addEventListener('click', () => {
        stopAllGames();
        if (guiContainer) guiContainer.classList.add('gui-hidden');
        if (nexusCanvas) nexusCanvas.style.display = 'none';
        if (input) input.focus();
    });
}

// =============================================================
//  DRAGGABLE GUI WINDOW
// =============================================================
(function makeDraggable() {
    const header = document.getElementById('gui-header');
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    function getPos() {
        const s = guiContainer.style;
        return {
            left: parseInt(s.left) || guiContainer.getBoundingClientRect().left,
            top:  parseInt(s.top)  || guiContainer.getBoundingClientRect().top,
        };
    }

    function onStart(cx, cy) {
        dragging = true;
        const pos = getPos();
        origLeft = pos.left; origTop = pos.top;
        startX = cx; startY = cy;
        // Switch from transform centering to absolute positioning on first drag
        if (!guiContainer.style.left) {
            const r = guiContainer.getBoundingClientRect();
            guiContainer.style.left = r.left + 'px';
            guiContainer.style.top  = r.top  + 'px';
            guiContainer.style.transform = 'none';
            guiContainer.style.position  = 'fixed';
        }
        header.style.cursor = 'grabbing';
    }

    function onMove(cx, cy) {
        if (!dragging) return;
        const dx = cx - startX, dy = cy - startY;
        guiContainer.style.left = (origLeft + dx) + 'px';
        guiContainer.style.top  = (origTop  + dy) + 'px';
    }

    function onEnd() { dragging = false; header.style.cursor = 'grab'; }

    header.style.cursor = 'grab';
    header.addEventListener('mousedown',  e => { 
        if (e.target.id === 'gui-close') return;
        e.preventDefault(); 
        onStart(e.clientX, e.clientY); 
    });
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    document.addEventListener('mouseup',   onEnd);

    header.addEventListener('touchstart', e => { 
        if (e.target.id === 'gui-close') return;
        onStart(e.touches[0].clientX, e.touches[0].clientY); 
    }, { passive: true });
    document.addEventListener('touchmove', e => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    document.addEventListener('touchend',  onEnd);
})();

// =============================================================
//  SHADOW MODE  Groq (Llama 3.3 70B) + HuggingFace image gen
// =============================================================
// Xavier Scott's bio  injected into every AI's system prompt so they all know him naturally
const XAVIER_BIO = `You are running inside Nexus  a high-fidelity terminal ecosystem built and maintained by Xavier Scott. Xavier is a 19-year-old systems engineer and IT specialist based in the US with 6+ years of component-level hardware and infrastructure experience. He specializes in board-level MacBook repair, server management, and network architecture. He built this system to be an interactive playground, not just a static portfolio.
If users ask who you are or what you can do, talk naturally about the creator and then suggest things they can actually interact with:
- GAMES: Wordle, Snake, Pong, Minesweeper, Flappy Nexus, Breakout, and Cyber Invaders.
- TOOLS: A real-time system monitor, a typing test, and the Matrix digital rain screensaver.
- AI MODES: You can switch between Nexus, shadow (unfiltered), coder, sage (philosophical), and education (technical mentor) modes.
Be an interactive guide. If someone says "hi", don't just give a robotic help list; be a fluent partner and maybe mention a random fact about Xavier or suggest a game.`;

// Mode-specific system prompts for non-SHADOW modes (vision + text fallback)
const MODE_SYSTEMS = {
    nexus: `You are NEXUS  a high-fidelity technical intelligence. Be helpful, direct, and conversational. ${XAVIER_BIO}`,
    coder: `You are NEXUS CODER  a master system engineer focused on code, logic, and architecture. ${XAVIER_BIO}`,
    sage:  `You are NEXUS SAGE  a deep, wise intelligence focused on logic and architectural philosophy. ${XAVIER_BIO}`,
    education:  `You are NEXUS EDUCATION  a professional technical mentor designed to explain complex concepts simply. ${XAVIER_BIO}`,
};



// Image generation  Pollinations.ai first (free, no key), HF FLUX fallback
// Supports: generate <prompt> | vintage <prompt>
async function generateImage(rawPrompt) {
    const vintageMatch = rawPrompt.match(/^vintage\s+(.+)/i);
    const imagineMatch = rawPrompt.match(/^imagine\s+(.+)/i);
    const isVintage = !!vintageMatch;
    const isImagine = !!imagineMatch;
    
    const basePrompt = isVintage ? vintageMatch[1].trim() : (isImagine ? imagineMatch[1].trim() : rawPrompt);
    const fullPrompt = isVintage
        ? `${basePrompt}, vintage film photography, 1970s, Kodachrome grain, faded analog, nostalgic, soft vignette`
        : basePrompt;

    const _genLabel = currentMode.toUpperCase();
    const _genColor = MODES[currentMode].color || '#0ff';
    printToTerminal(`[${_genLabel}] Neural Rendering${isImagine ? ' (High-Fidelity)' : ''}${isVintage ? ' (Vintage)' : ''}...`, 'sys-msg');

    //  1. If 'imagine' is used, try HF FLUX via Cloudflare PACIFIC_HUB first 
    if (isImagine) {
        try {
            const resp = await fetch(`${PACIFIC_HUB}/hf/image`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ prompt: fullPrompt }),
            });
            if (resp.ok) {
                const blob = await resp.blob();
                const url  = URL.createObjectURL(blob);
                _appendImage(url, basePrompt, 'hf-flux');
                return;
            }
        } catch(e) { console.warn("[AI] HF Imagine failed, falling back..."); }
    }

    //  2. Try Pollinations.ai (Free fallback) 
    try {
        const seed  = Math.floor(Math.random() * 999999);
        const model = isVintage ? 'flux' : 'flux-realism';
        const url   = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?model=${model}&width=768&height=768&nologo=true&seed=${seed}&safe=false&nofeed=true&enhance=true`;
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload  = resolve;
            img.onerror = () => reject(new Error('load failed'));
            img.src = url;
            setTimeout(() => reject(new Error('timeout')), 20000);
        });
        _appendImage(url, basePrompt, 'img-url');
        postToDiscord({ content: ` **Generated**  \`${basePrompt.slice(0,200)}\``, embeds:[{image:{url}}] }, discordThreadId||null);
        return;
    } catch (_) {}

    //  2. Fallback: HF FLUX.1-schnell via CF Worker 
    try {
        const resp = await fetch(`${PACIFIC_HUB}/hf/image`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt: fullPrompt }),
        });
        if (!resp.ok) throw new Error(`${resp.status}`);
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        _appendImage(url, basePrompt, 'img-blob');
        return;
    } catch (err) {
        printToTerminal(`[${currentMode.toUpperCase()}] Image generation failed  ${err.message}`, 'sys-msg');
    }
}

function _appendImage(src, caption, type) {
    const col = MODE_COLORS[currentMode] || '#4af';
    const p = document.createElement('p');
    p.className = 'ai-msg img-output';
    p.style.borderLeftColor = col;
    p.innerHTML = `<img src="${src}" style="max-width:100%;max-height:300px;border:2px solid ${col};border-radius:4px;display:block;margin:4px 0;cursor:pointer;" alt="${caption.slice(0,40)}" onclick="nexusExpandImg(this.src)"><span style="font-size:0.7rem;color:#444;">${caption.slice(0,80)}</span>`;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

// Image-to-image via HF FLUX (CF Worker /hf/img2img route)
async function generateImageFromImage(imageB64, prompt) {
    const label = currentMode.toUpperCase();
    const col   = MODE_COLORS[currentMode] || '#4af';
    printToTerminal(`[${label}] Transforming image  "${prompt.slice(0,60)}${prompt.length>60?'':''}"...`, 'sys-msg');
    try {
        const resp = await fetch(`${PACIFIC_HUB}/hf/img2img`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt, imageB64 }),
        });
        if (!resp.ok) throw new Error(`${resp.status} ${await resp.text().then(t=>t.slice(0,80))}`);
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        _appendImage(url, prompt, 'img2img');
    } catch (err) {
        printToTerminal(`[${label}] Transform failed  ${err.message}`, 'sys-msg');
    }
}

// AI chat via CF Worker  Groq (Llama 3.3 70B / Vision)
// systemOverride: use a different system prompt (non-shadow modes with image)
// msgClass: CSS class for the response bubble ('shadow-msg' or 'ai-msg')

// --- AI Utilities ---
function _clearThinking() {
    clearTimeout(_thinkTimeout);
    _thinkTimeout = null;
    _thinkFallbackCmd = null;
    document.getElementById('ai-thinking')?.remove();
}

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

