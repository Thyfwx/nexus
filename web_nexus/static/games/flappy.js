let _flappyKey = null;

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
        ctx.shadowBlur = 14; ctx.shadowColor = '#0ff';
        ctx.fillStyle = '#0ff';
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
            ctx.fillStyle = '#0ff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText('FLAPPY NEXUS', 200, 128);
            ctx.fillStyle = '#0ff'; ctx.font = '13px monospace';
            ctx.fillText('TAP    SPACE      to flap', 200, 155);
            ctx.textAlign = 'left';
        }

        if (dead) {
            ctx.fillStyle = 'rgba(6,1,15,0.88)';
            ctx.fillRect(0, 0, 400, 300);
            // Border
            ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2;
            ctx.strokeRect(20, 70, 360, 160);
            ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.strokeRect(18, 68, 364, 164);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#0ff'; ctx.font = 'bold 30px monospace';
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
