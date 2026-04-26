// 🛰️ NEXUS GLOBAL COMMAND CENTER v5.3.0
window.NEXUS_VERSION = 'v5.3.0';

// Core Environment
window.isLocal = (function() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
})();
window.RENDER_HOST = 'nexus-terminalnexus.onrender.com';
window.PACIFIC_HUB = 'https://nexus-evil-proxy.xavierscott300.workers.dev';
window.isRender = window.location.hostname.includes('onrender.com');
window.proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
window.BACKEND_URL = (window.isLocal || window.isRender) ? window.location.host : window.RENDER_HOST;
window.API_BASE = (window.isLocal || window.isRender) ? '' : `https://${window.RENDER_HOST}`;
window.WS_URL = `${window.proto}//${window.BACKEND_URL}/ws/terminal`;
window.STATS_URL = `${window.proto}//${window.BACKEND_URL}/ws/stats`;

// Shared UI Elements
window.cpuStat = null;
window.memStat = null;
window.output = null;
window.input = null;
window.guiContainer = null;
window.guiContent = null;
window.guiTitle = null;
window.nexusCanvas = null;

// System State
window.termWs = null;
window.messageHistory = [];
window.cmdHistory = JSON.parse(localStorage.getItem('nexus_cmd_history') || '[]');
window.historyIndex = -1;
window.currentMode = localStorage.getItem('nexus_mode') || 'nexus';

// Mode Colors
window.MODE_COLORS = {
    nexus: '#4af',
    shadow: '#ff6600',
    coder: '#0f0',
    education: '#00ffcc'
};

// --- Thinking Animation ---
window.showThinking = function() {
    if (!window.output) return;
    const p = document.createElement('p');
    p.id = 'ai-thinking';
    p.className = 'sys-msg';
    const col = window.MODE_COLORS[window.currentMode] || '#4af';
    p.innerHTML = `<span class="nexus-thinking-bar" style="color:${col};">[ ANALYZING NEURAL DATA... ]</span>`;
    window.output.appendChild(p);
    window.output.scrollTop = window.output.scrollHeight;
};

window._clearThinking = function() {
    document.getElementById('ai-thinking')?.remove();
};
