function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiContainer.classList.add('gui-game-wide');
    guiTitle.textContent = 'CYBER INVADERS';
    nexusCanvas.style.display = 'block';
    nexusCanvas.style.maxWidth = '100%';
    nexusCanvas.style.height = 'auto';
    nexusCanvas.style.borderRadius = '4px';
    nexusCanvas.style.border = '1px solid rgba(0,255,255,0.2)';
    nexusCanvas.style.boxShadow = '0 0 20px rgba(0,255,255,0.15)';
    nexusCanvas.width = 480; nexusCanvas.height = 400;
    var ctx = nexusCanvas.getContext('2d');

    var W = 480, H = 400;
    var playerX = 220, bullets = [], enemies = [], particles = [], floats = [];
    var score = 0, wave = 0, gameOver = false, moveDir = 1;
    var enemyBulletTimer = 0, enemyBullets = [];
    var scoreSubmitted = false;
    var waveTransition = 0; // countdown frames for wave title
    var shakeX = 0, shakeY = 0;
    var tick_count = 0;

    // Starfield
    var stars = [];
    for (var i = 0; i < 80; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5, sp: Math.random() * 0.4 + 0.1 });

    // Pixel sprites
    var SPRITES = [
        { color: '#0ff', glow: 'rgba(0,255,255,0.4)', px: [
            [0,0,1,0,0,0,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,1,1,1,0,0],
            [0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],
            [1,0,1,0,0,0,1,0,1],[0,0,0,1,0,1,0,0,0]
        ]},
        { color: '#0f0', glow: 'rgba(0,255,0,0.4)', px: [
            [0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0],[0,1,1,1,1,1,1,1,0],
            [1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],
            [0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0]
        ]},
        { color: '#f0f', glow: 'rgba(255,0,255,0.4)', px: [
            [0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],
            [1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,1,1,1,0,1,0],
            [0,1,0,0,0,0,0,1,0],[0,0,1,1,0,1,1,0,0]
        ]},
        { color: '#fa0', glow: 'rgba(255,170,0,0.4)', px: [
            [0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],
            [1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,0,1,0,1,0,0,1],
            [0,1,0,0,0,0,0,1,0],[1,0,1,0,0,0,1,0,1]
        ]}
    ];

    function drawAlien(x, y, type, sz) {
        var sp = SPRITES[type % SPRITES.length];
        ctx.fillStyle = sp.color;
        ctx.shadowColor = sp.glow;
        ctx.shadowBlur = 6;
        var rows = sp.px;
        for (var r = 0; r < rows.length; r++)
            for (var c = 0; c < rows[r].length; c++)
                if (rows[r][c]) ctx.fillRect(x + c * sz, y + r * sz, sz, sz);
        ctx.shadowBlur = 0;
    }

    // Wave formations
    function formation_grid(rows, cols) {
        var out = [];
        for (var r = 0; r < rows; r++)
            for (var c = 0; c < cols; c++)
                out.push({ x: 60 + c * 55, y: 50 + r * 45, alive: true, type: r % 4, hp: 1 });
        return out;
    }
    function formation_v() {
        var out = [];
        var pts = [[3,0],[2,1],[4,1],[1,2],[5,2],[0,3],[6,3]];
        pts.forEach(function(p) { out.push({ x: 60 + p[0] * 55, y: 50 + p[1] * 45, alive: true, type: p[1] % 4, hp: 1 }); });
        return out;
    }
    function formation_diamond() {
        var out = [];
        var pts = [[3,0],[2,1],[4,1],[1,2],[3,2],[5,2],[2,3],[4,3],[3,4]];
        pts.forEach(function(p) { out.push({ x: 80 + p[0] * 50, y: 40 + p[1] * 40, alive: true, type: p[1] % 4, hp: 1 }); });
        return out;
    }
    function formation_scatter(n) {
        var out = [];
        for (var i = 0; i < n; i++)
            out.push({ x: 40 + Math.random() * (W - 100), y: 30 + Math.random() * 150, alive: true, type: Math.floor(Math.random() * 4), hp: 1 });
        return out;
    }
    function formation_walls() {
        var out = [];
        for (var r = 0; r < 5; r++) {
            out.push({ x: 40, y: 40 + r * 35, alive: true, type: 0, hp: 1 });
            out.push({ x: W - 60, y: 40 + r * 35, alive: true, type: 0, hp: 1 });
        }
        for (var c = 1; c < 6; c++)
            out.push({ x: 40 + c * 65, y: 60, alive: true, type: 2, hp: 1 });
        return out;
    }

    var FORMATIONS = [formation_grid.bind(null, 3, 6), formation_v, formation_diamond, formation_scatter.bind(null, 14), formation_walls, formation_grid.bind(null, 4, 7)];

    function nextWave() {
        wave++;
        moveDir = 1;
        enemies = FORMATIONS[(wave - 1) % FORMATIONS.length]();
        // Scale HP on later waves
        if (wave > 4) enemies.forEach(function(e) { if (Math.random() < 0.3) e.hp = 2; });
        if (wave > 8) enemies.forEach(function(e) { if (Math.random() < 0.2) e.hp = 3; });
        waveTransition = 90;
        enemyBullets = [];
        enemyBulletTimer = 0;
    }

    function createExplosion(x, y, color, big) {
        var count = big ? 16 : 8;
        for (var i = 0; i < count; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * (big ? 6 : 4),
                vy: (Math.random() - 0.5) * (big ? 6 : 4),
                life: 1.0,
                color: color,
                sz: big ? 3 : 2
            });
        }
        if (big) { shakeX = (Math.random() - 0.5) * 6; shakeY = (Math.random() - 0.5) * 6; }
    }

    function addFloat(x, y, text, color) {
        floats.push({ x: x, y: y, text: text, color: color, life: 1.0 });
    }

    // Input
    function shootBullet() {
        if (gameOver || waveTransition > 0) return;
        if (bullets.length < 3) {
            bullets.push({ x: playerX + 10, y: 320 });
            SoundManager.playBloop(400, 0.02);
        }
    }
    function aimAtClientX(clientX) {
        if (gameOver) return;
        var rect = nexusCanvas.getBoundingClientRect();
        var cx = ((clientX - rect.left) / rect.width) * W;
        playerX = Math.max(10, Math.min(W - 30, cx - 10));
    }
    nexusCanvas.onmousemove = function(e) { aimAtClientX(e.clientX); };
    nexusCanvas.ontouchmove = function(e) { e.preventDefault(); if (e.touches[0]) aimAtClientX(e.touches[0].clientX); };
    nexusCanvas.onclick = function() {
        if (gameOver) { nexusCanvas.onclick = null; startInvaders(); return; }
        shootBullet();
    };
    nexusCanvas.ontouchstart = function() {
        if (gameOver) { startInvaders(); return; }
        shootBullet();
    };

    function tick() {
        if (!invadersActive) return;
        tick_count++;

        // Shake decay
        shakeX *= 0.85; shakeY *= 0.85;

        if (waveTransition > 0) {
            waveTransition--;
            draw();
            invadersRaf = requestAnimationFrame(tick);
            return;
        }

        if (gameOver) { draw(); return; }

        // Player keyboard
        if (window._keys && window._keys['ArrowLeft']) playerX = Math.max(10, playerX - 5);
        if (window._keys && window._keys['ArrowRight']) playerX = Math.min(W - 30, playerX + 5);
        if (window._keys && window._keys[' '] && bullets.length < 3) {
            bullets.push({ x: playerX + 10, y: 320 });
            SoundManager.playBloop(400, 0.02);
            delete window._keys[' '];
        }

        // Bullets
        bullets = bullets.filter(function(b) { b.y -= 8; return b.y > 0; });

        // Enemy bullets
        enemyBullets = enemyBullets.filter(function(b) {
            b.y += 3 + wave * 0.3;
            if (b.y > 330 && b.y < 360 && b.x > playerX && b.x < playerX + 20) {
                gameOver = true;
                createExplosion(playerX + 10, 340, '#0ff', true);
                SoundManager.playBloop(100, 0.2);
            }
            return b.y < H;
        });

        // Move enemies (sine wave movement on later waves)
        var speed = 1 + wave * 0.15;
        var edge = false;
        enemies.forEach(function(e) {
            if (!e.alive) return;
            e.x += moveDir * speed;
            // Sine wobble on wave 3+
            if (wave >= 3) e.x += Math.sin(tick_count * 0.03 + e.y * 0.1) * 0.5;
            if (e.x > W - 30 || e.x < 10) edge = true;
            if (e.y > 310) gameOver = true;
        });
        if (edge) {
            moveDir *= -1;
            enemies.forEach(function(e) { e.y += 10 + wave; });
        }

        // Enemy firing
        enemyBulletTimer++;
        var fireRate = Math.max(15, 50 - wave * 4);
        if (enemyBulletTimer > fireRate) {
            var living = enemies.filter(function(e) { return e.alive; });
            if (living.length > 0) {
                var shooter = living[Math.floor(Math.random() * living.length)];
                enemyBullets.push({ x: shooter.x + 9, y: shooter.y + 16 });
            }
            enemyBulletTimer = 0;
        }

        // Collisions
        bullets.forEach(function(b, bi) {
            enemies.forEach(function(e) {
                if (e.alive && b.x > e.x - 2 && b.x < e.x + 20 && b.y > e.y && b.y < e.y + 18) {
                    e.hp--;
                    if (e.hp <= 0) {
                        e.alive = false;
                        var pts = 10 * (e.type + 1);
                        score += pts;
                        addFloat(e.x + 9, e.y, '+' + pts, SPRITES[e.type % 4].color);
                        createExplosion(e.x + 9, e.y + 8, SPRITES[e.type % 4].color, false);
                        SoundManager.playBloop(600 + Math.random() * 200, 0.05);
                    } else {
                        // Hit but not dead, flash
                        createExplosion(b.x, b.y, '#fff', false);
                        SoundManager.playBloop(300, 0.03);
                    }
                    bullets.splice(bi, 1);
                }
            });
        });

        // Particles
        particles = particles.filter(function(p) {
            p.x += p.vx; p.y += p.vy; p.life -= 0.025;
            return p.life > 0;
        });

        // Floats
        floats = floats.filter(function(f) {
            f.y -= 1.2; f.life -= 0.02;
            return f.life > 0;
        });

        // Wave clear
        if (enemies.every(function(e) { return !e.alive; })) {
            nextWave();
            SoundManager.playBloop(800, 0.1);
        }

        draw();
        invadersRaf = requestAnimationFrame(tick);
    }

    function draw() {
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Background
        ctx.fillStyle = '#04040c';
        ctx.fillRect(-5, -5, W + 10, H + 10);

        // Stars
        stars.forEach(function(s) {
            s.y += s.sp;
            if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
            ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + s.s * 0.25) + ')';
            ctx.fillRect(s.x, s.y, s.s, s.s);
        });

        // Scan lines
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

        // Defense line
        ctx.strokeStyle = 'rgba(0,255,255,0.12)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(0, 325); ctx.lineTo(W, 325); ctx.stroke();
        ctx.setLineDash([]);

        // Player ship
        if (!gameOver) {
            ctx.fillStyle = '#0ff';
            ctx.shadowColor = 'rgba(0,255,255,0.6)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(playerX + 10, 328);
            ctx.lineTo(playerX + 22, 348);
            ctx.lineTo(playerX + 17, 345);
            ctx.lineTo(playerX + 17, 350);
            ctx.lineTo(playerX + 3, 350);
            ctx.lineTo(playerX + 3, 345);
            ctx.lineTo(playerX - 2, 348);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            // Engine
            ctx.fillStyle = 'rgba(0,255,255,' + (0.3 + Math.random() * 0.3) + ')';
            ctx.fillRect(playerX + 5, 350, 10, 2 + Math.random() * 4);
        }

        // Enemies
        enemies.forEach(function(e) {
            if (!e.alive) return;
            var sz = 2;
            if (e.hp > 1) {
                // Shield glow for multi-HP enemies
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.beginPath();
                ctx.arc(e.x + 9, e.y + 8, 14, 0, Math.PI * 2);
                ctx.fill();
            }
            drawAlien(e.x, e.y, e.type, sz);
        });

        // Player bullets
        ctx.shadowColor = 'rgba(0,255,255,0.7)';
        ctx.shadowBlur = 5;
        bullets.forEach(function(b) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(b.x, b.y, 2, 10);
            ctx.fillStyle = 'rgba(0,255,255,0.3)';
            ctx.fillRect(b.x - 1, b.y, 4, 10);
        });
        ctx.shadowBlur = 0;

        // Enemy bullets
        ctx.shadowColor = 'rgba(255,68,68,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#f66';
        enemyBullets.forEach(function(b) {
            ctx.fillRect(b.x, b.y, 3, 7);
        });
        ctx.shadowBlur = 0;

        // Particles
        particles.forEach(function(p) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, p.sz || 2, p.sz || 2);
        });
        ctx.globalAlpha = 1;

        // Score floats
        floats.forEach(function(f) {
            ctx.globalAlpha = f.life;
            ctx.fillStyle = f.color;
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(f.text, f.x, f.y);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, 26);
        ctx.strokeStyle = 'rgba(0,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(W, 26); ctx.stroke();
        ctx.fillStyle = '#0ff'; ctx.font = 'bold 11px monospace';
        ctx.fillText('WAVE ' + wave, 12, 17);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText('SCORE ' + score, W - 12, 17);
        ctx.textAlign = 'left';
        // Lives indicator area (future)
        var living = enemies.filter(function(e) { return e.alive; }).length;
        ctx.fillStyle = '#555'; ctx.font = '9px monospace';
        ctx.fillText(living + ' remaining', W / 2 - 30, 17);

        // Wave transition overlay
        if (waveTransition > 0) {
            var alpha = waveTransition > 60 ? (90 - waveTransition) / 30 : waveTransition / 60;
            ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.6) + ')';
            ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#0ff';
            ctx.shadowColor = 'rgba(0,255,255,0.6)';
            ctx.shadowBlur = 14;
            ctx.font = 'bold 28px monospace';
            ctx.fillText('WAVE ' + wave, W / 2, H / 2 - 10);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            var names = ['', 'STANDARD GRID', 'V-FORMATION', 'DIAMOND STRIKE', 'CHAOS SCATTER', 'WALL DEFENSE', 'HEAVY GRID'];
            ctx.fillText(names[(wave - 1) % names.length + 1] || 'INCOMING', W / 2, H / 2 + 16);
            ctx.globalAlpha = 1;
            ctx.textAlign = 'left';
        }

        // Game over
        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f44';
            ctx.shadowColor = 'rgba(255,68,68,0.5)';
            ctx.shadowBlur = 14;
            ctx.font = 'bold 24px monospace';
            ctx.fillText('SYSTEM OFFLINE', W / 2, H / 2 - 30);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
            ctx.fillText('Score: ' + score, W / 2, H / 2);
            ctx.fillStyle = '#888'; ctx.font = '11px monospace';
            ctx.fillText('Wave ' + wave + ' reached', W / 2, H / 2 + 22);
            ctx.fillStyle = '#0ff'; ctx.font = '12px monospace';
            ctx.fillText('CLICK TO RETRY', W / 2, H / 2 + 54);
            ctx.textAlign = 'left';
            if (!scoreSubmitted) {
                scoreSubmitted = true;
                if (window.submitScore) window.submitScore('invaders', score);
            }
        }

        ctx.restore();
    }

    nextWave();
    invadersRaf = requestAnimationFrame(tick);
}

function stopInvaders() {
    cancelAnimationFrame(invadersRaf);
    invadersActive = false;
    if (nexusCanvas) nexusCanvas.onclick = null;
}
