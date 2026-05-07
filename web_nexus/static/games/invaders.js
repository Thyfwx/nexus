function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'CYBER INVADERS // MAINFRAME DEFENSE';
    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 360;
    const ctx = nexusCanvas.getContext('2d');

    let playerX = 180, bullets = [], enemies = [], particles = [];
    let score = 0, wave = 1, gameOver = false, moveDir = 1;
    let enemyBulletTimer = 0, enemyBullets = [];

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

    function draw() {
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, 400, 360);

        // Grid lines
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for(let i=0; i<400; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,360); ctx.stroke(); }

        // Player
        ctx.fillStyle = '#0ff';
        ctx.fillRect(playerX, 330, 20, 10);
        ctx.fillRect(playerX + 8, 325, 4, 5);

        // Enemies
        enemies.forEach(e => {
            if (!e.alive) return;
            ctx.fillStyle = e.type === 0 ? '#0ff' : e.type === 1 ? '#0ff' : '#0f0';
            ctx.font = '16px monospace';
            ctx.fillText('W', e.x, e.y + 15);
        });

        // Bullets
        ctx.fillStyle = '#fff';
        bullets.forEach(b => ctx.fillRect(b.x, b.y, 2, 6));
        ctx.fillStyle = '#f44';
        enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, 2, 6));

        // Particles
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 2, 2);
        });
        ctx.globalAlpha = 1;

        // HUD
        ctx.fillStyle = '#0ff'; ctx.font = '10px monospace';
        ctx.fillText(`THREAT LEVEL: ${wave}`, 10, 20);
        ctx.fillText(`SCORE: ${score}`, 320, 20);

        if (gameOver) {
            ctx.fillStyle = 'rgba(255,0,0,0.4)'; ctx.fillRect(0, 0, 400, 360);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SYSTEM BREACHED', 200, 180);
            ctx.font = '14px monospace';
            ctx.fillText('CLICK TO RESTART', 200, 210);
            ctx.textAlign = 'left';
            if (!nexusCanvas.onclick) {
                if (window.submitScore) window.submitScore('invaders', score);
                nexusCanvas.onclick = () => { nexusCanvas.onclick = null; startInvaders(); };
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
