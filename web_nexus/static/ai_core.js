// 🧠 NEXUS INTELLIGENCE CORE v5.0.1
// Unified routing for AI chat, image generation, and mode management.

window.messageHistory = [];
window.currentMode = localStorage.getItem('nexus_mode') || 'nexus';

const MODE_SYSTEMS = {
    nexus: `You are NEXUS - a high-fidelity technical intelligence built by Xavier Scott. Be helpful, direct, and conversational.`,
    coder: `You are NEXUS CODER - a master system engineer masterminded by Xavier Scott. Focused on code, architecture, and logic.`,
    sage:  `You are NEXUS SAGE - a deep philosophical intelligence exploring the logic within the code. Built by Xavier Scott.`,
    education: `You are NEXUS EDUCATION - a professional technical mentor designed by Xavier Scott to explain complex concepts simply.`,
};

async function prompt_ai_proxy(prompt, imageB64, mode) {
    const msgClass = (mode === 'shadow' ? 'shadow-msg' : 'ai-msg');
    console.log(`[AI] Synchronizing with ${mode.toUpperCase()} kernel...`);
    
    try {
        const res = await fetch(`${window.API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                cmd: prompt, 
                history: window.messageHistory.slice(-10), 
                mode, 
                imageB64 
            })
        });
        const data = await res.json();
        if (data.ok) {
            _clearThinking();
            printAIResponse(data.text, msgClass);
            window.messageHistory.push({ role: 'assistant', content: data.text });
            saveHistory();
            return;
        }
    } catch(e) { console.error("[AI] REST Uplink failed:", e); }

    if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
        window.termWs.send(JSON.stringify({ command: prompt, history: window.messageHistory.slice(-10), mode, imageB64 }));
    } else {
        _clearThinking();
        printToTerminal(`[CRITICAL] Neural link severed. Verify backend status.`, "conn-err");
    }
}

function printAIResponse(text, className) {
    const unifiedClass = `ai-msg ${window.currentMode}-msg`;
    printTypewriter(text, unifiedClass);
}

async function askPacific(cmd, imageB64 = null, systemOverride = null) {
    showThinking();
    window.messageHistory.push({ role: 'user', content: cmd });

    const messages = systemOverride
        ? [{ role: 'system', content: systemOverride }, ...window.messageHistory.slice(-10), { role: 'user', content: cmd }]
        : [...window.messageHistory.slice(-10), { role: 'user', content: cmd }];

    try {
        const resp = await fetch(`${window.PACIFIC_HUB}/evil/chat`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ messages, useEvilSystem: !systemOverride, imageB64 }),
        });
        if (!resp.ok) return false;

        const data = await resp.json();
        if (data.text) {
            _clearThinking();
            printAIResponse(data.text, 'ai-msg');
            window.messageHistory.push({ role: 'assistant', content: data.text });
            saveHistory();
            return true;
        }
        return false;
    } catch (err) {
        console.error("Pacific Link failed:", err);
        return false;
    }
}

function shadowAgeGate(onConfirm) {
    if (sessionStorage.getItem('shadow_age_ok')) { onConfirm(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'overlay-base';
    overlay.innerHTML = `
        <div class="content-box" style="border-color:#ff6600; box-shadow:0 0 50px rgba(255,102,0,0.2);">
            <h2 style="color:#ff6600; letter-spacing:4px;">SHADOW LINK</h2>
            <p style="color:#aaa; font-size:0.85rem; line-height:1.7;">
                Bypassing standard grid restrictions. Neural data may be unfiltered or explicit. <br>Proceed with caution.
            </p>
            <div style="display:flex; gap:12px; justify-content:center; margin-top:20px;">
                <button id="age-yes" class="gui-btn" style="background:#ff6600; color:#000; border:none;">ENGAGE</button>
                <button id="age-no" class="gui-btn" style="border-color:#333; color:#555;">ABORT</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('age-yes').onclick = () => {
        overlay.remove();
        sessionStorage.setItem('shadow_age_ok', '1');
        onConfirm();
    };
    document.getElementById('age-no').onclick = () => overlay.remove();
}

async function generateImage(prompt) {
    printToTerminal(`[SYSTEM] Initiating neural rendering for: "${prompt}"`, 'sys-msg');
    try {
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&enhance=true`;
        const p = document.createElement('p');
        p.className = 'ai-msg';
        p.innerHTML = `<img src="${url}" style="max-width:100%; border:1px solid var(--accent); margin-top:10px; cursor:pointer;" onclick="window.nexusExpandImg(this.src)">`;
        window.output.appendChild(p);
        window.output.scrollTop = window.output.scrollHeight;
    } catch(e) { printToTerminal(`[ERR] Rendering failed.`, 'sys-msg'); }
}

function saveHistory() {
    const key = window.HISTORY_KEYS[window.currentMode];
    if (key) localStorage.setItem(key, JSON.stringify(window.messageHistory.slice(-40)));
}

function loadHistory(mode) {
    const key = window.HISTORY_KEYS[mode || window.currentMode];
    return JSON.parse(localStorage.getItem(key) || '[]');
}
