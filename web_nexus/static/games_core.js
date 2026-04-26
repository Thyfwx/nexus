// =============================================================
//  BREACH PROTOCOL (Hacking Game)
// =============================================================
let breachActive = false, _breachClick = null;

function startBreach() {
    stopAllGames();
    breachActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'BREACH PROTOCOL';
    
    const hexCodes = ['E9', '1C', '55', 'BD', '7A', 'FF', 'F0'];
    const grid = [];
    for(let i=0; i<25; i++) grid.push(hexCodes[Math.floor(Math.random() * hexCodes.length)]);
    
    const sequence = [];
    for(let i=0; i<3; i++) sequence.push(grid[Math.floor(Math.random() * grid.length)]);
    
    let currentInput = [];
    let timeLeft = 30;
    
    guiContent.innerHTML = `
        <div style="text-align:center;">
            <div style="color:#0f0;font-size:0.75rem;margin-bottom:8px;">REQUIRED SEQUENCE: <b style="color:#fff;letter-spacing:2px;">${sequence.join(' ')}</b></div>
            <div id="breach-grid" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;max-width:250px;margin:0 auto;">
                ${grid.map((hex, i) => `<button class="gui-btn breach-tile" data-idx="${i}" style="margin:0;padding:8px;font-size:0.8rem;border-color:#333;">${hex}</button>`).join('')}
            </div>
            <div id="breach-timer" style="margin-top:12px;color:#f00;font-weight:bold;">${timeLeft}s</div>
        </div>`;
    
    const timer = setInterval(() => {
        if (!breachActive) { clearInterval(timer); return; }
        timeLeft--;
        const el = document.getElementById('breach-timer');
        if (el) el.textContent = timeLeft + 's';
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (breachActive) {
                printToTerminal('[FAIL] Breach Timeout. ICE reset.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            }
        }
    }, 1000);

    guiContent.querySelectorAll('.breach-tile').forEach(btn => {
        btn.onclick = () => {
            const hex = btn.textContent;
            btn.style.borderColor = '#0f0';
            btn.style.color = '#0f0';
            btn.disabled = true;
            currentInput.push(hex);
            
            // Check sequence
            const match = currentInput.every((h, idx) => h === sequence[idx]);
            if (!match) {
                printToTerminal('[FAIL] Sequence Mismatch. Alarm Triggered.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            } else if (currentInput.length === sequence.length) {
                printToTerminal('[OK] Neural link established. Admin access granted.', 'conn-ok');
                clearInterval(timer);
                breachActive = false;
                guiContent.innerHTML = '<h2 style="color:#0f0;">ACCESS GRANTED</h2><p style="color:#888;">System bypassed successfully.</p>';
            }
        };
    });
}

// =============================================================
//  PONG
// =============================================================
function startPong() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS PONG';

    // Difficulty menu
    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DIFFICULTY</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="gui-btn pong-diff" data-diff="easy"   style="border-color:#0f0;color:#0f0;">EASY</button>
                <button class="gui-btn pong-diff" data-diff="medium" style="border-color:#ff0;color:#ff0;">MEDIUM</button>
                <button class="gui-btn pong-diff" data-diff="hard"   style="border-color:#f0f;color:#f0f;">HARD</button>
                <button class="gui-btn pong-diff" data-diff="insane" style="border-color:#f00;color:#f00;">INSANE</button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">Mouse or touch to move your paddle</p>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.pong-diff').forEach(btn => {
        btn.addEventListener('click', () => launchPong(btn.dataset.diff));
    });
}

