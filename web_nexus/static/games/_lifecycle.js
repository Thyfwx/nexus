// =============================================================
// 🛰️ NEXUS GAMES · _LIFECYCLE
// Globals shared across game files + the universal stopAllGames().
// MUST load BEFORE every individual game file. Each game owns its own
// game-specific state in its own file (mine grid, wordle word, etc.) —
// only RAF handles + cross-file activity flags live here.
// =============================================================

// Animation-frame handles — set by each game when it starts, read by stopAllGames.
let pongRaf = null;
let flappyFrame = null;
let invadersRaf = null;
let breakoutRaf = null;
let matrixRaf = null;

// Activity flags — set by start*, cleared in stopAllGames so games can early-exit on tick.
let breachActive = false;
let snakeActive = false;
let invadersActive = false;
let flappyActive = false;
let typeTestActive = false;
let mineActive = false;

// Intervals (used by typing test + maintenance/stats poll)
let typeTimerInterval = null;
let monitorInterval = null;

// Cleanup registry — any panel (game OR utility like the hub/speedtest) pushes a
// teardown function in here when it opens. stopAllGames() drains it before any
// new panel renders, so we never leave a poll alive or stale DOM stacked underneath.
window._panelCleanups = window._panelCleanups || [];
window.registerPanelCleanup = function(fn) {
    if (typeof fn === 'function') window._panelCleanups.push(fn);
};

// Single source of truth for terminating any running panel (game OR utility).
function stopAllGames() {
    if (typeof stopPong === 'function')         stopPong();
    if (typeof stopSnake === 'function')        stopSnake();
    if (typeof stopWordle === 'function')       stopWordle();
    if (typeof stopMatrixSaver === 'function')  stopMatrixSaver();
    if (typeof stopFlappy === 'function')       stopFlappy();
    if (typeof stopBreakout === 'function')     stopBreakout();
    if (typeof stopInvaders === 'function')     stopInvaders();
    mineActive = false;
    breachActive = false;
    typeTestActive = false;
    clearInterval(typeTimerInterval);
    clearInterval(monitorInterval);

    // Drain every registered panel cleanup (hub poll, speedtest interval, etc.)
    while (window._panelCleanups && window._panelCleanups.length) {
        try { (window._panelCleanups.pop())(); } catch (e) { console.warn('panel cleanup failed:', e); }
    }

    if (typeof input !== 'undefined' && input) {
        input.value = '';
        input.focus();
    }

    if (typeof nexusCanvas !== 'undefined' && nexusCanvas) {
        nexusCanvas.onclick = null;
        nexusCanvas.onmousedown = null;
        nexusCanvas.onmousemove = null;
        nexusCanvas.ontouchstart = null;
        nexusCanvas.ontouchmove = null;
        nexusCanvas.ontouchend = null;
        nexusCanvas.style.display = 'none';
    }

    cancelAnimationFrame(pongRaf);
    cancelAnimationFrame(flappyFrame);
    cancelAnimationFrame(breakoutRaf);
    cancelAnimationFrame(invadersRaf);
    cancelAnimationFrame(matrixRaf);

    // Wipe panel content so the next panel renders on a blank slate (kills the "stacking" bug).
    if (window.guiContent) window.guiContent.innerHTML = '';
}
window.stopAllGames = stopAllGames;

// =============================================================
// submitScore — shared high-score tracker called by every game's
// game-over path. Stores last 10 scores per game in localStorage
// under 'nexus_game_scores'. No-op if anything throws so a flaky
// localStorage on Safari Private / Firefox-strict doesn't crash
// the game. Called as: submitScore('pong', 23) or submitScore('snake_classic', 200).
// =============================================================
window.submitScore = function(gameId, score) {
    try {
        if (!gameId || typeof score !== 'number' || !isFinite(score)) return;
        const KEY = 'nexus_game_scores';
        const all = JSON.parse(localStorage.getItem(KEY) || '{}');
        const list = all[gameId] || [];
        list.push({ score, ts: Date.now() });
        list.sort((a, b) => b.score - a.score);  // highest first
        all[gameId] = list.slice(0, 10);          // keep top 10
        localStorage.setItem(KEY, JSON.stringify(all));
    } catch (_) { /* no-op on storage failure */ }
    // Pop the game-over ad (owner-gated) the moment a game ends.
    if (window._showGameOverAd) window._showGameOverAd(gameId, score);
};
// Function declaration shadow so non-window callers (e.g. submitScore('pong', x)
// inside a game module's local scope) resolve via the global.
function submitScore(gameId, score) { return window.submitScore(gameId, score); }

// =============================================================
// GAME-OVER AD SLOT — shared across all 8 games. Owner-gated until
// AdSense fills the slot. Single helper called from submitScore so
// every game's death path triggers it without per-file edits.
// =============================================================
window._showGameOverAd = function(gameId, score) {
    if (window.NEXUS_DISABLE_ADS) return;
    if (window.NEXUS_DISABLE_GAMEOVER_AD) return;
    if (!window.OWNER_MODE) return;
    let host = document.getElementById('game-over-ad-host');
    if (!host) {
        const wrapper = document.getElementById('gui-content-wrapper');
        if (!wrapper) return;
        host = document.createElement('div');
        host.id = 'game-over-ad-host';
        host.style.cssText = 'padding: 0 14px;';
        wrapper.appendChild(host);
    }
    host.innerHTML = `
        <div style="margin: 14px auto 6px; padding: 14px; min-height: 90px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #6a6a7a; font-size: 0.7rem; letter-spacing: 2px; text-transform: uppercase; font-family: 'Fira Code', monospace; text-align: center; line-height: 1.5;">
            <div>
                <div>AD SLOT · 728 × 90 · pending AdSense approval</div>
                <div style="font-size: 0.6rem; opacity: 0.6; margin-top: 4px;">[ Game-Over · ${(gameId || '').toUpperCase()} ]</div>
            </div>
        </div>
        <div style="margin: 8px auto 4px; padding: 14px; min-height: 50px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #6a6a7a; font-size: 0.7rem; letter-spacing: 2px; text-transform: uppercase; font-family: 'Fira Code', monospace;">
            <span>AD SLOT · 320 × 50 · pending AdSense approval</span>
        </div>
    `;
};

