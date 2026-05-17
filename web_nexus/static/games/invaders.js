function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiContainer.classList.add('gui-game-wide');
    guiTitle.textContent = 'CYBER INVADERS // MAINFRAME DEFENSE';
    nexusCanvas.style.display = 'block';
    nexusCanvas.style.maxWidth = '100%';
    nexusCanvas.style.height = 'auto';
    nexusCanvas.style.borderRadius = '4px';
    nexusCanvas.style.border = '1px solid rgba(0,255,255,0.2)';
    nexusCanvas.style.boxShadow = '0 0 20px rgba(0,255,255,0.15)';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');

    let playerX = 180, bullets = [], enemies = [], particles = [];
    let score = 0, wave = 1, gameOver = false, moveDir = 1;
    let enemyBulletTimer = 0, enemyBullets = [];
    let scoreSubmitted = false;

    function shootBullet() {
        if (gameOver) return;
        if (bullets.length < 3) {
            bullets.push({ x: playerX + 10, y: 320 });
            SoundManager.playBloop(400, 0.02);
        }
    }
    function aimAtClientX(clientX) {
        if (gameOver) return;
        const rect = nexusCanvas.getBoundingClientRect();
        const cx = ((clientX - rect.left) / rect.width) * 400;
        playerX = Math.max(10, Math.min(370, cx - 10));
    }
    nexusCanvas.onmousemove = (e) => aimAtClientX(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); if (e.touches[0]) aimAtClientX(e.touches[0].clientX); };
    nexusCanvas.onclick = () => {
        if (gameOver) { nexusCanvas.onclick = null; startInvaders(); return; }
        shootBullet();
    };
    nexusCanvas.ontouchstart = (e) => {
        if (gameOver) { startInvaders(); return; }
        shootBullet();
    };

    function initEnemies() {
        enemies = [];
        const rows = 3, cols = 6;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                enemies.push({
                    x: 40 + c * 50,
                    y: 40 + r * 40,
                    alive: true,
                    type: r
                });
            }
        }
    }

    function createExplosion(x, y, color) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0,
                color
            });
        }
    }

    function tick() {
        if (!invadersActive) return;
        if (gameOver) {
            draw();
            return;
        }

        // Move Player
        if (window._keys && window._keys['ArrowLeft']) playerX = Math.max(10, playerX - 5);
        if (window._keys && window._keys['ArrowRight']) playerX = Math.min(370, playerX + 5);

        // Player Fire
        if (window._keys && window._keys[' '] && bullets.length < 3) {
            bullets.push({ x: playerX + 10, y: 320 });
            SoundManager.playBloop(400, 0.02);
            delete window._keys[' '];
        }

        // Update Bullets
        bullets = bullets.filter(b => {
            b.y -= 7;
            return b.y > 0;
        });

        // Update Enemy Bullets
        enemyBullets = enemyBullets.filter(b => {
            b.y += 4;
            if (b.y > 330 && b.y < 350 && b.x > playerX && b.x < playerX + 20) {
                gameOver = true;
                SoundManager.playBloop(100, 0.2);
            }
            return b.y < 360;
        });

        // Move Enemies
        let edge = false;
        enemies.forEach(e => {
            if (!e.alive) return;
            e.x += moveDir * (1 + wave * 0.2);
            if (e.x > 370 || e.x < 10) edge = true;
            if (e.y > 310) gameOver = true;
        });

        if (edge) {
            moveDir *= -1;
            enemies.forEach(e => e.y += 15);
        }

        // Enemy Firing
        enemyBulletTimer++;
        if (enemyBulletTimer > Math.max(20, 60 - wave * 5)) {
            const living = enemies.filter(e => e.alive);
            if (living.length > 0) {
                const shooter = living[Math.floor(Math.random() * living.length)];
                enemyBullets.push({ x: shooter.x + 10, y: shooter.y });
            }
            enemyBulletTimer = 0;
        }

        // Collisions
        bullets.forEach((b, bi) => {
            enemies.forEach(e => {
                if (e.alive && b.x > e.x && b.x < e.x + 20 && b.y > e.y && b.y < e.y + 20) {
                    e.alive = false;
                    bullets.splice(bi, 1);
                    score += 10;
                    createExplosion(e.x + 10, e.y + 10, '#0ff');
                    SoundManager.playBloop(600, 0.05);
                }
            });
        });

        // Particles
        particles = particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.02;
            return p.life > 0;
        });

        // Next Wave
        if (enemies.every(e => !e.alive)) {
            wave++;
            initEnemies();
            SoundManager.playBloop(800, 0.1);
        }

        draw();
        invadersRaf = requestAnimationFrame(tick);
    }

    // Starfield
    let stars = [];
    for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * 400, y: Math.random() * 360, s: Math.random() * 1.5 + 0.5, sp: Math.random() * 0.3 + 0.1 });

    // Pixel-art alien sprites (each row = different shape + color)
    const ALIEN_SPRITES = [
        // Row 0: squid (cyan)
        { color: '#0ff', glow: 'rgba(0,255,255,0.3)', pixels: [
            [0,0,1,0,0,0,1,0,0],
            [0,0,0,1,0,1,0,0,0],
            [0,0,1,1,1,1,1,0,0],
            [0,1,1,0,1,0,1,1,0],
            [1,1,1,1,1,1,1,1,1],
            [1,0,1,1,1,1,1,0,1],
            [1,0,1,0,0,0,1,0,1],
            [0,0,0,1,0,1,0,0,0],
        ]},
        // Row 1: crab (green)
        { color: '#0f0', glow: 'rgba(0,255,0,0.3)', pixels: [
            [0,1,0,0,0,0,0,1,0],
            [0,0,1,0,0,0,1,0,0],
            [0,1,1,1,1,1,1,1,0],
            [1,1,0,1,1,1,0,1,1],
            [1,1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,1,0],
            [0,1,0,0,0,0,0,1,0],
            [0,0,1,0,0,0,1,0,0],
        ]},
        // Row 2: skull (magenta)
        { color: '#f0f', glow: 'rgba(255,0,255,0.3)', pixels: [
            [0,0,1,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,1,0],
            [1,1,0,1,1,1,0,1,1],
            [1,1,1,1,1,1,1,1,1],
            [0,0,1,0,0,0,1,0,0],
            [0,1,0,1,1,1,0,1,0],
            [0,1,0,0,0,0,0,1,0],
            [0,0,1,1,0,1,1,0,0],
        ]},
    ];

    function drawAlien(x, y, type) {
        const sprite = ALIEN_SPRITES[type] || ALIEN_SPRITES[0];
        const px = 2; // pixel size
        ctx.fillStyle = sprite.color;
        ctx.shadowColor = sprite.glow;
        ctx.shadowBlur = 6;
        const rows = sprite.pixels;
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                if (rows[r][c]) ctx.fillRect(x + c * px, y + r * px, px, px);
            }
        }
        ctx.shadowBlur = 0;
    }

    function draw() {
        // Background
        ctx.fillStyle = '#06060f';
        ctx.fillRect(0, 0, 400, 360);

        // Scrolling starfield
        stars.forEach(s => {
            s.y += s.sp;
            if (s.y > 360) { s.y = 0; s.x = Math.random() * 400; }
            ctx.fillStyle = `rgba(255,255,255,${0.2 + s.s * 0.3})`;
            ctx.fillRect(s.x, s.y, s.s, s.s);
        });

        // Subtle scan lines
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let y = 0; y < 360; y += 3) ctx.fillRect(0, y, 400, 1);

        // Player ship (more detailed)
        ctx.fillStyle = '#0ff';
        ctx.shadowColor = 'rgba(0,255,255,0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(playerX + 10, 322);
        ctx.lineTo(playerX + 20, 340);
        ctx.lineTo(playerX + 16, 338);
        ctx.lineTo(playerX + 16, 342);
        ctx.lineTo(playerX + 4, 342);
        ctx.lineTo(playerX + 4, 338);
        ctx.lineTo(playerX, 340);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Engine glow
        ctx.fillStyle = `rgba(0,255,255,${0.3 + Math.random() * 0.2})`;
        ctx.fillRect(playerX + 6, 342, 8, 2 + Math.random() * 3);

        // Enemies (pixel-art sprites)
        enemies.forEach(e => {
            if (!e.alive) return;
            drawAlien(e.x, e.y, e.type);
        });

        // Player bullets (bright cyan laser)
        ctx.shadowColor = 'rgba(0,255,255,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#fff';
        bullets.forEach(b => {
            ctx.fillRect(b.x, b.y, 2, 8);
            ctx.fillStyle = 'rgba(0,255,255,0.4)';
            ctx.fillRect(b.x - 1, b.y, 4, 8);
            ctx.fillStyle = '#fff';
        });
        ctx.shadowBlur = 0;

        // Enemy bullets (red)
        ctx.fillStyle = '#f44';
        ctx.shadowColor = 'rgba(255,68,68,0.5)';
        ctx.shadowBlur = 4;
        enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, 2, 6));
        ctx.shadowBlur = 0;

        // Particles
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 2, 2);
        });
        ctx.globalAlpha = 1;

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 400, 24);
        ctx.fillStyle = '#0ff'; ctx.font = 'bold 10px monospace';
        ctx.fillText(`WAVE ${wave}`, 10, 16);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(`SCORE ${score}`, 390, 16);
        ctx.textAlign = 'left';

        // Defense line
        ctx.strokeStyle = 'rgba(0,255,255,0.15)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, 318); ctx.lineTo(400, 318); ctx.stroke();
        ctx.setLineDash([]);

        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 400, 360);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f44'; ctx.font = 'bold 22px monospace';
            ctx.shadowColor = 'rgba(255,68,68,0.5)'; ctx.shadowBlur = 12;
            ctx.fillText('MAINFRAME BREACHED', 200, 160);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#888'; ctx.font = '12px monospace';
            ctx.fillText(`Final score: ${score}`, 200, 190);
            ctx.fillStyle = '#0ff'; ctx.font = '11px monospace';
            ctx.fillText('CLICK TO TRY AGAIN', 200, 220);
            ctx.textAlign = 'left';
            if (!scoreSubmitted) {
                scoreSubmitted = true;
                if (window.submitScore) window.submitScore('invaders', score);
            }
        }
    }

    initEnemies();
    invadersRaf = requestAnimationFrame(tick);
}

function stopInvaders() { 
    cancelAnimationFrame(invadersRaf); 
    invadersActive = false; 
    if (nexusCanvas) nexusCanvas.onclick = null;
}
