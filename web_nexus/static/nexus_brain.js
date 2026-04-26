// 🧠 NEXUS BRAIN ORCHESTRATOR v5.3.0
// Unified system for state management, UI orchestration, and modular loading.

window.NexusBrain = {
    version: '5.3.0',
    modules: {},
    
    init() {
        console.log("[BRAIN] Synchronizing Neural Modules...");
        this.ui.setupFocus();
        this.ui.initAtmosphere();
        this.syncWithBackend();
    },

    ui: {
        print(text, type = 'sys-msg') {
            if (window.printToTerminal) window.printToTerminal(text, type);
        },
        
        setupFocus() {
            document.addEventListener('click', (e) => {
                const noFocus = ['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'];
                if (e.target.closest('.monitor') && !noFocus.includes(e.target.tagName) && !e.target.closest('.a11y-panel')) {
                    if (!window.getSelection().toString()) document.getElementById('terminal-input')?.focus();
                }
            });
        },
        
        initAtmosphere() {
            // Stats Fluctuation (Visual Only)
            setInterval(() => {
                const cpu = document.getElementById('cpu-stat');
                const mem = document.getElementById('mem-stat');
                if (cpu && !window.termWs) cpu.textContent = (Math.random() * 5 + 1).toFixed(1) + '%';
                if (mem && !window.termWs) mem.textContent = (Math.random() * 2 + 12).toFixed(1) + '%';
            }, 3000);
        }
    },

    syncWithBackend() {
        fetch(`${window.API_BASE}/api/config`)
            .then(r => r.json())
            .then(data => {
                if (data.google_client_id) {
                    console.log("[BRAIN] Backend Config Synced.");
                }
            })
            .catch(e => console.warn("[BRAIN] Sync failed:", e));
    }
};

window.addEventListener('load', () => window.NexusBrain.init());
