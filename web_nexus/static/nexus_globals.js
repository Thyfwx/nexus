// 🛰️ NEXUS GLOBAL COMMAND CENTER v5.0.6
window.NEXUS_VERSION = 'v5.0.6';

// Shared UI Elements
window.cpuStat = null;
window.memStat = null;
window.output = null;
window.input = null;
window.guiContainer = null;
window.guiContent = null;
window.guiTitle = null;
window.nexusCanvas = null;

// Shared State
window.termWs = null;
window.messageHistory = [];
window.cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
window.historyIndex = -1;
window.currentMode = localStorage.getItem('nexus_mode') || 'nexus';
window.isBackendOnline = false;
window.sessionGeoData = null;
window.discordThreadId = localStorage.getItem('nexus_discord_thread') || null;

// Routing Constants
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
window.RENDER_HOST = 'nexus-terminalnexus.onrender.com';
window.API_BASE = isLocal ? '' : `https://${window.RENDER_HOST}`;
window.PACIFIC_HUB = 'https://nexus-evil-proxy.xavierscott300.workers.dev';

// Shared Utilities
window.setNexusState = (state) => {
    console.log('[SYSTEM] State Transition:', state);
    document.body.setAttribute('data-nexus-state', state);
};

window.printToTerminal = (text, className = 'sys-msg') => {
    if (!window.output) window.output = document.getElementById('terminal-output');
    if (!window.output) return;
    const p = document.createElement('p');
    p.className = className;
    p.innerHTML = text.replace(/\n/g, '<br>');
    window.output.appendChild(p);
    window.output.scrollTop = window.output.scrollHeight;
};

window.showThinking = (cmd) => {
    if (!window.output) return;
    document.getElementById('ai-thinking')?.remove();
    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.className = 'sys-msg';
    p.innerHTML = `<span class="nexus-thinking-bar">[ ANALYZING NEURAL DATA... ]</span>`;
    window.output.appendChild(p);
    window.output.scrollTop = window.output.scrollHeight;
};
