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
    // Show the public mini-leaderboard with submit button (Phase B).
    if (window._showMiniLeaderboard) window._showMiniLeaderboard(gameId, score);
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
    // Single full-width 728×90 placeholder. Narrow 320×50 removed per Xavier's feedback.
    // Phrasing kept neutral — Google reviews account before ads fill.
    host.innerHTML = `
        <div style="margin: 14px auto 6px; padding: 14px; min-height: 90px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #6a6a7a; font-size: 0.7rem; letter-spacing: 2px; text-transform: uppercase; font-family: 'Fira Code', monospace; text-align: center; line-height: 1.5;">
            AD SLOT
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
        /* Wider modal for action games — Snake bumped from 400×360 to 600×480 */
        #game-gui-container.gui-game-wide {
            max-width: 660px !important;
            width: min(660px, calc(100vw - 24px)) !important;
        }
        #game-gui-container.gui-game-wide #nexus-canvas {
            display: block !important;
            margin: 0 auto !important;
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
    if (window._hideMiniLeaderboard) window._hideMiniLeaderboard();
};

// =============================================================
// MINI LEADERBOARD — shows top 3 + submit button after every game-over.
// "FULL LEADERBOARD →" link drives traffic to /leaderboard.html (where ads serve).
// Public to ALL visitors (Google users see Submit button, guests see sign-in CTA).
// Wrapped in try/catch so failure can't break the game.
// =============================================================
(function _injectMiniLeaderboardCSS() {
    if (document.getElementById('mlb-style')) return;
    const style = document.createElement('style');
    style.id = 'mlb-style';
    style.textContent = `
        #mini-leaderboard {
            margin: 14px auto 4px;
            padding: 14px 16px;
            max-width: 100%;
            background: rgba(0, 180, 255, 0.04);
            border: 1px solid rgba(0, 180, 255, 0.25);
            border-radius: 6px;
            font-family: 'Fira Code', monospace;
            color: #c9c9d4;
            font-size: 0.78rem;
        }
        #mini-leaderboard .mlb-header {
            color: #00ff88;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 4px;
            font-size: 0.72rem;
        }
        #mini-leaderboard .mlb-title {
            color: #00b4ff;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            font-size: 0.68rem;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 6px;
            margin-bottom: 8px;
        }
        #mini-leaderboard .mlb-row {
            display: grid;
            grid-template-columns: 36px 1fr auto;
            gap: 10px;
            align-items: center;
            padding: 4px 0;
            font-size: 0.74rem;
        }
        #mini-leaderboard .mlb-rank { font-weight: 700; color: #888; text-align: center; }
        #mini-leaderboard .mlb-row.top1 .mlb-rank { color: #ffd700; }
        #mini-leaderboard .mlb-row.top2 .mlb-rank { color: #c0c0c0; }
        #mini-leaderboard .mlb-row.top3 .mlb-rank { color: #cd7f32; }
        #mini-leaderboard .mlb-handle { color: #fff; }
        #mini-leaderboard .mlb-score { color: #00b4ff; font-weight: 700; }
        #mini-leaderboard .mlb-empty { color: #666; padding: 8px 0; font-style: italic; }
        #mini-leaderboard .mlb-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.08);
            flex-wrap: wrap;
            align-items: center;
        }
        #mini-leaderboard .mlb-submit-btn {
            background: rgba(0, 255, 136, 0.12);
            color: #00ff88;
            border: 1px solid #00ff88;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.7rem;
            letter-spacing: 1.5px;
            font-weight: 700;
            transition: 0.18s;
        }
        #mini-leaderboard .mlb-submit-btn:hover { background: rgba(0,255,136,0.25); box-shadow: 0 0 8px #00ff88; }
        #mini-leaderboard .mlb-submit-btn:disabled { opacity: 0.5; cursor: wait; }
        #mini-leaderboard .mlb-signin {
            color: #888;
            font-size: 0.7rem;
            font-style: italic;
        }
        #mini-leaderboard .mlb-full-link {
            color: #00b4ff;
            text-decoration: none;
            border-bottom: 1px dotted #00b4ff;
            font-size: 0.7rem;
            letter-spacing: 1.5px;
            font-weight: 700;
            margin-left: auto;
        }
        #mini-leaderboard .mlb-full-link:hover { color: #fff; border-bottom-color: #fff; }
        #mini-leaderboard .mlb-msg {
            color: #00ff88;
            font-size: 0.72rem;
            margin-top: 8px;
            font-style: italic;
        }
        #mini-leaderboard .mlb-msg.err { color: #ff6666; }
    `;
    document.head.appendChild(style);
})();

window._showMiniLeaderboard = function(gameId, score) {
    try {
        const wrapper = document.getElementById('gui-content-wrapper');
        if (!wrapper) return;

        let panel = document.getElementById('mini-leaderboard');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'mini-leaderboard';
            wrapper.appendChild(panel);
        }
        panel.dataset.game = gameId;
        panel.dataset.score = String(score);
        panel.innerHTML = `<div class="mlb-empty">Loading top scores…</div>`;

        const u = (() => { try { return JSON.parse(localStorage.getItem('nexus_user_data') || '{}'); } catch { return {}; } })();
        const isGoogle = !!u.email && u.email !== 'guest@local';

        fetch(`${window.API_BASE || ''}/api/leaderboard/${encodeURIComponent(gameId)}?limit=3`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                const entries = (data.entries || []).slice(0, 3);
                const escapeHTML = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
                const rows = entries.length ? entries.map(e => {
                    const t = e.rank === 1 ? 'top1' : e.rank === 2 ? 'top2' : e.rank === 3 ? 'top3' : '';
                    return `<div class="mlb-row ${t}">
                        <span class="mlb-rank">#${e.rank}</span>
                        <span class="mlb-handle">${escapeHTML(e.handle)}</span>
                        <span class="mlb-score">${e.score.toLocaleString()}</span>
                    </div>`;
                }).join('') : `<div class="mlb-empty">No scores submitted yet — be the first.</div>`;

                const submitBtn = isGoogle
                    ? `<button class="mlb-submit-btn" onclick="window._submitScoreToLeaderboard()">SUBMIT YOUR SCORE</button>`
                    : `<div class="mlb-signin">Sign in with Google to submit</div>`;

                panel.innerHTML = `
                    <div class="mlb-header">YOUR SCORE: ${score.toLocaleString()}</div>
                    <div class="mlb-title">Top 3 · ${escapeHTML(gameId).replace(/_/g,' ').toUpperCase()}</div>
                    ${rows}
                    <div class="mlb-actions">
                        ${submitBtn}
                        <a href="leaderboard.html" target="_blank" rel="noopener" class="mlb-full-link">FULL LEADERBOARD →</a>
                    </div>
                    <div id="mlb-msg" class="mlb-msg" style="display:none;"></div>
                `;
            })
            .catch(e => {
                console.warn('[mlb] fetch failed', e);
                panel.innerHTML = `
                    <div class="mlb-empty">Couldn't reach leaderboard service.</div>
                    <div class="mlb-actions">
                        <a href="leaderboard.html" target="_blank" rel="noopener" class="mlb-full-link">VIEW BOARDS →</a>
                    </div>
                `;
            });
    } catch (e) { console.warn('[mlb] show failed', e); }
};

window._hideMiniLeaderboard = function() {
    const panel = document.getElementById('mini-leaderboard');
    if (panel) panel.remove();
};

window._submitScoreToLeaderboard = async function() {
    const panel = document.getElementById('mini-leaderboard');
    if (!panel) return;
    const gameId = panel.dataset.game;
    const score = parseInt(panel.dataset.score, 10);
    const btn = panel.querySelector('.mlb-submit-btn');
    const msg = panel.querySelector('#mlb-msg');
    if (!gameId || isNaN(score)) return;

    if (btn) { btn.disabled = true; btn.textContent = 'SUBMITTING…'; }

    try {
        const r = await fetch(`${window.API_BASE || ''}/api/leaderboard/submit`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: gameId, score: score }),
        });
        const data = await r.json();

        if (data.needs_handle) {
            // Inline handle setup — prompt for one, save, then retry submit.
            if (btn) { btn.disabled = false; btn.textContent = 'SUBMIT YOUR SCORE'; }
            const handle = prompt(
                'Pick your leaderboard handle.\n\n' +
                'Rules: 3-20 characters, letters / numbers / underscore / dash only.\n' +
                'This is what shows on the public leaderboard — your real Google name stays private.'
            );
            if (!handle) return;
            const hr = await fetch(`${window.API_BASE || ''}/api/me/handle`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: handle.trim() }),
            });
            const hdata = await hr.json();
            if (!hr.ok) {
                if (msg) { msg.style.display = ''; msg.classList.add('err'); msg.textContent = hdata.error || 'Handle rejected.'; }
                return;
            }
            // Retry submit with new handle
            return window._submitScoreToLeaderboard();
        }

        if (!r.ok) {
            throw new Error(data.error || `HTTP ${r.status}`);
        }

        // Success
        if (msg) {
            msg.style.display = '';
            msg.classList.remove('err');
            msg.innerHTML = `<b>${data.handle}</b> submitted at rank <b>#${data.rank || '?'}</b>. Game on.`;
        }
        if (btn) { btn.style.display = 'none'; }
        // Refresh the visible top 3 with the new entry
        setTimeout(() => window._showMiniLeaderboard(gameId, score), 600);
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'SUBMIT YOUR SCORE'; }
        if (msg) { msg.style.display = ''; msg.classList.add('err'); msg.textContent = '[' + (e.message || 'submit failed') + ']'; }
    }
};
