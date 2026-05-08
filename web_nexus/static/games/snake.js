let snakeRaf = null;
let _snakeTS = null, _snakeTE = null, _snakeKey = null;

function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiContainer.classList.add('gui-game-wide');  // widen modal for bigger canvas
    guiTitle.textContent = 'NEXUS SNAKE';
    nexusCanvas.style.display = 'none';

    // Shared button style — all four modes use the same dimensions/layout.
    // Color comes from CSS variables we set per-button below.
    const _btnStyle = `
        padding: 22px 14px;
        border-width: 1.5px;
        border-style: solid;
        border-radius: 6px;
        background: var(--mode-bg);
        border-color: var(--mode-color);
        color: var(--mode-color);
        cursor: pointer;
        transition: 0.18s;
        font-family: 'Fira Code', monospace;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 88px;
    `.trim();

    guiContent.innerHTML = `
        <style>
            .snake-pick {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 14px;
                margin: 0 auto;
                max-width: 460px;
            }
            .snake-pick button.snake-mode {
                ${_btnStyle.replace(/\n/g, ' ')}
            }
            .snake-pick button.snake-mode .mode-name {
                font-size: 1rem;
                font-weight: 700;
                letter-spacing: 2.5px;
                line-height: 1;
            }
            .snake-pick button.snake-mode .mode-desc {
                font-size: 0.62rem;
                opacity: 0.65;
                letter-spacing: 1px;
                line-height: 1.3;
            }
            .snake-pick button.snake-mode:hover {
                background: var(--mode-bg-hov) !important;
                box-shadow: 0 0 18px var(--mode-color);
            }
            @media (max-width: 480px) {
                .snake-pick { grid-template-columns: 1fr; max-width: 280px; }
            }
        </style>
        <div style="text-align:center; padding:24px 12px;">
            <div style="color:#0ff; letter-spacing:4px; font-size:0.85rem; font-weight:700; margin-bottom:6px; text-shadow:0 0 12px #0ff;">SELECT MODE</div>
            <div style="color:#666; font-size:0.7rem; margin-bottom:24px; letter-spacing:1px;">Pick how you want to die</div>
            <div class="snake-pick">
                <button class="snake-mode" data-mode="classic"
                    style="--mode-color:#0ff; --mode-bg:rgba(0,255,255,0.06); --mode-bg-hov:rgba(0,255,255,0.18);">
                    <span class="mode-name">CLASSIC</span>
                    <span class="mode-desc">walls kill · steady pace</span>
                </button>
                <button class="snake-mode" data-mode="speed"
                    style="--mode-color:#ff0; --mode-bg:rgba(255,255,0,0.06); --mode-bg-hov:rgba(255,255,0,0.18);">
                    <span class="mode-name">SPEED RUN</span>
                    <span class="mode-desc">fast · gets faster</span>
                </button>
                <button class="snake-mode" data-mode="endless"
                    style="--mode-color:#0f0; --mode-bg:rgba(0,255,0,0.06); --mode-bg-hov:rgba(0,255,0,0.18);">
                    <span class="mode-name">ENDLESS</span>
                    <span class="mode-desc">walls wrap · only self kills</span>
                </button>
                <button class="snake-mode" data-mode="stealth"
                    style="--mode-color:#888; --mode-bg:rgba(255,255,255,0.04); --mode-bg-hov:rgba(255,255,255,0.14);">
                    <span class="mode-name">STEALTH</span>
                    <span class="mode-desc">no grid · pure instinct</span>
                </button>
            </div>
        </div>`;

    guiContent.querySelectorAll('.snake-mode').forEach(btn => {
        btn.addEventListener('click', () => launchSnake(btn.dataset.mode));
    });
}

