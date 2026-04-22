// 🧠 NEXUS INTELLIGENCE CORE v5.2.0
// Routing for AI Kernel, Triggers, and Mode management.

async function prompt_ai_proxy(prompt, imageB64, mode) {
    const msgClass = (mode === 'shadow' ? 'shadow-msg' : 'ai-msg');
    console.log(`[AI] Synchronizing with ${mode.toUpperCase()} kernel...`);
    
    // Primary: REST Uplink
    try {
        const res = await fetch(`${window.API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd: prompt, history: window.messageHistory.slice(-10), mode, imageB64 })
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

    // Fallback: WebSocket
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

function handleAITriggers(text) {
    if (text.includes('[TRIGGER:IMAGE_GEN]')) {
        const prompt = text.split('IMAGE_GEN]')[1].trim();
        generateImage(prompt);
    }
}

async function generateImage(prompt) {
    printToTerminal(`[SYSTEM] Initiating neural rendering: "${prompt}"`, 'sys-msg');
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
