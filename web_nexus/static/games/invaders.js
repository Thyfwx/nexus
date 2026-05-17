function startInvaders() {
    stopAllGames();
    invadersActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiContainer.classList.add('gui-game-wide');
    guiTitle.textContent = 'NEXUS INVADERS';
    nexusCanvas.style.display = 'block';
    nexusCanvas.style.maxWidth = '100%';
    nexusCanvas.style.height = 'auto';
    nexusCanvas.style.borderRadius = '4px';
    nexusCanvas.style.border = '1px solid rgba(0,255,255,0.2)';
    nexusCanvas.style.boxShadow = '0 0 20px rgba(0,255,255,0.15)';
    nexusCanvas.width = 480; nexusCanvas.height = 420;
    var ctx = nexusCanvas.getContext('2d');
    var W = 480, H = 420;

    // ── STATE ──
    var playerX = 220, playerAlive = true;
    var bullets = [], enemies = [], particles = [], floats = [], powerups = [];
    var enemyBullets = [];
    var score = 0, wave = 0, gameOver = false, moveDir = 1;
    var enemyBulletTimer = 0, scoreSubmitted = false;
    var waveTransition = 0, tick_count = 0;
    var shakeX = 0, shakeY = 0;

    // Power-up state
    var hasShield = false, rapidTimer = 0, spreadTimer = 0, scoreX2Timer = 0;
    var autoFireTimer = 0;

    // Stars
    var stars = [];
    for (var i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5, sp: Math.random() * 0.5 + 0.1 });

    // ── SPRITES ──
    var SPRITES = [
        { color: '#0ff', glow: 'rgba(0,255,255,0.4)', px: [[0,0,1,0,0,0,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,1,0,0,0,1,0,1],[0,0,0,1,0,1,0,0,0]] },
        { color: '#0f0', glow: 'rgba(0,255,0,0.4)', px: [[0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0]] },
        { color: '#f0f', glow: 'rgba(255,0,255,0.4)', px: [[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,1,1,1,0,1,0],[0,1,0,0,0,0,0,1,0],[0,0,1,1,0,1,1,0,0]] },
        { color: '#fa0', glow: 'rgba(255,170,0,0.4)', px: [[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,0,1,0,1,0,0,1],[0,1,0,0,0,0,0,1,0],[1,0,1,0,0,0,1,0,1]] }
    ];

    function drawAlien(x, y, type, sz) {
        var sp = SPRITES[type % SPRITES.length];
        ctx.fillStyle = sp.color; ctx.shadowColor = sp.glow; ctx.shadowBlur = 6;
        var rows = sp.px;
        for (var r = 0; r < rows.length; r++)
            for (var c = 0; c < rows[r].length; c++)
                if (rows[r][c]) ctx.fillRect(x + c * sz, y + r * sz, sz, sz);
        ctx.shadowBlur = 0;
    }

    // ── POWER-UP TYPES ──
    var PU_TYPES = [
        { label: 'R', color: '#f44', name: 'RAPID FIRE', apply: function() { rapidTimer = 300; } },
        { label: 'S', color: '#ff0', name: 'SPREAD SHOT', apply: function() { spreadTimer = 300; } },
        { label: '!', color: '#0ff', name: 'SHIELD', apply: function() { hasShield = true; } },
        { label: 'B', color: '#f80', name: 'BOMB', apply: function() {
            enemies.forEach(function(e) { if (e.alive) { e.alive = false; score += 5; createExplosion(e.x+9, e.y+8, SPRITES[e.type%4].color, false); }});
            shakeX = 8; shakeY = 8;
            SoundManager.playBloop(200, 0.15);
        }},
        { label: '2', color: '#0f0', name: 'SCORE x2', apply: function() { scoreX2Timer = 300; } }
    ];

    function maybeDropPowerup(x, y) {
        if (Math.random() < 0.12) {
            var pu = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
            powerups.push({ x: x, y: y, type: pu, vy: 1.5 });
        }
    }

    // ── FORMATIONS ──
    function makeEnemy(x, y, type, hp, kind) {
        return { x: x, y: y, alive: true, type: type % 4, hp: hp || 1, maxHp: hp || 1, kind: kind || 'standard', diveState: 0, diveTarget: 0 };
    }

    function formation_grid(rows, cols) {
        var out = [];
        for (var r = 0; r < rows; r++)
            for (var c = 0; c < cols; c++)
                out.push(makeEnemy(50 + c * 55, 50 + r * 42, r, 1));
        return out;
    }
    function formation_v() {
        var out = [], pts = [[3,0],[2,1],[4,1],[1,2],[5,2],[0,3],[6,3]];
        pts.forEach(function(p) { out.push(makeEnemy(50 + p[0] * 55, 45 + p[1] * 42, p[1], 1)); });
        return out;
    }
    function formation_diamond() {
        var out = [], pts = [[3,0],[2,1],[4,1],[1,2],[3,2],[5,2],[2,3],[4,3],[3,4]];
        pts.forEach(function(p) { out.push(makeEnemy(70 + p[0] * 50, 40 + p[1] * 38, p[1], 1)); });
        return out;
    }
    function formation_scatter(n) {
        var out = [];
        for (var i = 0; i < n; i++) out.push(makeEnemy(30 + Math.random() * (W - 80), 30 + Math.random() * 140, Math.floor(Math.random() * 4), 1));
        return out;
    }

    function addDivers(list, count) {
        for (var i = 0; i < count; i++) {
            var e = makeEnemy(40 + Math.random() * (W - 100), 30 + Math.random() * 60, 3, 1, 'diver');
            list.push(e);
        }
    }
    function addSplitters(list, count) {
        for (var i = 0; i < count; i++) {
            var e = makeEnemy(60 + Math.random() * (W - 140), 40 + Math.random() * 80, 2, 2, 'splitter');
            list.push(e);
        }
    }
    function addShields(list, count) {
        for (var i = 0; i < count; i++) {
            var e = makeEnemy(60 + Math.random() * (W - 140), 50 + Math.random() * 60, 1, 3, 'shield');
            list.push(e);
        }
    }
    function addMiniBoss(list) {
        var e = makeEnemy(W / 2 - 20, 35, 0, 8 + wave, 'miniboss');
        list.push(e);
    }
    function addBigBoss(list) {
        var e = makeEnemy(W / 2 - 30, 30, 0, 20 + wave * 2, 'boss');
        list.push(e);
    }

    function nextWave() {
        wave++;
        moveDir = 1;
        enemyBullets = [];
        enemyBulletTimer = 0;

        var isBoss = (wave % 9 === 0);
        var isMiniBoss = (wave % 3 === 0) && !isBoss;

        if (isBoss) {
            enemies = [];
            addBigBoss(enemies);
            formation_scatter(4).forEach(function(e) { enemies.push(e); });
            waveTransition = 120;
        } else if (isMiniBoss) {
            enemies = formation_grid(2, 5);
            addMiniBoss(enemies);
            if (wave >= 6) addDivers(enemies, 2);
            waveTransition = 90;
        } else {
            var forms = [formation_grid.bind(null, 3, 6), formation_v, formation_diamond, formation_scatter.bind(null, 12 + wave)];
            enemies = forms[(wave - 1) % forms.length]();
            if (wave >= 4) addDivers(enemies, Math.min(wave - 3, 4));
            if (wave >= 5) addSplitters(enemies, Math.min(wave - 4, 3));
            if (wave >= 7) addShields(enemies, Math.min(wave - 6, 2));
            waveTransition = 70;
        }
    }

    // ── EFFECTS ──
    function createExplosion(x, y, color, big) {
        var count = big ? 20 : 10;
        for (var i = 0; i < count; i++)
            particles.push({ x: x, y: y, vx: (Math.random()-0.5)*(big?8:4), vy: (Math.random()-0.5)*(big?8:4), life: 1, color: color, sz: big?3:2 });
        if (big) { shakeX = (Math.random()-0.5)*8; shakeY = (Math.random()-0.5)*8; }
    }
    function addFloat(x, y, text, color) { floats.push({ x: x, y: y, text: text, color: color, life: 1 }); }

    // ── INPUT ──
    function shootBullet() {
        if (gameOver || waveTransition > 0 || !playerAlive) return;
        var max = rapidTimer > 0 ? 6 : 3;
        if (bullets.length < max) {
            if (spreadTimer > 0) {
                bullets.push({ x: playerX + 10, y: 345 });
                bullets.push({ x: playerX + 4, y: 348, vx: -1.5 });
                bullets.push({ x: playerX + 16, y: 348, vx: 1.5 });
            } else {
                bullets.push({ x: playerX + 10, y: 345 });
            }
            SoundManager.playBloop(400, 0.02);
        }
    }
    function aimAtClientX(cx) {
        if (gameOver) return;
        var rect = nexusCanvas.getBoundingClientRect();
        playerX = Math.max(10, Math.min(W - 30, ((cx - rect.left) / rect.width) * W - 10));
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

    // ── GAME LOOP ──
    function tick() {
        if (!invadersActive) return;
        tick_count++;
        shakeX *= 0.85; shakeY *= 0.85;

        // Timers
        if (rapidTimer > 0) rapidTimer--;
        if (spreadTimer > 0) spreadTimer--;
        if (scoreX2Timer > 0) scoreX2Timer--;

        // Rapid fire auto-shoot
        if (rapidTimer > 0 && !gameOver && waveTransition <= 0) {
            autoFireTimer++;
            if (autoFireTimer % 6 === 0) shootBullet();
        } else { autoFireTimer = 0; }

        if (waveTransition > 0) { waveTransition--; draw(); invadersRaf = requestAnimationFrame(tick); return; }
        if (gameOver) { draw(); return; }

        // Keyboard
        if (window._keys && window._keys['ArrowLeft']) playerX = Math.max(10, playerX - 5);
        if (window._keys && window._keys['ArrowRight']) playerX = Math.min(W - 30, playerX + 5);
        if (window._keys && window._keys[' '] && bullets.length < 3) {
            shootBullet(); delete window._keys[' '];
        }

        // Player bullets
        bullets = bullets.filter(function(b) {
            b.y -= 8;
            if (b.vx) b.x += b.vx;
            return b.y > 0 && b.x > 0 && b.x < W;
        });

        // Enemy bullets
        enemyBullets = enemyBullets.filter(function(b) {
            b.y += 3 + wave * 0.2;
            if (b.x !== undefined && b.tx !== undefined) b.x += (b.tx - b.x) * 0.02; // aimed bullets
            if (b.y > 350 && b.y < 380 && b.x > playerX && b.x < playerX + 20) {
                if (hasShield) {
                    hasShield = false;
                    addFloat(playerX + 10, 340, 'SHIELD BREAK', '#0ff');
                    SoundManager.playBloop(250, 0.05);
                } else {
                    gameOver = true;
                    createExplosion(playerX + 10, 360, '#0ff', true);
                    SoundManager.playBloop(100, 0.2);
                }
            }
            return b.y < H;
        });

        // Move enemies
        var speed = 1 + wave * 0.12;
        var edge = false;
        enemies.forEach(function(e) {
            if (!e.alive) return;

            if (e.kind === 'diver') {
                // Divers swoop down then back up
                if (e.diveState === 0) {
                    e.x += moveDir * speed;
                    if (Math.random() < 0.005 + wave * 0.001) { e.diveState = 1; e.diveTarget = 350; }
                } else if (e.diveState === 1) {
                    e.y += 4;
                    e.x += (playerX - e.x) * 0.03;
                    if (e.y >= e.diveTarget) e.diveState = 2;
                } else {
                    e.y -= 3;
                    if (e.y < 60) { e.diveState = 0; e.y = 50; }
                }
            } else if (e.kind === 'boss' || e.kind === 'miniboss') {
                // Bosses move in a slow sine pattern
                e.x = W / 2 - 20 + Math.sin(tick_count * 0.015) * (W / 3);
                e.y = 30 + Math.sin(tick_count * 0.01) * 20;
            } else {
                e.x += moveDir * speed;
                if (wave >= 3) e.x += Math.sin(tick_count * 0.025 + e.y * 0.08) * 0.6;
            }

            if (e.x > W - 30 || e.x < 10) edge = true;
            if (e.y > 340 && e.kind !== 'diver') gameOver = true;
        });
        if (edge) {
            moveDir *= -1;
            enemies.forEach(function(e) { if (e.kind !== 'boss' && e.kind !== 'miniboss' && e.kind !== 'diver') e.y += 8 + Math.min(wave, 10); });
        }

        // Enemy firing
        enemyBulletTimer++;
        var fireRate = Math.max(12, 45 - wave * 3);
        if (enemyBulletTimer > fireRate) {
            var living = enemies.filter(function(e) { return e.alive; });
            if (living.length > 0) {
                var shooter = living[Math.floor(Math.random() * living.length)];
                if (shooter.kind === 'boss') {
                    // Boss fires 3 aimed bullets
                    for (var i = -1; i <= 1; i++)
                        enemyBullets.push({ x: shooter.x + 20 + i * 15, y: shooter.y + 20, tx: playerX + i * 30 });
                } else if (shooter.kind === 'miniboss') {
                    enemyBullets.push({ x: shooter.x + 9, y: shooter.y + 16 });
                    enemyBullets.push({ x: shooter.x + 9, y: shooter.y + 16, tx: playerX });
                } else {
                    enemyBullets.push({ x: shooter.x + 9, y: shooter.y + 16 });
                }
            }
            enemyBulletTimer = 0;
        }

        // Bullet collisions
        bullets.forEach(function(b, bi) {
            enemies.forEach(function(e) {
                if (!e.alive) return;
                var hitW = (e.kind === 'boss') ? 40 : (e.kind === 'miniboss') ? 28 : 18;
                var hitH = (e.kind === 'boss') ? 24 : (e.kind === 'miniboss') ? 20 : 16;
                if (b.x > e.x - 2 && b.x < e.x + hitW && b.y > e.y && b.y < e.y + hitH) {
                    e.hp--;
                    bullets.splice(bi, 1);
                    if (e.hp <= 0) {
                        e.alive = false;
                        var pts = e.kind === 'boss' ? 500 : e.kind === 'miniboss' ? 100 : e.kind === 'shield' ? 30 : e.kind === 'splitter' ? 15 : e.kind === 'diver' ? 20 : 10 * (e.type + 1);
                        if (scoreX2Timer > 0) pts *= 2;
                        score += pts;
                        addFloat(e.x + 9, e.y, '+' + pts, SPRITES[e.type % 4].color);
                        createExplosion(e.x + 9, e.y + 8, SPRITES[e.type % 4].color, e.kind === 'boss' || e.kind === 'miniboss');
                        SoundManager.playBloop(600 + Math.random() * 200, 0.05);
                        maybeDropPowerup(e.x + 9, e.y + 8);

                        // Splitter spawns 2 small aliens
                        if (e.kind === 'splitter') {
                            enemies.push(makeEnemy(e.x - 15, e.y, e.type, 1, 'standard'));
                            enemies.push(makeEnemy(e.x + 15, e.y, e.type, 1, 'standard'));
                        }
                    } else {
                        createExplosion(b.x, b.y, '#fff', false);
                        SoundManager.playBloop(300, 0.03);
                    }
                }
            });
        });

        // Power-up collection
        powerups = powerups.filter(function(pu) {
            pu.y += pu.vy;
            if (pu.y > 350 && pu.y < 380 && pu.x > playerX - 5 && pu.x < playerX + 25) {
                pu.type.apply();
                addFloat(playerX + 10, 340, pu.type.name, pu.type.color);
                SoundManager.playBloop(800, 0.08);
                return false;
            }
            return pu.y < H;
        });

        // Particles + floats
        particles = particles.filter(function(p) { p.x += p.vx; p.y += p.vy; p.life -= 0.025; return p.life > 0; });
        floats = floats.filter(function(f) { f.y -= 1.2; f.life -= 0.018; return f.life > 0; });

        // Wave clear
        if (enemies.every(function(e) { return !e.alive; })) {
            nextWave();
            SoundManager.playBloop(800, 0.1);
        }

        draw();
        invadersRaf = requestAnimationFrame(tick);
    }

    // ── DRAW ──
    function draw() {
        ctx.save();
        ctx.translate(shakeX, shakeY);

        ctx.fillStyle = '#04040c';
        ctx.fillRect(-5, -5, W + 10, H + 10);

        // Stars
        stars.forEach(function(s) {
            s.y += s.sp; if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
            ctx.fillStyle = 'rgba(255,255,255,' + (0.15 + s.s * 0.2) + ')';
            ctx.fillRect(s.x, s.y, s.s, s.s);
        });

        // Scan lines
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

        // Defense line
        ctx.strokeStyle = 'rgba(0,255,255,0.1)';
        ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(0, 348); ctx.lineTo(W, 348); ctx.stroke(); ctx.setLineDash([]);

        // Player
        if (!gameOver) {
            // Shield visual
            if (hasShield) {
                ctx.strokeStyle = 'rgba(0,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(playerX + 10, 360, 18, 0, Math.PI * 2); ctx.stroke();
                ctx.lineWidth = 1;
            }
            ctx.fillStyle = '#0ff'; ctx.shadowColor = 'rgba(0,255,255,0.6)'; ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(playerX + 10, 348); ctx.lineTo(playerX + 22, 370);
            ctx.lineTo(playerX + 17, 367); ctx.lineTo(playerX + 17, 372);
            ctx.lineTo(playerX + 3, 372); ctx.lineTo(playerX + 3, 367);
            ctx.lineTo(playerX - 2, 370);
            ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
            // Engine
            ctx.fillStyle = 'rgba(0,255,255,' + (0.3 + Math.random() * 0.3) + ')';
            ctx.fillRect(playerX + 5, 372, 10, 2 + Math.random() * 4);
        }

        // Enemies
        enemies.forEach(function(e) {
            if (!e.alive) return;
            var sz = (e.kind === 'boss') ? 4 : (e.kind === 'miniboss') ? 3 : 2;

            // Shield bubble
            if (e.kind === 'shield' || e.hp > 1) {
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.1 + (e.hp / e.maxHp) * 0.2) + ')';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(e.x + (sz * 9) / 2, e.y + (sz * 8) / 2, sz * 6, 0, Math.PI * 2); ctx.stroke();
            }

            // Boss health bar
            if ((e.kind === 'boss' || e.kind === 'miniboss') && e.hp > 0) {
                var bw = sz * 9;
                ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 6, bw, 3);
                ctx.fillStyle = e.kind === 'boss' ? '#f44' : '#fa0';
                ctx.fillRect(e.x, e.y - 6, bw * (e.hp / e.maxHp), 3);
            }

            // Diver trail
            if (e.kind === 'diver' && e.diveState === 1) {
                ctx.fillStyle = 'rgba(255,170,0,0.15)';
                ctx.fillRect(e.x + 4, e.y - 8, 10, 8);
            }

            drawAlien(e.x, e.y, e.type, sz);
        });

        // Bullets
        ctx.shadowColor = 'rgba(0,255,255,0.7)'; ctx.shadowBlur = 5;
        bullets.forEach(function(b) {
            ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, 2, 10);
            ctx.fillStyle = 'rgba(0,255,255,0.3)'; ctx.fillRect(b.x - 1, b.y, 4, 10);
        });
        ctx.shadowBlur = 0;

        // Enemy bullets
        ctx.shadowColor = 'rgba(255,68,68,0.5)'; ctx.shadowBlur = 4;
        ctx.fillStyle = '#f66';
        enemyBullets.forEach(function(b) { ctx.fillRect(b.x, b.y, 3, 7); });
        ctx.shadowBlur = 0;

        // Power-ups
        powerups.forEach(function(pu) {
            ctx.fillStyle = pu.type.color;
            ctx.shadowColor = pu.type.color; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(pu.x, pu.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(pu.type.label, pu.x, pu.y + 4);
            ctx.textAlign = 'left';
        });

        // Particles
        particles.forEach(function(p) {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, p.sz || 2, p.sz || 2);
        });
        ctx.globalAlpha = 1;

        // Score floats
        floats.forEach(function(f) {
            ctx.globalAlpha = f.life; ctx.fillStyle = f.color;
            ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
            ctx.fillText(f.text, f.x, f.y);
        });
        ctx.globalAlpha = 1; ctx.textAlign = 'left';

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 28);
        ctx.strokeStyle = 'rgba(0,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(W, 28); ctx.stroke();
        ctx.fillStyle = '#0ff'; ctx.font = 'bold 11px monospace';
        ctx.fillText('WAVE ' + wave, 12, 18);
        var living = enemies.filter(function(e) { return e.alive; }).length;
        ctx.fillStyle = '#555'; ctx.font = '9px monospace';
        ctx.textAlign = 'center'; ctx.fillText(living + ' left', W / 2, 18); ctx.textAlign = 'left';
        ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
        ctx.font = 'bold 11px monospace'; ctx.fillText('SCORE ' + score, W - 12, 18);
        ctx.textAlign = 'left';

        // Active power-up indicators
        var puY = 38;
        if (rapidTimer > 0) { ctx.fillStyle = '#f44'; ctx.font = '8px monospace'; ctx.fillText('RAPID ' + Math.ceil(rapidTimer/60) + 's', 10, puY); puY += 12; }
        if (spreadTimer > 0) { ctx.fillStyle = '#ff0'; ctx.font = '8px monospace'; ctx.fillText('SPREAD ' + Math.ceil(spreadTimer/60) + 's', 10, puY); puY += 12; }
        if (scoreX2Timer > 0) { ctx.fillStyle = '#0f0'; ctx.font = '8px monospace'; ctx.fillText('x2 SCORE ' + Math.ceil(scoreX2Timer/60) + 's', 10, puY); puY += 12; }
        if (hasShield) { ctx.fillStyle = '#0ff'; ctx.font = '8px monospace'; ctx.fillText('SHIELD ACTIVE', 10, puY); }

        // Wave transition
        if (waveTransition > 0) {
            var alpha = waveTransition > 80 ? (120 - waveTransition) / 40 : waveTransition / 80;
            ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.7) + ')'; ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center'; ctx.globalAlpha = alpha;

            var isBoss = (wave % 9 === 0);
            var isMiniBoss = (wave % 3 === 0) && !isBoss;

            if (isBoss) {
                ctx.fillStyle = '#f44'; ctx.shadowColor = 'rgba(255,68,68,0.6)'; ctx.shadowBlur = 16;
                ctx.font = 'bold 14px monospace'; ctx.fillText('WARNING', W/2, H/2 - 30);
                ctx.font = 'bold 26px monospace'; ctx.fillText('BOSS INCOMING', W/2, H/2 + 5);
                ctx.shadowBlur = 0;
            } else if (isMiniBoss) {
                ctx.fillStyle = '#fa0'; ctx.shadowColor = 'rgba(255,170,0,0.5)'; ctx.shadowBlur = 12;
                ctx.font = 'bold 24px monospace'; ctx.fillText('WAVE ' + wave, W/2, H/2 - 8);
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#888'; ctx.font = '12px monospace'; ctx.fillText('MINI-BOSS', W/2, H/2 + 16);
            } else {
                ctx.fillStyle = '#0ff'; ctx.shadowColor = 'rgba(0,255,255,0.5)'; ctx.shadowBlur = 12;
                ctx.font = 'bold 26px monospace'; ctx.fillText('WAVE ' + wave, W/2, H/2 - 8);
                ctx.shadowBlur = 0;
            }
            ctx.globalAlpha = 1; ctx.textAlign = 'left';
        }

        // Game over
        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f44'; ctx.shadowColor = 'rgba(255,68,68,0.5)'; ctx.shadowBlur = 14;
            ctx.font = 'bold 24px monospace'; ctx.fillText('NEXUS BREACHED', W/2, H/2 - 30);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
            ctx.fillText('Score: ' + score, W/2, H/2);
            ctx.fillStyle = '#888'; ctx.font = '11px monospace';
            ctx.fillText('Wave ' + wave + ' reached', W/2, H/2 + 22);
            ctx.fillStyle = '#0ff'; ctx.font = '12px monospace';
            ctx.fillText('CLICK TO RETRY', W/2, H/2 + 54);
            ctx.textAlign = 'left';
            if (!scoreSubmitted) { scoreSubmitted = true; if (window.submitScore) window.submitScore('invaders', score); }
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
