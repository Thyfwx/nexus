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
                <button class="gui-btn pong-diff" data-diff="hard"   style="border-color:#0ff;color:#0ff;">HARD</button>
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
        ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
        ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        pongRaf = requestAnimationFrame(tick);
    }
    pongRaf = requestAnimationFrame(tick);
}

function stopPong() { const r = pongRaf; pongRaf = null; cancelAnimationFrame(r); }
