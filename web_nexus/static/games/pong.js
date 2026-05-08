function startPong() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiContainer.classList.add('gui-game-wide');  // widen modal for bigger canvas
    guiTitle.textContent = 'NEXUS PONG';

    // Difficulty menu — same card style as Snake mode-select
    guiContent.innerHTML = `
        <style>
            .pong-pick {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 14px;
                margin: 0 auto;
                max-width: 460px;
            }
            .pong-pick button.pong-diff {
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
            }
            .pong-pick button.pong-diff .diff-name {
                font-size: 1rem;
                font-weight: 700;
                letter-spacing: 2.5px;
                line-height: 1;
            }
            .pong-pick button.pong-diff .diff-desc {
                font-size: 0.62rem;
                opacity: 0.65;
                letter-spacing: 1px;
                line-height: 1.3;
            }
            .pong-pick button.pong-diff:hover {
                background: var(--mode-bg-hov) !important;
                box-shadow: 0 0 18px var(--mode-color);
            }
            @media (max-width: 480px) {
                .pong-pick { grid-template-columns: 1fr; max-width: 280px; }
            }
        </style>
        <div style="text-align:center; padding:24px 12px;">
            <div style="color:#0ff; letter-spacing:4px; font-size:0.85rem; font-weight:700; margin-bottom:6px; text-shadow:0 0 12px #0ff;">SELECT DIFFICULTY</div>
            <div style="color:#666; font-size:0.7rem; margin-bottom:24px; letter-spacing:1px;">Mouse / touch moves your paddle</div>
            <div class="pong-pick">
                <button class="pong-diff" data-diff="easy"
                    style="--mode-color:#0f0; --mode-bg:rgba(0,255,0,0.06); --mode-bg-hov:rgba(0,255,0,0.18);">
                    <span class="diff-name">EASY</span>
                    <span class="diff-desc">slow ball · forgiving CPU</span>
                </button>
                <button class="pong-diff" data-diff="medium"
                    style="--mode-color:#ff0; --mode-bg:rgba(255,255,0,0.06); --mode-bg-hov:rgba(255,255,0,0.18);">
                    <span class="diff-name">MEDIUM</span>
                    <span class="diff-desc">fair fight</span>
                </button>
                <button class="pong-diff" data-diff="hard"
                    style="--mode-color:#0ff; --mode-bg:rgba(0,255,255,0.06); --mode-bg-hov:rgba(0,255,255,0.18);">
                    <span class="diff-name">HARD</span>
                    <span class="diff-desc">CPU reads you</span>
                </button>
                <button class="pong-diff" data-diff="insane"
                    style="--mode-color:#f00; --mode-bg:rgba(255,0,0,0.06); --mode-bg-hov:rgba(255,0,0,0.18);">
                    <span class="diff-name">INSANE</span>
                    <span class="diff-desc">borderline unfair</span>
                </button>
            </div>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.pong-diff').forEach(btn => {
        btn.addEventListener('click', () => launchPong(btn.dataset.diff));
    });
}

function launchPong(difficulty) {
    // Canvas: 600×450 (was 400×300 — 50% bigger). All positions/sizes scale.
    const W = 600, H = 450;

    const DIFF = {
        easy:   { aiSpeed: 3,    interval: 20, imprecision: 120, ballSpeed: 6   },
        medium: { aiSpeed: 5.25, interval: 14, imprecision: 68,  ballSpeed: 7.5 },
        hard:   { aiSpeed: 7.5,  interval:  8, imprecision: 30,  ballSpeed: 9.75 },
        insane: { aiSpeed: 11.25,interval:  4, imprecision:  6,  ballSpeed: 12  },
    };
    const d = DIFF[difficulty] || DIFF.medium;
    const WIN_SCORE = 7;

    const diffColor = difficulty === 'easy' ? '#0f0' : difficulty === 'medium' ? '#ff0' : difficulty === 'hard' ? '#0ff' : '#f00';

    guiContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; font-size:0.78rem; margin-bottom:8px; background:rgba(255,255,255,0.02); border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
            <span style="color:#0ff; font-weight:700; letter-spacing:2px;">YOU</span>
            <span style="color:${diffColor}; font-size:0.7rem; letter-spacing:2px; font-weight:700;">${difficulty.toUpperCase()} · FIRST TO ${WIN_SCORE}</span>
            <span style="color:#88f; font-weight:700; letter-spacing:2px;">CPU</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.style.maxWidth = '100%';
    nexusCanvas.style.height = 'auto';
    nexusCanvas.style.borderRadius = '4px';
    nexusCanvas.style.border = `1px solid ${diffColor}33`;
    nexusCanvas.style.boxShadow = `0 0 24px ${diffColor}22`;
    nexusCanvas.width = W; nexusCanvas.height = H;
    const ctx = nexusCanvas.getContext('2d');

    // Starfield (90 stars for bigger canvas)
    const stars = Array.from({length: 90}, () => ({
        x: Math.random()*W, y: Math.random()*H,
        r: Math.random()*1.4 + 0.3, a: Math.random()*0.5 + 0.1
    }));

    const FPS = 60, STEP = 1000 / FPS;
    let last = 0;
    const PADDLE_H = 112, PADDLE_W = 15;  // 75→112, 10→15
    let paddleY = (H - PADDLE_H) / 2;
    let ballX = W / 2, ballY = H / 2;
    let ballVX = d.ballSpeed, ballVY = 4.5;  // 3→4.5
    let aiY = (H - PADDLE_H) / 2, pScore = 0, aScore = 0;
    let aiTargetY = H / 2, aiTick = 0;
    let gameEnded = false;

    const PADDLE_X_LEFT = 12, PADDLE_X_RIGHT = W - 12 - PADDLE_W;
    const BALL_R = 9;  // 6→9

    const move = (y) => {
        const r = nexusCanvas.getBoundingClientRect();
        paddleY = Math.max(0, Math.min(H - PADDLE_H, (y - r.top) * (H / r.height) - PADDLE_H / 2));
    };
    nexusCanvas.onmousemove = (e) => { if (!gameEnded) move(e.clientY); };
    nexusCanvas.ontouchmove = (e) => { if (!gameEnded) { e.preventDefault(); move(e.touches[0].clientY); } };

    function resetBall(dir) {
        ballX = W / 2;
        ballY = 90 + Math.random() * (H - 180);
        ballVX = (dir || (Math.random() > 0.5 ? 1 : -1)) * d.ballSpeed;
        ballVY = (Math.random() > 0.5 ? 1 : -1) * (3.75 + Math.random() * 2.25);
        aiTick = 0;
    }

    function drawEnd(playerWon) {
        const r = pongRaf; pongRaf = null; cancelAnimationFrame(r);
        gameEnded = true;

        if (playerWon) SoundManager.playBloop(800, 0.2);
        else           SoundManager.playBloop(150, 0.2);

        submitScore('pong', pScore);

        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, W, H);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        ctx.fillStyle = playerWon ? 'rgba(0,20,0,0.88)' : 'rgba(20,0,0,0.88)';
        ctx.fillRect(0, 0, W, H);

        const borderCol = playerWon ? '#0f0' : '#f44';
        const cx = W / 2, cy = H / 2;
        ctx.strokeStyle = borderCol; ctx.lineWidth = 2;
        ctx.strokeRect(cx - 200, cy - 100, 400, 220);
        ctx.strokeStyle = borderCol + '66'; ctx.lineWidth = 1;
        ctx.strokeRect(cx - 204, cy - 104, 408, 228);

        ctx.textAlign = 'center';
        ctx.fillStyle = borderCol; ctx.font = 'bold 42px monospace';
        ctx.shadowBlur = 18; ctx.shadowColor = borderCol;
        ctx.fillText(playerWon ? 'VICTORY' : 'DEFEATED', cx, cy - 50);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace';
        ctx.fillText(`${pScore} — ${aScore}`, cx, cy - 12);
        ctx.fillStyle = '#888'; ctx.font = '14px monospace';
        ctx.fillText(playerWon ? 'You beat the CPU.' : 'The CPU won this one.', cx, cy + 18);
        ctx.fillStyle = borderCol + 'cc'; ctx.font = '13px monospace';
        ctx.fillText('CLICK to rematch', cx, cy + 80);
        ctx.textAlign = 'left';

        nexusCanvas.onclick = () => { nexusCanvas.onclick = null; launchPong(difficulty); };
    }

    function tick(ts) {
        if (!pongRaf) return;
        const delta = ts - last;
        if (delta < STEP - 2) { pongRaf = requestAnimationFrame(tick); return; }
        last = ts;

        aiTick++;
        if (aiTick % d.interval === 0) aiTargetY = ballY - PADDLE_H / 2 + (Math.random() - 0.5) * d.imprecision;
        if (aiY < aiTargetY) aiY = Math.min(aiY + d.aiSpeed, aiTargetY);
        else                  aiY = Math.max(aiY - d.aiSpeed, aiTargetY);
        aiY = Math.max(0, Math.min(H - PADDLE_H, aiY));

        ballX += ballVX; ballY += ballVY;
        if (ballY <= 6)     { ballVY =  Math.abs(ballVY); ballY = 7; }
        if (ballY >= H - 6) { ballVY = -Math.abs(ballVY); ballY = H - 7; }

        const pRight = PADDLE_X_LEFT + PADDLE_W;
        if (ballVX < 0 && ballX - BALL_R/2 <= pRight && ballX + BALL_R/2 >= PADDLE_X_LEFT && ballY + BALL_R/2 > paddleY && ballY - BALL_R/2 < paddleY + PADDLE_H) {
            ballVX = Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 3.75;
            ballVY = Math.max(-13.5, Math.min(13.5, ballVY));
            ballX = pRight + BALL_R;
        }
        if (ballVX > 0 && ballX + BALL_R/2 >= PADDLE_X_RIGHT && ballX - BALL_R/2 <= PADDLE_X_RIGHT + PADDLE_W && ballY + BALL_R/2 > aiY && ballY - BALL_R/2 < aiY + PADDLE_H) {
            ballVX = -Math.abs(ballVX) * 1.05;
            ballVY += ((ballY - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2)) * 2.25;
            ballVY = Math.max(-13.5, Math.min(13.5, ballVY));
            ballX = PADDLE_X_RIGHT - BALL_R;
        }

        if (ballX < 0) { aScore++; if (aScore >= WIN_SCORE) { drawEnd(false); return; } resetBall(1); }
        if (ballX > W) { pScore++; if (pScore >= WIN_SCORE) { drawEnd(true);  return; } resetBall(-1); }

        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, W, H);
        stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });

        ctx.setLineDash([12, 12]);
        ctx.strokeStyle = 'rgba(0,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(0,255,255,0.55)'; ctx.font = 'bold 38px monospace'; ctx.textAlign = 'center';
        ctx.fillText(pScore, W * 0.225, 50); ctx.fillText(aScore, W * 0.775, 50);
        ctx.textAlign = 'left';

        for (let i = 0; i < WIN_SCORE; i++) {
            ctx.fillStyle = i < pScore ? '#0ff' : 'rgba(0,255,255,0.12)';
            ctx.beginPath(); ctx.arc(33 + i * 27, 70, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = i < aScore ? '#88f' : 'rgba(136,136,255,0.12)';
            ctx.beginPath(); ctx.arc(W - 33 - i * 27, 70, 5, 0, Math.PI*2); ctx.fill();
        }

        ctx.shadowBlur = 14;
        ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.fillRect(PADDLE_X_LEFT, paddleY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#88f'; ctx.fillStyle = '#88f';
        ctx.fillRect(PADDLE_X_RIGHT, aiY, PADDLE_W, PADDLE_H);
        ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.beginPath(); ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        pongRaf = requestAnimationFrame(tick);
    }
    pongRaf = requestAnimationFrame(tick);
}

function stopPong() {
    const r = pongRaf; pongRaf = null; cancelAnimationFrame(r);
    nexusCanvas.style.maxWidth = '';
    nexusCanvas.style.height = '';
    nexusCanvas.style.borderRadius = '';
    nexusCanvas.style.border = '';
    nexusCanvas.style.boxShadow = '';
    if (typeof guiContainer !== 'undefined' && guiContainer) {
        guiContainer.classList.remove('gui-game-wide');
    }
}
