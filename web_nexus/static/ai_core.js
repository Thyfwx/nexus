// 🧠 NEXUS INTELLIGENCE CORE v5.3.0
// Routing for AI Kernel, Triggers, and Mode management.

async function prompt_ai_proxy(prompt, imageB64, mode, retryCount = 0) {
    console.log(`[AI] Synchronizing with ${mode.toUpperCase()} kernel... (Attempt: ${retryCount + 1})`);
    if (retryCount === 0) window.showThinking();

    const memory = localStorage.getItem('nexus_neural_memory') || "";
    const personalContext = memory ? `[USER PERSONAL MEMORY: ${memory}]` : "";

    const isForceVulgar = localStorage.getItem('nexus_force_vulgar') === 'true';

    // Primary: WebSocket (already open, zero latency)
    if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
        window.termWs.send(JSON.stringify({
            command: prompt,
            history: window.messageHistory.slice(-10),
            mode,
            imageB64,
            context: personalContext,
            force_vulgar: isForceVulgar,
            owner_mode: window.OWNER_MODE
        }));
        return;
    }

    // Fallback: REST
    try {
        const res = await fetch(`${window.API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cmd: prompt,
                history: window.messageHistory.slice(-10),
                mode,
                imageB64,
                context: personalContext,
                owner_mode: window.OWNER_MODE
            })
        });
        const data = await res.json();
        if (data.ok) {
            window._clearThinking();
            printAIResponse(data.text);
            window.messageHistory.push({ role: 'assistant', content: data.text });
            return;
        } else if (retryCount < 2) {
            console.warn("[AI] API error response, retrying...");
            await new Promise(r => setTimeout(r, 2000));
            return prompt_ai_proxy(prompt, imageB64, mode, retryCount + 1);
        }
    } catch(e) { 
        console.warn("[AI] REST fallback failed:", e.message); 
        if (retryCount < 2) {
            console.log("[AI] Error detected, auto-retrying...");
            await new Promise(r => setTimeout(r, 2000));
            return prompt_ai_proxy(prompt, imageB64, mode, retryCount + 1);
        }
    }

    // All paths failed — backend is cold-starting or down
    window._clearThinking();
    printToTerminal('[SYS] API Error detected. Connection unstable. Neural link retrying in background...', 'sys-msg');
}

function printAIResponse(text) {
    const speeds = {
        nexus: 10,
        unfiltered: 1,
        coder: 5,
        education: 20
    };
    const speed = speeds[window.currentMode] || 10;
    printTypewriter(text, `ai-msg ${window.currentMode}-msg`, speed);
}

function handleAITriggers(text) {
    // Check for game triggers or special tags from AI
    const tags = ['pong', 'snake', 'wordle', 'mines', 'flappy', 'breakout', 'invaders', 'monitor', 'clear', 'accessibility'];
    for (const tag of tags) {
        if (text.includes(`[TRIGGER:${tag}]`)) {
            window.handleCommand(`play ${tag}`);
            return true;
        }
    }
    return false;
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

function playNeuralVoice(base64) {
    if (!base64) return;
    const active = localStorage.getItem('nexus_tts_active') === 'true';
    if (!active) return;
    
    try {
        const audio = new Audio(`data:audio/wav;base64,${base64}`);
        audio.play().catch(e => console.warn("[VOICE] Autoplay blocked:", e));
    } catch(e) { console.error("[VOICE] Playback error:", e); }
}

// Global Exports
window.prompt_ai_proxy = prompt_ai_proxy;
window.handleAITriggers = handleAITriggers;
window.generateImage = generateImage;
window.playNeuralVoice = playNeuralVoice;