function launchPong(difficulty) {
    const DIFF = {
        easy:   { aiSpeed: 2,   interval: 20, imprecision: 80, ballSpeed: 4   },
        medium: { aiSpeed: 3.5, interval: 14, imprecision: 45, ballSpeed: 5   },
        hard:   { aiSpeed: 5,   interval:  8, imprecision: 20, ballSpeed: 6.5 },
        insane: { aiSpeed: 7.5, interval:  4, imprecision:  4, ballSpeed: 8   },
    };
    const d = DIFF[difficulty] || DIFF.medium;
    const WIN_SCORE = 7;

    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 20px 6px;font-size:0.75rem;">
            <span style="color:#0ff;">YOU</span>
            <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${difficulty.toUpperCase()}  First to ${WIN_SCORE}</span>
            <span style="color:#88f;">CPU</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    // Starfield background  generated once
    const stars = Array.from({length: 60}, () => ({
        x: Math.random()*400, y: Math.random()*300,
        r: Math.random()*1.2 + 0.3, a: Math.random()*0.5 + 0.1
    }));

    const FPS = 60, STEP = 1000 / FPS;
    let last = 0;
    const PADDLE_H = 75, PADDLE_W = 10;
    let paddleY = 112, ballX = 200, ballY = 150;
    let ballVX = d.ballSpeed, ballVY = 3;
    let aiY = 112, pScore = 0, aScore = 0;
    let aiTargetY = 150, aiTick = 0;
    let gameEnded = false;

    const move = (y) => {
        const r = nexusCanvas.getBoundingClientRect();
        paddleY = Math.max(0, Math.min(300 - PADDLE_H, (y - r.top) * (300 / r.height) - PADDLE_H / 2));
    };
    nexusCanvas.onmousemove = (e) => { if (!gameEnded) move(e.clientY); };
    nexusCanvas.ontouchmove = (e) => { if (!gameEnded) { e.preventDefault(); move(e.touches[0].clientY); } };

    function resetBall(dir) {
        ballX = 200; ballY = 60 + Math.random() * 180;
        ballVX = (dir || (Math.random() > 0.5 ? 1 : -1)) * d.ballSpeed;
        ballVY = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 1.5);
        aiTick = 0;
    }

    function drawEnd(playerWon) {
        // Stop loop first
        const r = pongRaf; pongRaf = null; cancelAnimationFrame(r);
        gameEnded = true;

        // Sound: Win/Loss
        if (playerWon) SoundManager.playBloop(800, 0.2);
        else           SoundManager.playBloop(150, 0.2);

        // Submit to global leaderboard
        submitScore('pong', pScore);

        // Draw final frame background
        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, 400, 300);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        // Full-screen overlay
        ctx.fillStyle = playerWon ? 'rgba(0,20,0,0.88)' : 'rgba(20,0,0,0.88)';
        ctx.fillRect(0, 0, 400, 300);

        // Border
        const borderCol = playerWon ? '#0f0' : '#f44';
        ctx.strokeStyle = borderCol; ctx.lineWidth = 2;
        ctx.strokeRect(20, 70, 360, 160);

        ctx.textAlign = 'center';
        ctx.fillStyle = borderCol; ctx.font = 'bold 30px monospace';
        ctx.fillText(playerWon ? 'VICTORY' : 'DEFEATED', 200, 118);
        ctx.fillStyle = '#fff'; ctx.font = '15px monospace';
        ctx.fillText(`${pScore}    ${aScore}`, 200, 150);
        ctx.fillStyle = '#555'; ctx.font = '12px monospace';
        ctx.fillText(playerWon ? 'You beat the CPU.' : 'The CPU won this one.', 200, 174);
        ctx.fillStyle = '#0ff'; ctx.font = '11px monospace';
        ctx.fillText('CLICK to rematch', 200, 204);
        ctx.textAlign = 'left';

        nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchPong(difficulty); };
    }

    function tick(ts) {
        if (!pongRaf) return;
        const delta = ts - last;
        if (delta < STEP - 2) { pongRaf = requestAnimationFrame(tick); return; }
        last = ts;

        // AI movement
        aiTick++;
        if (aiTick % d.interval === 0) aiTargetY = ballY - PADDLE_H / 2 + (Math.random() - 0.5) * d.imprecision;
        if (aiY < aiTargetY) aiY = Math.min(aiY + d.aiSpeed, aiTargetY);
        else                  aiY = Math.max(aiY - d.aiSpeed, aiTargetY);
        aiY = Math.max(0, Math.min(300 - PADDLE_H, aiY));

        ballX += ballVX; ballY += ballVY;
        if (ballY <= 4)   { ballVY =  Math.abs(ballVY); ballY = 5; }
        if (ballY >= 296) { ballVY = -Math.abs(ballVY); ballY = 295; }

        const pRight = 8 + PADDLE_W;
        if (ballVX < 0 && ballX - 5 <= pRight && ballX + 5 >= 8 && ballY + 5 > paddleY && ballY - 5 < paddleY + PADDLE_H) {
            ballVX = Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 2.5;
            ballVY = Math.max(-9, Math.min(9, ballVY));
            ballX = pRight + 6;
        }
        const aiLeft = 382;
        if (ballVX > 0 && ballX + 5 >= aiLeft && ballX - 5 <= aiLeft + PADDLE_W && ballY + 5 > aiY && ballY - 5 < aiY + PADDLE_H) {
            ballVX = -Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 1.5;
            ballVY = Math.max(-9, Math.min(9, ballVY));
            ballX = aiLeft - 6;
        }

        if (ballX < 0)   { aScore++; if (aScore >= WIN_SCORE) { drawEnd(false); return; } resetBall(1); }
        if (ballX > 400) { pScore++; if (pScore >= WIN_SCORE) { drawEnd(true);  return; } resetBall(-1); }

        // Draw  starfield background
        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, 400, 300);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        // Center line
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(0,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, 300); ctx.stroke();
        ctx.setLineDash([]);

        // Score
        ctx.fillStyle = 'rgba(0,255,255,0.55)'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
        ctx.fillText(pScore, 90, 34); ctx.fillText(aScore, 310, 34);
        ctx.textAlign = 'left';

        // Progress pips (dots showing how close each player is to winning)
        for (let i = 0; i < WIN_SCORE; i++) {
            ctx.fillStyle = i < pScore ? '#0ff' : 'rgba(0,255,255,0.12)';
            ctx.beginPath(); ctx.arc(22 + i * 18, 46, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = i < aScore ? '#88f' : 'rgba(136,136,255,0.12)';
            ctx.beginPath(); ctx.arc(378 - i * 18, 46, 4, 0, Math.PI*2); ctx.fill();
        }

        ctx.shadowBlur = 12;
        ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(8, paddleY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#88f'; ctx.fillStyle = '#88f';
        ctx.fillRect(382, aiY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
        ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        pongRaf = requestAnimationFrame(tick);
    }
    pongRaf = requestAnimationFrame(tick);
}

function stopPong() { const r = pongRaf; pongRaf = null; cancelAnimationFrame(r); }

// =============================================================
//  SNAKE
// =============================================================
let snakeRaf;
let snakeActive = false;
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
        ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
        ctx.strokeRect(16, 90, 368, 180);
        ctx.strokeStyle = 'rgba(0,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(14, 88, 372, 184);

        ctx.textAlign = 'center';
        // Title
        ctx.fillStyle = '#f0f'; ctx.font = 'bold 32px monospace';
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
        ctx.shadowBlur = 10; ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
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

// =============================================================
//  CYBER INVADERS (Classic Edition)
// =============================================================
let invadersActive = false;

function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'CYBER INVADERS // MAINFRAME DEFENSE';
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');

    let playerX = 180, bullets = [], enemies = [], particles = [], boss = null;
    let shields = []; // Data Firewalls
    let score = 0, wave = 1, gameOver = false, shake = 0;
    let moveDir = 1;

    function initShields() {
        shields = [];
        for (let i = 0; i < 4; i++) {
            const sx = 50 + i * 100;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 4; c++) {
                ctx.fillText(sprite, e.x, e.y);
                
                if (e.x > 370 || e.x < 10) edge = true;

                // Collision
                bullets.forEach((b, bi) => {
                    if (b.x > e.x - 5 && b.x < e.x + 20 && b.y > e.y - 15 && b.y < e.y) {
                        e.alive = false; bullets.splice(bi, 1);
                        score += 10 * wave;
                        createExplosion(e.x, e.y, ctx.fillStyle);
                        SoundManager.playBloop(200, 0.03);
                    }
                });

                if (e.y > 315) gameOver = true;
            });

            if (edge) {
                moveDir *= -1;
                enemies.forEach(e => e.y += 12);
            }
            enemies.forEach(e => e.x += moveDir * (0.8 + wave * 0.12)); // SLOWER movement

            if (!boss && enemies.length > 0 && enemies.every(e => !e.alive)) {
                wave++;
                initEnemies();
                initShields(); // Restore shields each wave
                if (wave % 5 === 0) spawnBoss();
                SoundManager.playBloop(800, 0.1);
            }

            ctx.fillStyle = '#0ff'; ctx.font = '10px monospace';
            ctx.fillText(`MAINFRAME SECURITY: ${Math.max(0, 100 - wave)}%`, 10, 20);
            ctx.fillText(`THREAT LEVEL: ${wave}`, 320, 20);
            ctx.fillText(`DATA RECOVERED: ${score}`, 10, 350);
        } else {
            // SYSTEM BREACHED - PROPER END SCREEN
            ctx.fillStyle = 'rgba(255,0,0,0.4)'; ctx.fillRect(0,0,400,360);
            ctx.strokeStyle = '#f44'; ctx.lineWidth = 2; ctx.strokeRect(50, 100, 300, 120);
            
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f44'; ctx.font = 'bold 28px monospace';
            ctx.fillText('SYSTEM BREACHED', 200, 145);
            
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
            ctx.fillText(`DATA RECOVERED: ${score}`, 200, 175);
            
            ctx.fillStyle = '#0ff'; ctx.font = '11px monospace';
            ctx.fillText('CLICK TO RESTORE UPLINK', 200, 205);
            ctx.textAlign = 'left';
            
            if (score > 0 && !nexusCanvas.onclick) { 
                submitScore('invaders', score);
                nexusCanvas.onclick = () => { nexusCanvas.onclick = null; startInvaders(); };
            }
        }

        ctx.restore();
        invadersRaf = requestAnimationFrame(tick);
    }
    // Start the loop
    invadersRaf = requestAnimationFrame(tick);
}

function stopInvaders() { cancelAnimationFrame(invadersRaf); invadersActive = false; }

// =============================================================
//  FLAPPY BIRD (Nexus Edition)
// =============================================================
let flappyActive = false, _flappyKey = null;


