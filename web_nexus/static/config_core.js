meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = theme.color;
}

// Initial call
updateTabIdentity();

// Focus Listener (Optimized for Chrome)
document.addEventListener('mousedown', (e) => {
    // Only focus if the user clicks inside the monitor but not on buttons or inputs
    if (e.target.closest('.monitor') && !['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'].includes(e.target.tagName) && !e.target.closest('.a11y-panel')) {
        setTimeout(() => {
            if (!window.getSelection().toString()) input.focus();
        }, 0);
    }
});

// Per-mode chat history  each AI has its own separate memory
const HISTORY_KEYS = { nexus: 'nh_nexus', shadow: 'nh_shadow', coder: 'nh_coder', sage: 'nh_sage', education: 'nh_education' };

function saveHistory() {
    const key = HISTORY_KEYS[currentMode];
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(messageHistory.slice(-40))); } catch(_) {}
}
function loadHistory(mode) {
    const key = HISTORY_KEYS[mode || currentMode];
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(_) { return []; }
}
// =============================================================
//  PACIFIC UPLINK (Tracking & Data Collection)
