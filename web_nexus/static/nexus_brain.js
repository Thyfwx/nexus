// 🧠 NEXUS BRAIN ORCHESTRATOR v5.4.8
// Unified system for state management, UI orchestration, and modular loading.

const MOBILE_BREAKPOINT = 700; // iPad mini portrait (744px) and up render desktop layout
const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

window.NexusBrain = {
    version: '5.4.8',
    modules: {},

    init() {
        console.log("[BRAIN] Synchronizing Neural Modules...");
        this.ui.setupFocus();
        this.ui.initAtmosphere();
        this.ui.setupMobileDrawer();
        this.ui.suppressMobileAutofocus();
        this.ui.setupDraggablePanels();
        this.ui.setupGuiClose();
        this.ui.setupGuiDrag();
        this.syncWithBackend();
    },

    ui: {
        print(text, type = 'sys-msg') {
            if (window.printToTerminal) window.printToTerminal(text, type);
        },

        setupFocus() {
            document.addEventListener('click', (e) => {
                if (isMobile()) return; // mobile: only focus when user explicitly taps the input
                const noFocus = ['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'A', 'CANVAS'];
                if (e.target.closest('.monitor') && !noFocus.includes(e.target.tagName) && !e.target.closest('.a11y-panel')) {
                    if (!window.getSelection().toString()) document.getElementById('terminal-input')?.focus();
                }
            });
        },

        suppressMobileAutofocus() {
            // The <input autofocus> on the terminal would force the iOS keyboard up the moment the page loads.
            // On mobile we drop focus immediately so the user can scroll, read, and tap the drawer freely.
            if (!isMobile()) return;
            const blur = () => {
                const inp = document.getElementById('terminal-input');
                if (inp && document.activeElement === inp) inp.blur();
            };
            blur();
            setTimeout(blur, 50);
            setTimeout(blur, 300);
        },
        
        initAtmosphere() {
            // Stats Fluctuation (Visual Only)
            setInterval(() => {
                const cpu = document.getElementById('cpu-stat');
                const mem = document.getElementById('mem-stat');
                if (cpu && !window.termWs) cpu.textContent = (Math.random() * 5 + 1).toFixed(1) + '%';
                if (mem && !window.termWs) mem.textContent = (Math.random() * 2 + 12).toFixed(1) + '%';
            }, 3000);
            // Live clock in the top header
            const tickClock = () => {
                const el = document.getElementById('header-clock');
                if (!el) return;
                const d = new Date();
                el.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
            };
            tickClock();
            setInterval(tickClock, 1000);
        },

        setupGuiDrag() {
            // Drag #game-gui-container by its #gui-header
            const gui = document.getElementById('game-gui-container');
            const header = document.getElementById('gui-header');
            if (!gui || !header) return;
            header.style.cursor = 'move';
            header.style.userSelect = 'none';
            let drag = null;
            header.addEventListener('mousedown', (e) => {
                if (isMobile && isMobile()) return;
                if (e.target.closest('#gui-close')) return;
                // CSS centers the modal via `transform: translate(-50%, -50%)` — that math
                // fights with `left/top`. Kill the transform first, anchor by current rect.
                const r = gui.getBoundingClientRect();
                gui.style.transform = 'none';
                gui.style.position = 'fixed';
                gui.style.left = `${r.left}px`;
                gui.style.top  = `${r.top}px`;
                gui.style.right = 'auto';
                gui.style.bottom = 'auto';
                gui.style.transition = 'none';
                drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', (e) => {
                if (!drag) return;
                const w = gui.offsetWidth, h = gui.offsetHeight;
                let x = Math.max(0, Math.min(e.clientX - drag.dx, window.innerWidth - w));
                let y = Math.max(0, Math.min(e.clientY - drag.dy, window.innerHeight - h));
                gui.style.left = `${x}px`;
                gui.style.top  = `${y}px`;
            });
            document.addEventListener('mouseup', () => {
                if (drag) document.body.style.userSelect = '';
                drag = null;
            });
        },

        setupGuiClose() {
            // Global handler — clicking the X on the game/tool modal closes it.
            // Also stops any running game so animation loops don't keep firing.
            const close = () => {
                const gui = document.getElementById('game-gui-container');
                if (!gui) return;
                gui.classList.add('gui-hidden');
                if (window.stopAllGames) try { window.stopAllGames(); } catch(_) {}
                // Restore the terminal input bar in case typing test hid it
                if (window._restoreTerminalInputBar) try { window._restoreTerminalInputBar(); } catch(_) {}
            };
            const btn = document.getElementById('gui-close');
            if (btn) btn.addEventListener('click', close);
            // Esc key closes too
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const gui = document.getElementById('game-gui-container');
                    if (gui && !gui.classList.contains('gui-hidden')) close();
                }
            });
        },

        setupDraggablePanels() {
            // Panels render their fp-header dynamically — use event delegation on document.
            // Only attaches on desktop (≥ MOBILE_BREAKPOINT + 1).
            const POS_KEY = (panelId) => `nexus_panel_pos_${panelId}`;

            // Restore last saved position whenever a panel opens
            const observer = new MutationObserver(() => {
                document.querySelectorAll('.a11y-panel.open, .a11y-panel.a11y-panel-open').forEach(panel => {
                    if (isMobile()) return;
                    if (panel._posRestored) return;
                    panel._posRestored = true;
                    try {
                        const saved = JSON.parse(localStorage.getItem(POS_KEY(panel.id)) || 'null');
                        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                            panel.classList.add('dragged');
                            panel.style.left = `${saved.x}px`;
                            panel.style.top  = `${saved.y}px`;
                        }
                    } catch (_) {}
                });
                // Reset restore flag when panels close so re-opens re-apply
                document.querySelectorAll('.a11y-panel:not(.open):not(.a11y-panel-open)').forEach(p => p._posRestored = false);
            });
            document.querySelectorAll('.a11y-panel').forEach(p => observer.observe(p, { attributes: true, attributeFilter: ['class'] }));

            // Drag — delegated mousedown on .fp-header inside .a11y-panel
            let drag = null;
            document.addEventListener('mousedown', (e) => {
                if (isMobile()) return;
                const header = e.target.closest('.a11y-panel .panel-inner > .fp-header');
                if (!header) return;
                if (e.target.closest('button, input, select, textarea, a')) return;
                const panel = header.closest('.a11y-panel');
                if (!panel) return;
                const rect = panel.getBoundingClientRect();
                drag = { panel, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
                panel.classList.add('dragged');
                panel.style.transition = 'none';
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', (e) => {
                if (!drag) return;
                const { panel, dx, dy } = drag;
                let x = e.clientX - dx;
                let y = e.clientY - dy;
                // Clamp to viewport
                const w = panel.offsetWidth, h = panel.offsetHeight;
                x = Math.max(0, Math.min(x, window.innerWidth  - w));
                y = Math.max(0, Math.min(y, window.innerHeight - h));
                panel.style.left = `${x}px`;
                panel.style.top  = `${y}px`;
            });
            document.addEventListener('mouseup', () => {
                if (!drag) return;
                const { panel } = drag;
                document.body.style.userSelect = '';
                try {
                    const r = panel.getBoundingClientRect();
                    localStorage.setItem(POS_KEY(panel.id), JSON.stringify({ x: r.left, y: r.top }));
                } catch (_) {}
                drag = null;
            });
        },

        setupMobileDrawer() {
            // Tap the collapsed sidebar drawer to expand it (mobile only — CSS gates the collapsed state to ≤MOBILE_BREAKPOINT)
            const aside = document.querySelector('.quick-actions');
            if (!aside) return;
            aside.addEventListener('click', (e) => {
                if (!isMobile()) return;
                if (!aside.classList.contains('open')) {
                    aside.classList.add('open');
                    e.stopPropagation();
                }
            }, true);
            // Tapping the terminal area while the drawer is open collapses it again
            document.querySelector('.terminal-container')?.addEventListener('click', () => {
                if (!isMobile()) return;
                aside.classList.remove('open');
            });
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

// =============================================================
// AUTO-RELOAD ON NEW BUILD
// Polls /api/build on focus + every 30s. If the build stamp changed
// since page load, shows a one-click banner instead of forcing a hard refresh.
// =============================================================
(function _autoBuildWatch(){
    // Runs everywhere (including localhost) — Xavier liked seeing the banner during dev.
    let _bootBuild = null;
    let _bannerShown = false;
    function _showBanner(newBuild){
        if (_bannerShown) return;
        _bannerShown = true;
        const bar = document.createElement('div');
        bar.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:99999; background:#003a3a; color:#0ff; border-bottom:1px solid #0ff; padding:10px 14px; font:600 0.78rem "Fira Code",monospace; text-align:center; letter-spacing:1px; box-shadow:0 2px 12px rgba(0,255,255,0.4); cursor:pointer;';
        bar.innerHTML = '🔄 NEW BUILD AVAILABLE (' + newBuild + ') — click here to reload &nbsp;&nbsp; <span style="opacity:0.6; font-weight:400;">(or press R)</span>';
        bar.onclick = function() { location.reload(); };
        document.body.appendChild(bar);
        document.addEventListener('keydown', function(e) { if (e.key === 'r' || e.key === 'R') location.reload(); }, { once: true });
    }
    async function _check(){
        try {
            const r = await fetch((window.API_BASE || '') + '/api/build', { cache: 'no-store' });
            if (!r.ok) return;
            const j = await r.json();
            const cur = j.build;
            if (!cur) return;
            if (_bootBuild === null) { _bootBuild = cur; return; }
            if (cur !== _bootBuild) _showBanner(cur);
        } catch (_) {}
    }
    setTimeout(_check, 2000);
    setInterval(_check, 30000);
    window.addEventListener('focus', _check);
})();
