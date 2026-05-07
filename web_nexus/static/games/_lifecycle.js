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