function startFlappy() {
    stopAllGames();
    flappyActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'FLAPPY NEXUS';
    guiContent.innerHTML = `<p style="font-size:0.72rem;color:#0ff;text-align:center;margin:0 0 4px;">TAP  SPACE   to flap</p>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    // Physics constants at 60fps baseline  all scaled by deltaTime
    const GRAVITY = 0.4, FLAP_VEL = -7.5, PIPE_W = 44, GAP = 105, PIPE_SPEED = 2.8;
    let bird = { x: 80, y: 150, vy: 0, angle: 0 };
    let pipes = [], score = 0, hi = parseInt(localStorage.getItem('flappy_hi') || '0');
    let started = false, dead = false;
    let lastTs = 0, nextPipeMs = 1400; // time-based pipe spawning

    // Pre-generate city skyline background
    const cityBg = document.createElement('canvas');
    cityBg.width = 400; cityBg.height = 300;
    (function buildCity() {
        const c = cityBg.getContext('2d');
        // Sky gradient  deep purple/navy
        const grad = c.createLinearGradient(0, 0, 0, 300);
        grad.addColorStop(0, '#06010f'); grad.addColorStop(0.7, '#0a0520'); grad.addColorStop(1, '#12082a');
        c.fillStyle = grad; c.fillRect(0, 0, 400, 300);
        // Distant stars
        for (let i = 0; i < 35; i++) {
            const a = Math.random() * 0.5 + 0.1;
            c.fillStyle = `rgba(255,255,255,${a})`;
            c.beginPath(); c.arc(Math.random()*400, Math.random()*160, Math.random()*0.8+0.3, 0, Math.PI*2); c.fill();
        }
        // City silhouette  far layer (darker)
        c.fillStyle = '#0d0520';
        const farBuildings = [0,220,30,200,60,210,90,185,130,195,160,175,200,190,240,170,280,180,310,165,350,178,380,190,400,220,400,300,0,300];
        c.beginPath(); c.moveTo(farBuildings[0], farBuildings[1]);
        for (let i=2;i<farBuildings.length;i+=2) c.lineTo(farBuildings[i], farBuildings[i+1]);
        c.fill();
        // City silhouette  near layer
        c.fillStyle = '#080414';
        const nearBuildings = [0,260,20,235,50,240,80,220,110,230,140,215,165,225,195,210,220,218,250,200,280,210,310,195,340,208,370,215,400,260,400,300,0,300];
        c.beginPath(); c.moveTo(nearBuildings[0], nearBuildings[1]);
        for (let i=2;i<nearBuildings.length;i+=2) c.lineTo(nearBuildings[i], nearBuildings[i+1]);
        c.fill();
        // Window lights  tiny random lit windows on buildings
        c.fillStyle = 'rgba(255,220,100,0.45)';
        for (let i = 0; i < 40; i++) {
            const wx = Math.random()*380 + 10, wy = 175 + Math.random()*60;
            c.fillRect(wx, wy, 2, 2);
        }
        c.fillStyle = 'rgba(100,200,255,0.3)';
        for (let i = 0; i < 20; i++) {
            const wx = Math.random()*380 + 10, wy = 200 + Math.random()*45;
            c.fillRect(wx, wy, 2, 3);
        }
    })();

    function flap() {
        if (dead) { startFlappy(); return; }
        if (!started) { started = true; lastTs = performance.now(); }
        bird.vy = FLAP_VEL;
    }

    _flappyKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
    document.addEventListener('keydown', _flappyKey);
    nexusCanvas.addEventListener('click', flap);
    nexusCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });

    function addPipe() {
        const top = 40 + Math.random() * (300 - GAP - 60);
        pipes.push({ x: 415, top, scored: false });
    }
    addPipe();

    function frame(ts) {
        if (!flappyActive) return;

        // DeltaTime  normalize to 60fps so physics are identical on 60/120/144Hz
        const raw = lastTs ? Math.min(ts - lastTs, 50) : 16.67; // cap at 50ms to handle tab switching
        const dt  = raw / 16.67;
        lastTs = ts;

        if (started && !dead) {
            bird.vy += GRAVITY * dt;
            bird.y  += bird.vy * dt;
            bird.angle = Math.max(-0.45, Math.min(0.55, bird.vy * 0.07));

            nextPipeMs -= raw;
            if (nextPipeMs <= 0) { addPipe(); nextPipeMs = 1350 + Math.random() * 200; }

            pipes.forEach(p => p.x -= PIPE_SPEED * dt);
            pipes = pipes.filter(p => p.x + PIPE_W > -10);

            pipes.forEach(p => {
                if (!p.scored && p.x + PIPE_W < bird.x) { p.scored = true; score++; if (score > hi) { hi = score; localStorage.setItem('flappy_hi', hi); } }
            });

            // Collision
            if (bird.y < 6 || bird.y > 294) dead = true;
            pipes.forEach(p => {
                if (bird.x + 9 > p.x && bird.x - 9 < p.x + PIPE_W) {
                    if (bird.y - 9 < p.top || bird.y + 9 > p.top + GAP) dead = true;
                }
            });
        }

        // Draw city background
        ctx.drawImage(cityBg, 0, 0);
        // Ground
        ctx.fillStyle = '#0a0518';
        ctx.fillRect(0, 291, 400, 9);
        ctx.fillStyle = '#c0f'; ctx.shadowBlur = 4; ctx.shadowColor = '#c0f';
        ctx.fillRect(0, 291, 400, 1);
        ctx.shadowBlur = 0;

        // Pipes  neon purple theme to match city
        pipes.forEach(p => {
            ctx.shadowBlur = 6; ctx.shadowColor = '#80f';
            ctx.fillStyle = '#1a0830';
            ctx.fillRect(p.x, 0, PIPE_W, p.top);
            ctx.fillRect(p.x, p.top + GAP, PIPE_W, 300);
            // Pipe caps
            ctx.fillStyle = '#80f';
            ctx.fillRect(p.x - 3, p.top - 10, PIPE_W + 6, 10);
            ctx.fillRect(p.x - 3, p.top + GAP, PIPE_W + 6, 10);
            // Edge highlight
            ctx.fillStyle = 'rgba(180,80,255,0.15)';
            ctx.fillRect(p.x + PIPE_W - 4, 0, 4, p.top);
            ctx.fillRect(p.x + PIPE_W - 4, p.top + GAP + 10, 4, 300);
            ctx.shadowBlur = 0;
        });

        // Bird
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.angle);
        ctx.shadowBlur = 14; ctx.shadowColor = '#f0f';
        ctx.fillStyle = '#f0f';
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0c';
        ctx.beginPath(); ctx.ellipse(-4, 3, 6, 4, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(6, -2, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // HUD
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText(score, 200, 34);
        ctx.fillStyle = '#555'; ctx.font = '11px monospace';
        ctx.fillText(`HI ${hi}`, 200, 50);
        ctx.textAlign = 'left';

        if (!started) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, 400, 300);
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText('FLAPPY NEXUS', 200, 128);
            ctx.fillStyle = '#0ff'; ctx.font = '13px monospace';
            ctx.fillText('TAP    SPACE      to flap', 200, 155);
            ctx.textAlign = 'left';
        }

        if (dead) {
            ctx.fillStyle = 'rgba(6,1,15,0.88)';
            ctx.fillRect(0, 0, 400, 300);
            // Border
            ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
            ctx.strokeRect(20, 70, 360, 160);
            ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.strokeRect(18, 68, 364, 164);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f0f'; ctx.font = 'bold 30px monospace';
            ctx.fillText('GAME OVER', 200, 116);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 150);
            const isNew = score === hi && score > 0;
            ctx.fillStyle = isNew ? '#ff0' : '#0ff';
            ctx.fillText(isNew ? ` NEW BEST: ${hi} ` : `Best: ${hi}`, 200, 174);
            ctx.fillStyle = '#555'; ctx.font = '12px monospace';
            ctx.fillText('TAP  SPACE to retry', 200, 208);
            ctx.textAlign = 'left';
        }

        flappyFrame = requestAnimationFrame(frame);
    }
    flappyFrame = requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
}

function stopFlappy() {
    flappyActive = false;
    cancelAnimationFrame(flappyFrame);
    if (_flappyKey) { document.removeEventListener('keydown', _flappyKey); _flappyKey = null; }
    nexusCanvas.onclick = null;
}

// =============================================================
//  BREAKOUT
// =============================================================
let breakoutFrame, breakoutActive = false;

function startBreakout() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS BREAKOUT';

    // Difficulty menu with descriptions
    guiContent.innerHTML = `
        <div style="text-align:center;padding:10px 0;">
            <div style="color:#0ff;letter-spacing:3px;font-size:0.8rem;margin-bottom:16px;">SELECT DIFFICULTY</div>
            <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
                <button class="gui-btn brk-diff" data-diff="easy"   style="border-color:#0f0;color:#0f0;width:240px;">EASY<br><span style="font-size:0.6rem;opacity:0.6;">Slow balls  Big paddle</span></button>
                <button class="gui-btn brk-diff" data-diff="medium" style="border-color:#ff0;color:#ff0;width:240px;">MEDIUM<br><span style="font-size:0.6rem;opacity:0.6;">Standard physics</span></button>
                <button class="gui-btn brk-diff" data-diff="hard"   style="border-color:#f0f;color:#f0f;width:240px;">HARD<br><span style="font-size:0.6rem;opacity:0.6;">Fast balls  Small paddle</span></button>
                <button class="gui-btn brk-diff" data-diff="chaos"  style="border-color:#f00;color:#f00;width:240px;">CHAOS<br><span style="font-size:0.6rem;opacity:0.6;">Extreme acceleration</span></button>
            </div>
            <p style="color:#555;font-size:0.68rem;margin-top:14px;">Mouse or touch to move your paddle</p>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.brk-diff').forEach(btn => {
        btn.addEventListener('click', () => launchBreakout(btn.dataset.diff));
    });
}

