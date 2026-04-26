// 🧠 NEXUS INTELLIGENCE CORE v5.3.0
// Routing for AI Kernel, Triggers, and Mode management.

async function prompt_ai_proxy(prompt, imageB64, mode) {
    console.log(`[AI] Synchronizing with ${mode.toUpperCase()} kernel...`);
    
    window.showThinking();
    
    // Primary: REST Uplink
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
            window._clearThinking();
            printAIResponse(data.text);
            window.messageHistory.push({ role: 'assistant', content: data.text });
            return;
        }
    } catch(e) { console.warn("[AI] REST Link unstable. Checking WebSocket..."); }

    // Fallback: WebSocket
    if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
        window.termWs.send(JSON.stringify({ 
            command: prompt, 
            history: window.messageHistory.slice(-10), 
            mode, 
            imageB64 
        }));
    } else {
        window._clearThinking();
        printToTerminal(`[CRITICAL] Neural link severed. Verify backend status.`, "conn-err");
    }
}

function printAIResponse(text) {
    printTypewriter(text, `ai-msg ${window.currentMode}-msg`);
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
