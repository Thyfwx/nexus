let snakeRaf = null;
let _snakeTS = null, _snakeTE = null, _snakeKey = null;

function startSnake() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS SNAKE';
    nexusCanvas.style.display = 'none';

    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT MODE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:300px;margin:0 auto;">
                <button class="gui-btn snake-mode" data-mode="classic" style="border-color:#0ff;color:#0ff;">CLASSIC</button>
                <button class="gui-btn snake-mode" data-mode="speed"   style="border-color:#ff0;color:#ff0;">SPEED RUN</button>
                <button class="gui-btn snake-mode" data-mode="endless" style="border-color:#0f0;color:#0f0;">ENDLESS</button>
                <button class="gui-btn snake-mode" data-mode="stealth" style="border-color:#888;color:#888;">STEALTH</button>
            </div>
            <div style="color:#333;font-size:0.65rem;margin-top:16px;line-height:1.8;">
                SPEED RUN  starts fast, gets faster<br>
                ENDLESS  walls wrap around<br>
                STEALTH  no grid, pure instinct
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

    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px;font-size:0.75rem;color:#0ff;margin-bottom:4px;">
            <span>Arrows  WASD  Swipe</span>
            <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${snakeMode.toUpperCase()}</span>
            <span>Score: <b id="snake-score">0</b> &nbsp;<span style="color:#333">HI:${snakeHi}</span></span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');
    const CELL = 20, COLS = 20, ROWS = 18;
    snakeActive = true;

    // Pre-draw background once into an offscreen canvas for perf
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 400; bgCanvas.height = 360;
    const bgCtx = bgCanvas.getContext('2d');
    (function buildBg() {
        // Dark base
        bgCtx.fillStyle = '#050510';
        bgCtx.fillRect(0, 0, 400, 360);
        
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

        // Death overlay
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, 400, 360);

        // Glitch border
        ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2;
        ctx.strokeRect(16, 90, 368, 180);
        ctx.strokeStyle = 'rgba(0,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(14, 88, 372, 184);

        ctx.textAlign = 'center';
        // Title
        ctx.fillStyle = '#0ff'; ctx.font = 'bold 32px monospace';
        ctx.fillText('YOU DIED', 200, 138);
        // Mode badge
        ctx.fillStyle = '#333'; ctx.font = '11px monospace';
        ctx.fillText(` ${snakeMode.toUpperCase()} MODE `, 200, 158);
        // Score
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace';
        ctx.fillText(`Score: ${score}`, 200, 190);
        // High score
        const isNew = score === snakeHi && score > 0;
        ctx.fillStyle = isNew ? '#ff0' : '#555';
        ctx.font = '13px monospace';
        ctx.fillText(isNew ? ` NEW BEST: ${snakeHi} ` : `Best: ${snakeHi}`, 200, 212);
        // Restart prompt
        ctx.fillStyle = '#0ff'; ctx.font = '12px monospace';
        ctx.fillText('CLICK  ENTER  SWIPE  to restart', 200, 244);
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

        // Apple glow
        ctx.shadowBlur = 10; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(apple.x*CELL+3, apple.y*CELL+3, CELL-6, CELL-6);

        // Body segments  no per-segment shadow (perf)
        ctx.shadowBlur = 0;
        snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? '#fff' : `hsl(${140 + i * 3},100%,55%)`;
            ctx.fillRect(seg.x*CELL+1, seg.y*CELL+1, CELL-2, CELL-2);
        });
        // Head glow only
        if (snake.length > 0) {
            ctx.shadowBlur = 14; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#fff';
            ctx.fillRect(snake[0].x*CELL+1, snake[0].y*CELL+1, CELL-2, CELL-2);
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
}