function launchBreakout(difficulty) {
    const DIFFS = {
        easy:   { PW: 96, startVX: 2,   startVY: -3.5, accel: 1.01 },
        medium: { PW: 72, startVX: 2.8, startVY: -4.5, accel: 1.03 },
        hard:   { PW: 50, startVX: 3.5, startVY: -5.5, accel: 1.05 },
        chaos:  { PW: 44, startVX: 3,   startVY: -5,   accel: 1.08 },
    };
    const d = DIFFS[difficulty] || DIFFS.medium;

    breakoutActive = true;
    let currentPW = d.PW;
    guiContent.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0 10px 4px;font-size:0.72rem;">
            <span style="color:#0ff;">Score: <b id="brk-score">0</b></span>
            <span style="color:#444;font-size:0.65rem;letter-spacing:1px;">${difficulty.toUpperCase()}</span>
            <span id="brk-lives" style="color:#0ff;"></span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 300;
    const ctx = nexusCanvas.getContext('2d');

    const PH = 10, BR = 7;
    const BW = 43, BH = 16, BCOLS = 8, BROWS = 5;
    const BCOLORS = ['#f0f','#f55','#f80','#ff0','#0f0'];
    let paddle = 165;
    // Ball system  supporting Multi-ball
    let balls = [{ x: 200, y: 230, vx: d.startVX, vy: d.startVY }];
    // Power-up system
    let powerups = [];
    const PU_TYPES = [
        { label: 'M', color: '#0ff', type: 'multi' },
        { label: 'W', color: '#0f0', type: 'wide' },
        { label: 'S', color: '#ff0', type: 'slow' }
    ];

    let bricks = [], score = 0, lives = 3, dead = false, won = false;
    let lastTs = 0, wideTimer = 0;
    let hi = parseInt(localStorage.getItem('breakout_hi') || '0');

    // Pre-draw circuit board background
    const brkBg = document.createElement('canvas');
    brkBg.width = 400; brkBg.height = 300;
    (function buildBrkBg() {
        const c = brkBg.getContext('2d');
        c.fillStyle = '#050510'; c.fillRect(0, 0, 400, 300);
        c.strokeStyle = 'rgba(0,255,255,0.04)'; c.lineWidth = 1;
        for (let x = 0; x <= 400; x += 25) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,300); c.stroke(); }
        for (let y = 0; y <= 300; y += 25) { c.beginPath(); c.moveTo(0,y); c.lineTo(400,y); c.stroke(); }
    })();

    function initBricks() {
        bricks = [];
        for (let r = 0; r < BROWS; r++)
            for (let c = 0; c < BCOLS; c++)
                bricks.push({ x: 8 + c * (BW + 4), y: 30 + r * (BH + 5), alive: true, color: BCOLORS[r] });
    }
    initBricks();

    const movePaddle = (cx) => {
        const rect = nexusCanvas.getBoundingClientRect();
        paddle = ((cx - rect.left) / rect.width) * 400 - currentPW / 2;
        paddle = Math.max(0, Math.min(400 - currentPW, paddle));
    };
    nexusCanvas.onmousemove = (e) => movePaddle(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); movePaddle(e.touches[0].clientX); };

    function frame(ts) {
        if (!breakoutActive) return;
        const raw = lastTs ? Math.min(ts - lastTs, 50) : 16.67;
        const dt  = raw / 16.67;
        lastTs = ts;

        if (!dead && !won) {
            // Handle Wide Paddle timer
            if (wideTimer > 0) {
                wideTimer -= raw;
                if (wideTimer <= 0) currentPW = d.PW;
            }

            // Move Balls
            balls.forEach((ball, bi) => {
                ball.x += ball.vx * dt; ball.y += ball.vy * dt;
                if (ball.x <= BR || ball.x >= 400 - BR) { ball.vx *= -1; SoundManager.playBloop(300, 0.02); }
                if (ball.y <= BR) { ball.vy = Math.abs(ball.vy); SoundManager.playBloop(300, 0.02); }
                
                // Paddle hit
                if (ball.y + BR >= 270 && ball.y - BR <= 282 && ball.x >= paddle && ball.x <= paddle + currentPW) {
                    ball.vy = -Math.abs(ball.vy);
                    const hitPoint = (ball.x - (paddle + currentPW / 2)) / (currentPW / 2);
                    ball.vx = hitPoint * 5.5;
                    SoundManager.playBloop(400, 0.05);
                }

                // Brick hit
                bricks.forEach(b => {
                    if (!b.alive) return;
                    if (ball.x + BR > b.x && ball.x - BR < b.x + BW && ball.y + BR > b.y && ball.y - BR < b.y + BH) {
                        b.alive = false; ball.vy *= -1; score += 10;
                        SoundManager.playBloop(600 + Math.random() * 200, 0.05);
                        
                        // Drop powerup? (15% chance)
                        if (Math.random() < 0.15) {
                            const pu = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
                            powerups.push({ x: b.x + BW/2, y: b.y, type: pu.type, label: pu.label, color: pu.color });
                        }

                        if (d.accel) {
                            ball.vx *= d.accel; ball.vy *= d.accel;
                            const spd = Math.sqrt(ball.vx**2 + ball.vy**2);
                            if (spd > 14) { ball.vx = ball.vx/spd*14; ball.vy = ball.vy/spd*14; }
                        }
                        const el = document.getElementById('brk-score');
                        if (el) el.textContent = score;
                    }
                });

                // Ball lost
                if (ball.y > 310) balls.splice(bi, 1);
            });

            // No balls left? Lose a life
            if (balls.length === 0) {
                lives--;
                SoundManager.playBloop(150, 0.1);
                const livesEl = document.getElementById('brk-lives');
                if (livesEl) livesEl.textContent = ''.repeat(Math.max(0, lives));
                if (lives <= 0) { 
                    dead = true; 
                    submitScore('breakout', score);
                    showLeaderboard('breakout');
                } else {
                    balls = [{ x: 200, y: 230, vx: d.startVX, vy: d.startVY }];
                    powerups = [];
                    currentPW = d.PW; wideTimer = 0;
                }
            }

            // Move Powerups
            powerups.forEach((pu, pi) => {
                pu.y += 2 * dt;
                if (pu.y > 270 && pu.y < 285 && pu.x > paddle && pu.x < paddle + currentPW) {
                    // CATCH!
                    powerups.splice(pi, 1);
                    SoundManager.playBloop(800, 0.1);
                    if (pu.type === 'multi') {
                        balls.push({ x: ball.x || 200, y: 230, vx: -3, vy: -4 }, { x: ball.x || 200, y: 230, vx: 3, vy: -4 });
                    } else if (pu.type === 'wide') {
                        currentPW = d.PW * 1.6; wideTimer = 10000;
                    } else if (pu.type === 'slow') {
                        balls.forEach(b => { b.vx *= 0.7; b.vy *= 0.7; });
                    }
                }
                if (pu.y > 310) powerups.splice(pi, 1);
            });

            if (bricks.every(b => !b.alive)) { 
                won = true; 
                submitScore('breakout', score);
                showLeaderboard('breakout');
            }
        }

        // Draw
        ctx.drawImage(brkBg, 0, 0);
        bricks.forEach(b => {
            if (!b.alive) return;
            ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, BW, BH);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(b.x, b.y, BW, 3);
        });

        powerups.forEach(pu => {
            ctx.fillStyle = pu.color;
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`[${pu.label}]`, pu.x - 10, pu.y);
        });

        ctx.fillStyle = '#0ff';
        ctx.beginPath(); ctx.roundRect(paddle, 270, currentPW, PH, 4); ctx.fill();

        ctx.fillStyle = '#fff';
        balls.forEach(b => {
            ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, Math.PI * 2); ctx.fill();
        });

        if (dead || won) {
            ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0,0,400,300);
            ctx.textAlign = 'center';
            ctx.fillStyle = won ? '#0f0' : '#f44';
            ctx.font = 'bold 30px monospace';
            ctx.fillText(won ? 'BOARD CLEARED' : 'SYSTEM CRASHED', 200, 130);
            ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
            ctx.fillText(`Score: ${score}`, 200, 160);
            ctx.fillText('CLICK to restart', 200, 200);
            ctx.textAlign = 'left';
            nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchBreakout(difficulty); };
        }

        breakoutRaf = requestAnimationFrame(frame);
    }
}

