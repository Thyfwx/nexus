    const p = document.createElement('p');
    p.className = className;
    output.appendChild(p);

    // Build one <span> per line so we only mutate the current span (O(1) per tick)
    const lines = text.split('\n');
    const spans = [];
    lines.forEach((_, i) => {
        if (i > 0) p.appendChild(document.createElement('br'));

    function initEnemies() {
        enemies = [];
        const rows = Math.min(6, 3 + Math.floor(wave / 2));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < 8; c++) {
                enemies.push({ x: 40 + c * 40, y: 60 + r * 30, alive: true, type: r, hp: 1 });
            }
        }
    }

    function spawnBoss() {
        boss = { x: 150, y: -50, targetY: 60, hp: 50 + (wave * 10), maxHp: 50 + (wave * 10), moveDir: 1 };
        SoundManager.playBloop(100, 0.3);
    }

    function createExplosion(x, y, color) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x, y, 
                vx: (Math.random() - 0.5) * 6, 
                vy: (Math.random() - 0.5) * 6, 
                life: 1.0, 
                color
            });
        }
    }

    if (wave % 5 === 0) spawnBoss(); else initEnemies();
    initShields();

    const movePlayer = (x) => {
        const rect = nexusCanvas.getBoundingClientRect();
        playerX = ((x - rect.left) / rect.width) * 400 - 20;
        playerX = Math.max(0, Math.min(360, playerX));
    };
    nexusCanvas.onmousemove = (e) => movePlayer(e.clientX);
    nexusCanvas.ontouchmove = (e) => { e.preventDefault(); movePlayer(e.touches[0].clientX); };
    nexusCanvas.onclick = () => {
        if (gameOver) { startInvaders(); return; }
        if (bullets.length < 4) {
            bullets.push({ x: playerX + 18, y: 330 });
            SoundManager.playBloop(600, 0.03);
        }
    };

    function tick(ts) {
        if (!invadersActive) return;
        
        ctx.save();
        if (shake > 0) {
            ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
            shake *= 0.9;
        }

        ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, 400, 360);
        
        // Scanlines background
        ctx.fillStyle = 'rgba(0, 255, 255, 0.03)';
        for (let i = 0; i < 360; i += 4) ctx.fillRect(0, i, 400, 1);

        if (!gameOver) {
            // Player
            ctx.fillStyle = '#0ff';
            ctx.shadowBlur = 10; ctx.shadowColor = '#0ff';
            ctx.fillRect(playerX, 330, 40, 10);
            ctx.fillRect(playerX + 15, 320, 10, 10);
            ctx.shadowBlur = 0;

            // Bullets
            bullets.forEach((b, i) => {
                b.y -= 6; // SLOWER bullets for classic feel
                ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, 3, 12);
                
                // Shield collision
                shields.forEach((s, si) => {
                    if (s.hp > 0 && b.x > s.x && b.x < s.x + 10 && b.y > s.y && b.y < s.y + 10) {
                        s.hp--; bullets.splice(i, 1);
                        SoundManager.playBloop(100, 0.02);
                    }
                });

                if (b.y < 0) bullets.splice(i, 1);
            });

            // Shields
            shields.forEach(s => {
                if (s.hp <= 0) return;
                ctx.fillStyle = `rgba(0, 255, 255, ${s.hp / 3})`;
                ctx.fillRect(s.x, s.y, 9, 9);
            });

            // Particles
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.02;
                ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
                ctx.fillRect(p.x, p.y, 3, 3);
                if (p.life <= 0) particles.splice(i, 1);
            });
            ctx.globalAlpha = 1.0;

            // Boss Logic
            if (boss) {
                if (boss.y < boss.targetY) boss.y += 1;
                boss.x += boss.moveDir * 2;
                if (boss.x > 300 || boss.x < 20) boss.moveDir *= -1;

                // Boss health bar
                ctx.fillStyle = '#333'; ctx.fillRect(100, 10, 200, 6);
                ctx.fillStyle = '#f0f'; ctx.fillRect(100, 10, (boss.hp / boss.maxHp) * 200, 6);
                
                // Draw Boss
                ctx.fillStyle = '#f0f'; ctx.font = 'bold 24px monospace';
                ctx.fillText('[ FIREWALL ]', boss.x, boss.y);

                // Bullet collision with Boss
                bullets.forEach((b, bi) => {
                    if (b.x > boss.x && b.x < boss.x + 120 && b.y > boss.y - 20 && b.y < boss.y) {
                        boss.hp--; bullets.splice(bi, 1);
                        createExplosion(b.x, b.y, '#f0f');
                        shake = 4;
                        SoundManager.playBloop(150, 0.02);
                    }
                });

                if (boss.hp <= 0) {
                    score += 500;
                    createExplosion(boss.x + 60, boss.y, '#fff');
                    boss = null;
                    wave++;
                    SoundManager.playBloop(800, 0.2);
                    if (wave % 5 !== 0) initEnemies(); else spawnBoss();
                }
            }

            // Regular Enemies
            let edge = false;
            enemies.forEach(e => {
                if (!e.alive) return;
                ctx.fillStyle = e.type % 2 === 0 ? '#f0f' : '#0f0';
                ctx.font = 'bold 16px monospace';
                const sprite = e.type % 2 === 0 ? '' : '';
