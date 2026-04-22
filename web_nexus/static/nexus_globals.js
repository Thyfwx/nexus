
// 🛰️ NEXUS GLOBAL COMMAND CENTER v5.0.1
window.NEXUS_VERSION = 'v5.0.1';

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