function stopBreakout() {
    breakoutActive = false;
    cancelAnimationFrame(breakoutFrame);
}

// =============================================================
//  WORDLE
// =============================================================
const WORDLE_WORDS = [
    'ABOUT','ABOVE','ABUSE','ACTOR','ACUTE','ADMIT','ADOPT','ADULT','AFTER','AGENT',
    'AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIKE','ALIVE','ALLEY','ALLOW','ALONE',
    'ALONG','ALTER','ANGEL','ANGLE','ANGRY','ANIME','APPLY','ARENA','ARGUE','ARISE',
    'ASIDE','ASSET','AVOID','AWAKE','AWARD','AWARE','AWFUL','BASIC','BASIS','BEACH',
    'BEGIN','BEING','BELOW','BENCH','BERRY','BIRTH','BLACK','BLADE','BLAME','BLANK',
    'BLAST','BLAZE','BLEED','BLEND','BLESS','BLIND','BLOCK','BLOOD','BLOOM','BOARD',
    'BOOST','BOUND','BRAIN','BRAND','BRAVE','BREAD','BREAK','BRICK','BRIEF','BRING',
    'BROAD','BROWN','BUILD','BUILT','BURST','CABIN','CARRY','CAUSE','CHAIN','CHAIR',
    'CHAOS','CHARM','CHART','CHASE','CHEAP','CHECK','CHESS','CHEST','CHILD','CLAIM',
    'CLASH','CLASS','CLEAN','CLEAR','CLICK','CLIMB','CLONE','CLOSE','CLOUD','COAST',
    'COUNT','COURT','COVER','CRACK','CRANE','CRASH','CRAZY','CROSS','CROWD','CRUSH',
    'CURVE','CYCLE','DAILY','DANCE','DEALT','DEATH','DELAY','DEPTH','DIRTY','DODGE',
    'DOUBT','DRAFT','DRAIN','DRAMA','DRAWN','DREAM','DRINK','DRIVE','DROVE','DRUNK',
    'EARTH','EIGHT','ELITE','EMPTY','ENEMY','ENJOY','ENTER','ERROR','EVENT','EVERY',
    'EXACT','EXIST','EXTRA','FAITH','FALSE','FANCY','FATAL','FAULT','FEAST','FIELD',
    'FIGHT','FINAL','FIRST','FIXED','FLAME','FLARE','FLASH','FLESH','FLOAT','FLOOD',
    'FLOOR','FOUND','FRAME','FRANK','FRESH','FRONT','FROST','GUARD','GUESS','GUIDE',
    'HABIT','HAPPY','HARSH','HEART','HEAVY','HINGE','HONOR','HORSE','HOTEL','HOUSE',
    'HUMAN','HUMOR','IDEAL','IMAGE','INDEX','INNER','INPUT','ISSUE','JOINT','JUDGE',
    'JUICE','LABEL','LARGE','LASER','LATER','LAYER','LEGAL','LIGHT','LIMIT','LOGIC',
    'LOOSE','LOVER','LOWER','LUCKY','MAGIC','MAJOR','MAKER','MATCH','MAYOR','MEANT',
    'MEDIA','MERIT','METAL','MINOR','MINUS','MIXED','MODEL','MONEY','MOUNT','MOUSE',
    'MOVED','MUSIC','NERVE','NIGHT','NOBLE','NOISE','NORTH','NOVEL','NURSE','OCCUR',
    'OFFER','OFTEN','OLIVE','ONSET','ORBIT','ORDER','OTHER','OUTER','OWNED','PANEL',
    'PANIC','PAPER','PARTY','PATCH','PAUSE','PEACE','PHONE','PILOT','PIXEL','PIZZA',
    'PLACE','PLANE','PLANT','PLATE','POINT','POWER','PRESS','PRICE','PRIDE','PRIME',
    'PROBE','PROOF','PROSE','PROUD','PROVE','PROXY','PULSE','PUNCH','QUICK','QUIET',
    'QUITE','QUOTE','RADIO','RAISE','RALLY','RANGE','RAPID','REACH','READY','REBEL',
    'REFER','RELAY','REPLY','RESET','RIDGE','RIGHT','RIGID','RISEN','RISKY','RIVER',
    'ROBOT','ROCKY','ROUGH','ROUND','ROUTE','ROYAL','RURAL','SAINT','SCALE','SCARE',
    'SCENE','SCOPE','SCORE','SENSE','SERVE','SETUP','SEVEN','SHAPE','SHARE','SHARP',
    'SHELL','SHIFT','SHIRT','SHOCK','SHOOT','SHORT','SHOUT','SIGHT','SKILL','SKULL',
    'SLEEP','SLICE','SLIDE','SLOPE','SMART','SMILE','SMOKE','SNAKE','SOLAR','SOLID',
    'SOLVE','SORRY','SOUTH','SPACE','SPEAK','SPEED','SPEND','SPLIT','STAND','START',
    'STATE','STEAM','STEEL','STICK','STILL','STONE','STOOD','STORM','STORY','STRIP',
    'STUCK','STUDY','STYLE','SUPER','SWEET','SWING','SWORD','TABLE','TAKEN','TASTE',
    'TEACH','TEETH','THEME','THICK','THING','THINK','THREE','THROW','TIGHT','TIMER',
    'TIRED','TODAY','TOUCH','TOUGH','TOWER','TOXIC','TRACE','TRACK','TRADE','TRAIL',
    'TRAIN','TRASH','TREAT','TREND','TRIAL','TRICK','TRUST','TRUTH','TWIST','UNDER',
    'UNION','UNITY','UNTIL','UPPER','UPSET','URBAN','VALID','VALUE','VENUE','VIVID',
    'VOCAL','VOICE','WAGER','WASTE','WATCH','WATER','WEIRD','WHITE','WHOLE','WIDER',
    'WORLD','WORRY','WORSE','WORST','WORTH','WOULD','WRECK','WRITE','YIELD','YOUNG',
];