function launchSnake(snakeMode) {
    const stealth  = snakeMode === 'stealth';
    const endless  = snakeMode === 'endless';
    const speedRun = snakeMode === 'speed';
    const hiKey    = `snake_hi_${snakeMode}`;
    let   snakeHi  = parseInt(localStorage.getItem(hiKey) || '0');

    // Mode color for the title bar accent
    const modeColor = snakeMode === 'classic' ? '#0ff'
                    : snakeMode === 'speed'   ? '#ff0'
                    : snakeMode === 'endless' ? '#0f0' : '#888';

    guiContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; font-size:0.78rem; color:#aaa; margin-bottom:8px; background:rgba(255,255,255,0.02); border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
            <span style="color:#666; font-size:0.7rem; letter-spacing:1px;">ARROWS / WASD / SWIPE</span>
            <span style="color:${modeColor}; font-size:0.7rem; letter-spacing:2px; font-weight:700;">${snakeMode.toUpperCase()}</span>
            <span style="color:#fff;">SCORE <b id="snake-score" style="color:${modeColor}; text-shadow:0 0 8px ${modeColor};">0</b> <span style="color:#444; font-size:0.7rem; margin-left:8px;">HI ${snakeHi}</span></span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.style.maxWidth = '100%';
    nexusCanvas.style.height = 'auto';
    nexusCanvas.style.borderRadius = '4px';
    nexusCanvas.style.border = `1px solid ${modeColor}33`;
    nexusCanvas.style.boxShadow = `0 0 24px ${modeColor}22`;
    nexusCanvas.width = 600; nexusCanvas.height = 480;  // up from 400×360 — 50% more play area
    const ctx = nexusCanvas.getContext('2d');
    const CELL = 24, COLS = 25, ROWS = 20;  // 24px cells (was 20px) — bigger, more readable
    snakeActive = true;

    // Pre-draw background once into an offscreen canvas for perf
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 600; bgCanvas.height = 480;
    const bgCtx = bgCanvas.getContext('2d');
    (function buildBg() {
        // Dark base
        bgCtx.fillStyle = '#050510';
        bgCtx.fillRect(0, 0, 600, 480);
        
        if (stealth) return; // Stay dark for stealth mode

        // Cool Circuit Grid
        bgCtx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
        bgCtx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
            bgCtx.beginPath(); bgCtx.moveTo(x * CELL, 0); bgCtx.lineTo(x * CELL, ROWS * CELL); bgCtx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
            bgCtx.beginPath(); bgCtx.moveTo(0, y * CELL); bgCtx.lineTo(COLS * CELL, y * CELL); bgCtx.stroke();
        }
        
        // Circuit traces
        bgCtx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        bgCtx.lineWidth = 1.5;
        const traces = [[0,3,4,3,4,8,7,8],[COLS,12,COLS-3,12,COLS-3,7,COLS-6,7],[5,0,5,4,10,4],[8,ROWS,8,ROWS-3,14,ROWS-3,14,ROWS-6]];
        traces.forEach(pts => {
            bgCtx.beginPath();
            bgCtx.moveTo(pts[0]*CELL, pts[1]*CELL);
            for (let i=2;i<pts.length;i+=2) bgCtx.lineTo(pts[i]*CELL, pts[i+1]*CELL);
            bgCtx.stroke();
        });

        // Glowing nodes
        bgCtx.shadowBlur = 6; bgCtx.shadowColor = '#0ff';
        bgCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        [[4,3],[4,8],[7,8],[COLS-3,12],[COLS-3,7],[5,4],[10,4],[8,ROWS-3],[14,ROWS-3],[14,ROWS-6]].forEach(([cx,cy]) => {
            bgCtx.beginPath(); bgCtx.arc(cx*CELL, cy*CELL, 2.5, 0, Math.PI*2); bgCtx.fill();
        });
        bgCtx.shadowBlur = 0;

        if (endless) {
            bgCtx.fillStyle = 'rgba(0, 255, 255, 0.02)';
            bgCtx.fillRect(0,0,3,ROWS*CELL); bgCtx.fillRect(COLS*CELL-3,0,3,ROWS*CELL);
            bgCtx.fillRect(0,0,COLS*CELL,3); bgCtx.fillRect(0,ROWS*CELL-3,COLS*CELL,3);
        }
    })();

    let snake = [{ x: 10, y: 9 }, { x: 9, y: 9 }, { x: 8, y: 9 }];
    let dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
    let apple = spawnApple();
    let score = 0, dead = false;
    let stepMs = speedRun ? 70 : 100, lastStep = 0;

    function spawnApple() {
        let a;
        do { a = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
        while (snake.some(s => s.x === a.x && s.y === a.y));
        return a;
    }

    _snakeKey = (e) => {
        if (dead) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launchSnake(snakeMode); }
            return;
        }
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) e.preventDefault();
        // Guard against 180 reverse using nextDir (not dir) so rapid keypresses don't teleport into self
        if ((e.key === 'ArrowUp'    || e.key === 'w') && nextDir.y !== 1)  nextDir = { x: 0, y: -1 };
        if ((e.key === 'ArrowDown'  || e.key === 's') && nextDir.y !== -1) nextDir = { x: 0, y: 1 };
        if ((e.key === 'ArrowLeft'  || e.key === 'a') && nextDir.x !== 1)  nextDir = { x: -1, y: 0 };
        if ((e.key === 'ArrowRight' || e.key === 'd') && nextDir.x !== -1) nextDir = { x: 1, y: 0 };
    };
    document.addEventListener('keydown', _snakeKey);

    let swipeX = 0, swipeY = 0;
    _snakeTS = (e) => { swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; };
    _snakeTE = (e) => {
        if (dead) { launchSnake(snakeMode); return; }
        const dx = e.changedTouches[0].clientX - swipeX;
        const dy = e.changedTouches[0].clientY - swipeY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
            if (dx > 0 && nextDir.x !== -1) nextDir = { x: 1, y: 0 };
            else if (dx < 0 && nextDir.x !== 1) nextDir = { x: -1, y: 0 };
        } else if (Math.abs(dy) > 25) {
            if (dy > 0 && nextDir.y !== -1) nextDir = { x: 0, y: 1 };
            else if (dy < 0 && nextDir.y !== 1) nextDir = { x: 0, y: -1 };
        }
    };
    nexusCanvas.addEventListener('touchstart', _snakeTS, { passive: true });
    nexusCanvas.addEventListener('touchend',   _snakeTE, { passive: true });

    function gameOver() {
        dead = true;
        // STOP the loop immediately  this prevents drawSnake() from wiping the death screen
        snakeActive = false;
        cancelAnimationFrame(snakeRaf);
        if (score > snakeHi) { snakeHi = score; localStorage.setItem(hiKey, snakeHi); }

        SoundManager.playBloop(150, 0.2);
        submitScore(`snake_${snakeMode}`, score);

        drawSnake(); // draw final game state first

        // Death overlay — centered for 600×480 canvas
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, 600, 480);

        const cx = 300, cy = 240;  // canvas center

        // Glitch border (centered card)
        ctx.strokeStyle = modeColor; ctx.lineWidth = 2;
        ctx.strokeRect(cx - 200, cy - 100, 400, 220);
        ctx.strokeStyle = modeColor + '66'; ctx.lineWidth = 1;
        ctx.strokeRect(cx - 204, cy - 104, 408, 228);

        ctx.textAlign = 'center';
        // Title — bigger, mode-colored
        ctx.fillStyle = modeColor;
        ctx.font = 'bold 42px monospace';
        ctx.shadowBlur = 18; ctx.shadowColor = modeColor;
        ctx.fillText('YOU DIED', cx, cy - 50);
        ctx.shadowBlur = 0;
        // Mode badge
        ctx.fillStyle = '#666'; ctx.font = '13px monospace';
        ctx.fillText(`· ${snakeMode.toUpperCase()} MODE ·`, cx, cy - 22);
        // Score
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace';
        ctx.fillText(`SCORE: ${score}`, cx, cy + 18);
        // High score
        const isNew = score === snakeHi && score > 0;
        ctx.fillStyle = isNew ? '#ff0' : '#888';
        ctx.font = isNew ? 'bold 16px monospace' : '14px monospace';
        if (isNew) {
            ctx.shadowBlur = 12; ctx.shadowColor = '#ff0';
            ctx.fillText(`★ NEW BEST: ${snakeHi} ★`, cx, cy + 50);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillText(`Best: ${snakeHi}`, cx, cy + 50);
        }
        // Restart prompt
        ctx.fillStyle = modeColor + 'cc'; ctx.font = '13px monospace';
        ctx.fillText('CLICK · ENTER · SWIPE  to restart', cx, cy + 90);
        ctx.textAlign = 'left';

        nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchSnake(snakeMode); };
    }

    function frame(ts) {
        if (!snakeActive) return;
        // Register next frame AFTER dead check so death screen is never overwritten
        if (ts - lastStep < stepMs) { drawSnake(); snakeRaf = requestAnimationFrame(frame); return; }
        lastStep = ts;

        dir = nextDir;
        let head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (endless) {
            head.x = (head.x + COLS) % COLS;
            head.y = (head.y + ROWS) % ROWS;
            // Skip self-check on tail tip (it's about to vacate unless we just ate)
            const body = snake.slice(0, snake.length - 1);
            if (body.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
        } else {
            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
                snake.slice(0, snake.length - 1).some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
        }

        const ate = head.x === apple.x && head.y === apple.y;
        snake.unshift(head);
        if (ate) {
            score++; apple = spawnApple();
            SoundManager.playBloop(600, 0.05);
            const el = document.getElementById('snake-score');
            if (el) el.textContent = score;
            if (speedRun) stepMs = Math.max(40, 70  - Math.floor(score / 3) * 8);
            else          stepMs = Math.max(50, 100 - Math.floor(score / 5) * 8);
        } else {
            snake.pop();
        }

        drawSnake();
        if (snakeActive) snakeRaf = requestAnimationFrame(frame);
    }

    function drawSnake() {
        ctx.drawImage(bgCanvas, 0, 0); // blit pre-drawn background

        // Apple glow — already inset by 3px so it stays inside the 3px wall border
        ctx.shadowBlur = 10; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(apple.x*CELL+3, apple.y*CELL+3, CELL-6, CELL-6);

        // Body segments — bumped inset from 1px to 3px so cells in row/col 19/17 (the edges)
        // no longer visually overlap the 3px wall border. Was: cell width 18 reached pixel 399
        // at the right edge, encroaching into wall (397-400). Now: cell width 14 stops at 397.
        ctx.shadowBlur = 0;
        snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? '#fff' : `hsl(${140 + i * 3},100%,55%)`;
            ctx.fillRect(seg.x*CELL+3, seg.y*CELL+3, CELL-6, CELL-6);
        });
        // Head glow only
        if (snake.length > 0) {
            ctx.shadowBlur = 14; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#fff';
            ctx.fillRect(snake[0].x*CELL+3, snake[0].y*CELL+3, CELL-6, CELL-6);
            ctx.shadowBlur = 0;
        }
    }

    snakeRaf = requestAnimationFrame(frame);
}

function stopSnake() {
    snakeActive = false;
    cancelAnimationFrame(snakeRaf);
    if (_snakeKey) { document.removeEventListener('keydown', _snakeKey); _snakeKey = null; }
    if (_snakeTS)  { nexusCanvas.removeEventListener('touchstart', _snakeTS); _snakeTS = null; }
    if (_snakeTE)  { nexusCanvas.removeEventListener('touchend',   _snakeTE); _snakeTE = null; }
    // Reset canvas styling we applied
    nexusCanvas.style.maxWidth = '';
    nexusCanvas.style.height = '';
    nexusCanvas.style.borderRadius = '';
    nexusCanvas.style.border = '';
    nexusCanvas.style.boxShadow = '';
    if (typeof guiContainer !== 'undefined' && guiContainer) {
        guiContainer.classList.remove('gui-game-wide');
    }
}