window._hideGameOverAd = function() {
    const host = document.getElementById('game-over-ad-host');
    if (host) host.innerHTML = '';
};

// =============================================================
// MID-PLAY SIDE AD — generic for all 8 games. Activates whenever the
// game GUI container becomes visible (any game starting), hides when
// it goes back to gui-hidden. Vertical 300×600 skyscraper format
// per Xavier's preference. Owner-gated until AdSense approved.
// =============================================================
window._showGameSideAd = function(gameLabel) {
    if (window.NEXUS_DISABLE_ADS) return;
    if (window.NEXUS_DISABLE_SIDE_AD) return;
    if (!window.OWNER_MODE) return;
    const wrapper = document.getElementById('gui-content-wrapper');
    if (!wrapper) return;
    let ad = document.getElementById('game-side-ad-host');
    if (!ad) {
        ad = document.createElement('aside');
        ad.id = 'game-side-ad-host';
        wrapper.appendChild(ad);
    }
    ad.style.cssText = 'flex: 0 0 300px; min-width: 0; display: flex; flex-direction: column; gap: 10px; align-self: stretch;';
    ad.innerHTML = `
        <div style="flex: 1 1 auto; min-height:600px; padding:14px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.12); border-radius:4px; display:flex; align-items:center; justify-content:center; color:#6a6a7a; font-size:0.7rem; letter-spacing:2px; text-transform:uppercase; font-family:'Fira Code',monospace; text-align:center; line-height:1.5;">
            <div>
                <div>AD SLOT · 300 × 600</div>
                <div style="font-size:0.6rem; opacity:0.6; margin-top:6px;">[ ${(gameLabel || 'GAME').toUpperCase()} · side rail · vertical ]</div>
            </div>
        </div>
    `;
    // Make wrapper a flex row so canvas/content + side ad sit side-by-side
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'row';
    wrapper.style.gap = '14px';
    wrapper.style.alignItems = 'flex-start';
    // Widen the gui container to accommodate the side rail
    const guiContainer = document.getElementById('game-gui-container');
    if (guiContainer) guiContainer.classList.add('gui-side-ad-wide');
};

window._hideGameSideAd = function() {
    const ad = document.getElementById('game-side-ad-host');
    if (ad) ad.style.display = 'none';
    const wrapper = document.getElementById('gui-content-wrapper');
    if (wrapper) {
        wrapper.style.display = '';
        wrapper.style.flexDirection = '';
        wrapper.style.gap = '';
        wrapper.style.alignItems = '';
    }
    const guiContainer = document.getElementById('game-gui-container');
    if (guiContainer) guiContainer.classList.remove('gui-side-ad-wide');
};

// Auto-trigger on guiContainer visibility changes — wrapped + kill-switched
(function _wireGameSideAdAutoTrigger() {
    const setup = () => {
        try {
            if (window.NEXUS_DISABLE_ADS) return;
            const guiContainer = document.getElementById('game-gui-container');
            if (!guiContainer) { setTimeout(setup, 100); return; }
            const update = () => {
                try {
                    if (window.NEXUS_DISABLE_ADS) return;
                    const isVisible = !guiContainer.classList.contains('gui-hidden');
                    if (isVisible && window.OWNER_MODE) {
                        const title = document.getElementById('gui-title');
                        window._showGameSideAd && window._showGameSideAd(title ? title.textContent.trim() : 'GAME');
                    } else {
                        window._hideGameSideAd && window._hideGameSideAd();
                    }
                } catch (e) { console.warn('[side-ad-update]', e); }
            };
            new MutationObserver(update).observe(guiContainer, { attributes: true, attributeFilter: ['class'] });
            update();
        } catch (e) { console.warn('[side-ad-setup]', e); }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();

// Inject CSS for the wider gui container during games (don't touch locked style.css)
(function _injectGameSideAdCSS() {
    if (document.getElementById('gui-side-ad-style')) return;
    const style = document.createElement('style');
    style.id = 'gui-side-ad-style';
    style.textContent = `
        #game-gui-container.gui-side-ad-wide {
            max-width: 780px !important;
            width: min(780px, calc(100vw - 32px)) !important;
        }
        @media (max-width: 820px) {
            #game-gui-container.gui-side-ad-wide #game-side-ad-host {
                flex: 1 1 100% !important;
            }
            #game-gui-container.gui-side-ad-wide #gui-content-wrapper {
                flex-direction: column !important;
            }
        }
    `;
    document.head.appendChild(style);
})();

// Wipe game-over ad whenever stopAllGames runs (game-over ad ≠ side ad — side ad is
// auto-managed by the MutationObserver above based on guiContainer visibility).
const _origStopAllGames_adWrap = window.stopAllGames;
window.stopAllGames = function() {
    if (_origStopAllGames_adWrap) _origStopAllGames_adWrap();
    if (window._hideGameOverAd) window._hideGameOverAd();
};
