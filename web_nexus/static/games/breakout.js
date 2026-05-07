let breakoutFrame = null;
let breakoutActive = false;

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
                <button class="gui-btn brk-diff" data-diff="hard"   style="border-color:#0ff;color:#0ff;width:240px;">HARD<br><span style="font-size:0.6rem;opacity:0.6;">Fast balls  Small paddle</span></button>
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
    const BCOLORS = ['#0ff','#f55','#f80','#ff0','#0f0'];
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