let wordleActive = false;
let wordleAnswer = '';
let wordleGuesses = [];
let wordleCurrent = '';
let wordleKeyState = {};

const WORDLE_MAX = 6;
const WORDLE_LEN = 5;

function startWordle() {
    stopAllGames();
    wordleActive = true;
    wordleAnswer = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    wordleGuesses = [];
    wordleCurrent = '';
    wordleKeyState = {};

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS WORDLE';
    nexusCanvas.style.display = 'none';

    renderWordle();
    printToTerminal('Wordle started  type a 5-letter word and press Enter.', 'sys-msg');
}

function stopWordle() {
    wordleActive = false;
}

function renderWordle() {
    const rows = [];
    for (let r = 0; r < WORDLE_MAX; r++) {
        const guess = wordleGuesses[r];
        const isCurrentRow = r === wordleGuesses.length && !wordleIsOver();
        const tiles = [];
        for (let c = 0; c < WORDLE_LEN; c++) {
            let letter = '';
            let bg = '#1a1a2e';
            let border = '#444';
            let color = '#fff';
            if (guess) {
                letter = guess.result[c].letter;
                if (guess.result[c].state === 'correct') { bg = '#1a6b1a'; border = '#0f0'; color = '#0f0'; }
                else if (guess.result[c].state === 'present') { bg = '#6b5a00'; border = '#ff0'; color = '#ff0'; }
                else { bg = '#333'; border = '#555'; color = '#888'; }
            } else if (isCurrentRow) {
                letter = wordleCurrent[c] || '';
                border = letter ? '#0ff' : '#333';
            }
            tiles.push(`<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${bg};border:2px solid ${border};color:${color};font-size:1.3rem;font-weight:bold;border-radius:4px;font-family:'Fira Code',monospace;transition:border 0.1s;">${letter}</div>`);
        }
        rows.push(`<div style="display:flex;gap:6px;">${tiles.join('')}</div>`);
    }

    // Keyboard
    const ROWS_KB = [['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['ENTER','Z','X','C','V','B','N','M','']];
    const kbRows = ROWS_KB.map(row => {
        const keys = row.map(k => {
            const state = wordleKeyState[k] || '';
            let bg = '#2a2a3e', color = '#ccc', border = '#444';
            if (state === 'correct') { bg = '#1a5c1a'; color = '#0f0'; border = '#0f0'; }
            else if (state === 'present') { bg = '#5a4a00'; color = '#ff0'; border = '#ff0'; }
            else if (state === 'absent') { bg = '#1a1a1a'; color = '#444'; border = '#333'; }
            const wide = (k === 'ENTER' || k === '') ? 'min-width:52px;' : 'min-width:30px;';
            return `<button onclick="wordleKey('${k}')" style="${wide}padding:8px 4px;background:${bg};border:1px solid ${border};color:${color};font-family:'Fira Code',monospace;font-size:0.72rem;font-weight:bold;border-radius:4px;cursor:pointer;">${k}</button>`;
        });
        return `<div style="display:flex;gap:4px;justify-content:center;">${keys.join('')}</div>`;
    }).join('');

    guiContent.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-bottom:12px;">${rows.join('')}</div>
        <div style="display:flex;flex-direction:column;gap:5px;">${kbRows}</div>
        <p id="wordle-msg" style="text-align:center;font-size:0.8rem;color:#0ff;margin-top:8px;min-height:1.2em;"></p>`;
}

window.wordleKey = function(k) {
    if (!wordleActive) return;
    if (wordleIsOver()) return;
    SoundManager.playBloop(400, 0.05);
    if (k === '' || k === 'Backspace') { wordleCurrent = wordleCurrent.slice(0, -1); renderWordle(); return; }
    if (k === 'ENTER' || k === 'Enter') { submitWordleGuess(); return; }
    if (/^[A-Z]$/.test(k) && wordleCurrent.length < WORDLE_LEN) { wordleCurrent += k; renderWordle(); }
};

function submitWordleGuess() {
    if (wordleCurrent.length < WORDLE_LEN) {
        document.getElementById('wordle-msg').textContent = 'Not enough letters.';
        return;
    }
    const guess = wordleCurrent.toUpperCase();
    const answer = wordleAnswer;
    const result = [];
    const used = answer.split('').map(() => false);

    // First pass: correct
    for (let i = 0; i < WORDLE_LEN; i++) {
        if (guess[i] === answer[i]) { result[i] = { letter: guess[i], state: 'correct' }; used[i] = true; }
        else result[i] = { letter: guess[i], state: 'absent' };
    }
    // Second pass: present
    for (let i = 0; i < WORDLE_LEN; i++) {
        if (result[i].state === 'correct') continue;
        const j = answer.split('').findIndex((ch, idx) => ch === guess[i] && !used[idx]);
        if (j !== -1) { result[i].state = 'present'; used[j] = true; }
    }

    wordleGuesses.push({ word: guess, result });
    wordleCurrent = '';

    // Update key state
    result.forEach(({ letter, state }) => {
        const prev = wordleKeyState[letter];
        if (prev === 'correct') return;
        if (state === 'correct') wordleKeyState[letter] = 'correct';
        else if (state === 'present' && prev !== 'correct') wordleKeyState[letter] = 'present';
        else if (!prev) wordleKeyState[letter] = 'absent';
    });

    renderWordle();

    const won = result.every(r => r.state === 'correct');
    if (won) {
        wordleActive = false;
        SoundManager.playBloop(800, 0.2);
        submitScore('wordle', (WORDLE_MAX - wordleGuesses.length + 1) * 20);
        document.getElementById('wordle-msg').textContent = ` Nice! The word was ${answer}. Close to restart.`;
        printToTerminal(`Wordle solved in ${wordleGuesses.length}/${WORDLE_MAX}! Word: ${answer}`, 'conn-ok');
    } else if (wordleGuesses.length >= WORDLE_MAX) {
        wordleActive = false;
        SoundManager.playBloop(150, 0.2);
        document.getElementById('wordle-msg').textContent = `The word was ${answer}. Close to try again.`;
        printToTerminal(`Wordle over. The word was ${answer}.`, 'sys-msg');
    }
}

function wordleIsOver() {
    if (wordleGuesses.length >= WORDLE_MAX) return true;
    return wordleGuesses.length > 0 && wordleGuesses[wordleGuesses.length - 1].result.every(r => r.state === 'correct');
}

// Called from WS when AI sends feedback during a wordle session (passthrough now)
function updateWordleVisuals(text, grid) { /* handled by client-side wordle now */ }

// =============================================================
//  MINESWEEPER
// =============================================================
let mineActive = false;
const MINE_ROWS = 9, MINE_COLS = 9, MINE_COUNT = 10;
let mineGrid = [], mineRevealed = [], mineFlagged = [], mineOver = false, mineWon = false, mineFirst = true;

function startMinesweeper() {
    stopAllGames();
    mineActive = true;
    mineOver = false; mineWon = false; mineFirst = true;
    mineGrid = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(0));
    mineRevealed = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));
    mineFlagged  = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS MINESWEEPER';
    nexusCanvas.style.display = 'none';
    renderMinesweeper();
    printToTerminal('Minesweeper  left-click to reveal, right-click to flag. First click is always safe.', 'sys-msg');
}

function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < MINE_COUNT) {
        const r = Math.floor(Math.random() * MINE_ROWS);
        const c = Math.floor(Math.random() * MINE_COLS);
        if (mineGrid[r][c] !== -1 && !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) {
            mineGrid[r][c] = -1;
            placed++;
        }
    }
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) {
        if (mineGrid[r][c] === -1) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && mineGrid[nr][nc] === -1) n++;
        }
        mineGrid[r][c] = n;
    }
}

function mineFlood(r, c) {
    if (r < 0 || r >= MINE_ROWS || c < 0 || c >= MINE_COLS) return;
    if (mineRevealed[r][c] || mineFlagged[r][c]) return;
    mineRevealed[r][c] = true;
    if (mineGrid[r][c] === 0) for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) mineFlood(r+dr,c+dc);
}

function renderMinesweeper() {
    const NCOLORS = ['','#0ff','#0f0','#f55','#55f','#f80','#0ff','#f0f','#aaa'];
    const flagsLeft = MINE_COUNT - mineFlagged.flat().filter(Boolean).length;

    let html = `<div style="text-align:center;font-size:0.75rem;color:#888;margin-bottom:8px;">
         ${flagsLeft} mines remaining${mineOver ? '  <span style="color:#f55">BOOM</span>' : ''}${mineWon ? '  <span style="color:#0f0">YOU WIN!</span>' : ''}
    </div><table style="border-collapse:collapse;margin:0 auto;">`;

    for (let r = 0; r < MINE_ROWS; r++) {
        html += '<tr>';
        for (let c = 0; c < MINE_COLS; c++) {
            const revealed = mineRevealed[r][c];
            const flagged  = mineFlagged[r][c];
            const val      = mineGrid[r][c];
            let bg = revealed ? '#1a1a2e' : '#2a2a3e';
            let color = '#0ff', text = '';
            let border = revealed ? '1px solid #111' : '1px solid #444';
            if (revealed) {
                if (val === -1) { bg = '#500'; color = '#f55'; text = ''; }
                else if (val > 0) { color = NCOLORS[val]; text = val; }
            } else if (flagged) { text = ''; }
            const style = `width:30px;height:30px;text-align:center;vertical-align:middle;background:${bg};border:${border};color:${color};font-size:0.8rem;font-weight:bold;cursor:${mineOver||mineWon?'default':'pointer'};user-select:none;`;
            html += `<td style="${style}" onclick="mineClick(${r},${c})" oncontextmenu="mineFlag(event,${r},${c})">${text}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    if (mineOver || mineWon) html += `<div style="text-align:center;margin-top:10px;"><button onclick="startMinesweeper()" style="background:transparent;border:1px solid #0ff;color:#0ff;padding:6px 14px;font-family:'Fira Code',monospace;cursor:pointer;border-radius:4px;">New Game</button></div>`;

    guiContent.innerHTML = html;
}

window.mineClick = function(r, c) {
    if (mineOver || mineWon || mineRevealed[r][c] || mineFlagged[r][c]) return;
    if (mineFirst) { placeMines(r, c); mineFirst = false; }
    if (mineGrid[r][c] === -1) {
        mineRevealed[r][c] = true;
        mineOver = true;
        // Reveal all mines
        for (let i=0;i<MINE_ROWS;i++) for (let j=0;j<MINE_COLS;j++) if (mineGrid[i][j]===-1) mineRevealed[i][j]=true;
        renderMinesweeper();
        printToTerminal(' Detonated. Better luck next time.', 'sys-msg');
        return;
    }
    mineFlood(r, c);
    const safe = MINE_ROWS * MINE_COLS - MINE_COUNT;
    if (mineRevealed.flat().filter(Boolean).length >= safe) {
        mineWon = true;
        printToTerminal(' All mines cleared. Nice work.', 'conn-ok');
    }
    renderMinesweeper();
};

window.mineFlag = function(e, r, c) {
    e.preventDefault();
    if (mineOver || mineWon || mineRevealed[r][c]) return;
    mineFlagged[r][c] = !mineFlagged[r][c];
    renderMinesweeper();
};

// =============================================================
//  TYPING SPEED TEST
// =============================================================
const TYPE_PHRASES = [
    'the quick brown fox jumps over the lazy dog near the riverbank',
    'packets travel across networks at the speed of light through fiber optic cables',
    'every system has a vulnerability if you know exactly where to look for it',
    'xavier scott built this terminal so you could talk to an ai without a search bar',
    'code is just instructions that tell machines what to do until they do it wrong',
    'a clean network is a fast network and a fast network is a happy homelab',
    'debug twice deploy once or just push to prod and hope nothing catches fire',
    'the best way to learn something is to break it and then figure out how to fix it',
    'open source software runs most of the internet and nobody really talks about that',
    'trust the process unless the process is a shell script you wrote at midnight',
    'security is not a product it is a process that never really ends',
    'any sufficiently advanced technology is indistinguishable from magic',
    'first make it work then make it right then make it fast in that order',
];

let typeTestActive = false;
let typePhrase = '', typeStart = 0, typeTimerInterval = null;
let typeErrors = 0, typeCharsTyped = 0;

function startTypingTest() {
    stopAllGames();
    typeTestActive = true;
    typePhrase = TYPE_PHRASES[Math.floor(Math.random() * TYPE_PHRASES.length)];
    typeStart = 0;
    typeErrors = 0;
    typeCharsTyped = 0;

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'TYPING TEST';
    nexusCanvas.style.display = 'none';

    renderTypeTest('');
    printToTerminal('Typing test started  type in the input bar below', 'sys-msg');
    input.value = '';
    input.focus();
}

function renderTypeTest(typed) {
    const target = typePhrase;
    // Build character-by-character highlighted target
    let chars = '';
    for (let i = 0; i < target.length; i++) {
        if (i < typed.length) {
            if (typed[i] === target[i]) {
                chars += `<span style="color:#0f0">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
            } else {
                chars += `<span style="color:#f55;text-decoration:underline">${target[i] === ' ' ? '' : target[i]}</span>`;
            }
        } else if (i === typed.length) {
            chars += `<span style="color:#0ff;border-left:2px solid #0ff">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        } else {
            chars += `<span style="color:#444">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        }
    }

    const elapsed = typeStart ? ((Date.now() - typeStart) / 1000) : 0;
    const elSec = elapsed.toFixed(1) + 's';
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = elapsed > 1 ? Math.round(wordsTyped / (elapsed / 60)) : 0;
    const progress = Math.round((typed.length / target.length) * 100);
    const pct = Math.min(100, progress);

    guiContent.innerHTML = `
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:4px;">
                <span>PROGRESS</span><span>${pct}%</span>
            </div>
            <div style="height:3px;background:#111;border-radius:2px;">
                <div style="height:3px;width:${pct}%;background:#0ff;border-radius:2px;transition:width 0.1s;"></div>
            </div>
        </div>
        <div style="font-size:0.88rem;line-height:1.9;letter-spacing:0.03em;word-break:break-word;margin-bottom:14px;font-family:'Fira Code',monospace;">${chars}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-timer-val" style="font-size:1.4rem;font-weight:bold;color:#0ff;">${elSec}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">TIME</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-wpm-val" style="font-size:1.4rem;font-weight:bold;color:#f0f;">${wpm}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">WPM</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-err-val" style="font-size:1.4rem;font-weight:bold;color:${typeErrors > 0 ? '#f55' : '#0f0'};">${typeErrors}</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">ERRORS</div>
            </div>
        </div>
        <p style="font-size:0.7rem;color:#333;text-align:center;margin-top:10px;">Type in the input bar  Esc to cancel</p>`;
}

function tickTypeTimer() {
    if (!typeTestActive || !typeStart) return;
    const elapsed = ((Date.now() - typeStart) / 1000).toFixed(1) + 's';
    const el = document.getElementById('type-timer-val');
    if (el) el.textContent = elapsed;
    // Update live WPM
    const typed = input.value;
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const secs = (Date.now() - typeStart) / 1000;
    const wpm = secs > 1 ? Math.round(wordsTyped / (secs / 60)) : 0;
    const wEl = document.getElementById('type-wpm-val');
    if (wEl) wEl.textContent = wpm;
}

function checkTypingTest(typed) {
    if (!typeTestActive) return false;
    if (typeStart === 0) {
        typeStart = Date.now();
        clearInterval(typeTimerInterval);
        typeTimerInterval = setInterval(tickTypeTimer, 100);
    }

    // Count errors
    typeErrors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== typePhrase[i]) typeErrors++;
    }

    renderTypeTest(typed);

    if (typed === typePhrase) {
        const elapsed = (Date.now() - typeStart) / 1000;
        const wpm = Math.round((typePhrase.split(' ').length) / (elapsed / 60));
        const accuracy = Math.round(((typePhrase.length - typeErrors) / typePhrase.length) * 100);
        clearInterval(typeTimerInterval);
        typeTestActive = false;

        // Show final result overlay in GUI
        guiContent.innerHTML += `
            <div style="margin-top:12px;padding:12px;border:2px solid #0ff;text-align:center;background:#0a0f1a;">
                <div style="color:#0ff;font-size:1.1rem;font-weight:bold;letter-spacing:2px;">COMPLETE</div>
                <div style="margin-top:6px;font-size:0.85rem;color:#fff;">${wpm} WPM &nbsp;&nbsp; ${accuracy}% accuracy &nbsp;&nbsp; ${elapsed.toFixed(1)}s</div>
                ${wpm > 80 ? '<div style="color:#0f0;font-size:0.75rem;margin-top:4px;">Elite typist </div>' : wpm > 50 ? '<div style="color:#ff0;font-size:0.75rem;margin-top:4px;">Nice speed!</div>' : '<div style="color:#888;font-size:0.75rem;margin-top:4px;">Keep practicing.</div>'}
            </div>`;
        printToTerminal(`Typing test complete: ${wpm} WPM  ${accuracy}% accuracy  ${elapsed.toFixed(1)}s`, 'conn-ok');
        return true;
    }
    return false;
}

// =============================================================
//  MATRIX SCREENSAVER
// =============================================================
let matrixSaverActive = false;
let matrixSaverFrame;

function startMatrixSaver() {
    stopAllGames();
    matrixSaverActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'MATRIX';
    guiContent.innerHTML = '<p style="font-size:0.72rem;color:#0f0;text-align:center;">Press any key or close to exit</p>';
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');
    const cols = Math.floor(400 / 14);
    const drops = Array(cols).fill(1);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

    function frame() {
        if (!matrixSaverActive) return;
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(0, 0, 400, 360);
        ctx.fillStyle = '#0f0';
        ctx.font = '13px monospace';
        drops.forEach((y, i) => {
            const ch = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillStyle = y === 1 ? '#fff' : '#0f0';
            ctx.fillText(ch, i * 14, y * 14);
            if (y * 14 > 360 && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        });
        matrixSaverFrame = requestAnimationFrame(frame);
    }
    frame();

    const exitHandler = () => { stopMatrixSaver(); document.removeEventListener('keydown', exitHandler); };
    document.addEventListener('keydown', exitHandler);
}

function stopMatrixSaver() {
    matrixSaverActive = false;
    cancelAnimationFrame(matrixSaverFrame);
}

// =============================================================
//  STOP ALL GAMES HELPER
// =============================================================
function stopAllGames() {
    stopPong();
    stopSnake();
    stopWordle();
    stopMatrixSaver();
    stopFlappy();
    stopBreakout();
    stopInvaders();
    mineActive = false;
    breachActive = false;
    typeTestActive = false;
    wordleActive = false;
    clearInterval(typeTimerInterval);
    clearInterval(monitorInterval);

    if (input) {
        input.value = '';
        input.focus();
    }

    // TOTAL WIPE of canvas listeners to prevent 'game jumping'
    nexusCanvas.onclick = null;
    nexusCanvas.onmousedown = null;
    nexusCanvas.onmousemove = null;
    nexusCanvas.ontouchstart = null;
    nexusCanvas.ontouchmove = null;
    nexusCanvas.ontouchend = null;

    // Clear any active game intervals/frames not caught by sub-functions
    cancelAnimationFrame(pongRaf);
    cancelAnimationFrame(flappyFrame);
    cancelAnimationFrame(breakoutRaf);
    cancelAnimationFrame(invadersRaf);
}

// =============================================================
//  GOOGLE AUTHENTICATION
// =============================================================
