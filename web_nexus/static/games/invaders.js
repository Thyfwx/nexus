// NEXUS INVADERS — full-terminal canvas, power-up stacking, boss waves
// Game replaces terminal output area. Sidebar stays visible.

function startInvaders() {
    stopAllGames();
    invadersActive = true;

    // ── TAKE OVER TERMINAL AREA (no modal) ──
    var monitor = document.querySelector('.monitor');
    var output = document.getElementById('output');
    var inputWrap = document.querySelector('.terminal-input-wrapper');
    var tipBar = document.querySelector('.tip-bar, .nexus-tip');
    if (output) output.style.display = 'none';
    if (inputWrap) inputWrap.style.display = 'none';
    if (tipBar) tipBar.style.display = 'none';

    // Create game container
    var gameHost = document.createElement('div');
    gameHost.id = 'invaders-host';
    gameHost.style.cssText = 'position:relative; width:100%; height:100%; min-height:500px; display:flex; flex-direction:column; align-items:center; padding:8px;';
    monitor.appendChild(gameHost);

    // Title + close button
    var topBar = document.createElement('div');
    topBar.style.cssText = 'width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-family:"Fira Code",monospace;';
    topBar.innerHTML = '<span style="color:#0ff; font-size:0.75rem; font-weight:700; letter-spacing:3px;">NEXUS INVADERS</span><button id="invaders-close" style="background:transparent; border:1px solid rgba(255,255,255,0.15); color:#888; font-family:inherit; font-size:0.75rem; padding:2px 10px; border-radius:4px; cursor:pointer; letter-spacing:1px;">X</button>';
    gameHost.appendChild(topBar);

    document.getElementById('invaders-close').onclick = function() {
        stopInvaders();
        var host = document.getElementById('invaders-host');
        if (host) host.remove();
        if (output) output.style.display = '';
        if (inputWrap) inputWrap.style.display = '';
        if (tipBar) tipBar.style.display = '';
        if (window.guiContainer) guiContainer.classList.add('gui-hidden');
    };

    // Canvas — fills the terminal area
    var canvas = document.createElement('canvas');
    var W = Math.min(monitor.clientWidth - 20, 700);
    var H = Math.min(monitor.clientHeight - 50, 520);
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'border-radius:4px; border:1px solid rgba(0,255,255,0.15); box-shadow:0 0 20px rgba(0,255,255,0.1); cursor:crosshair;';
    gameHost.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    // ── STATE ──
    var playerX = W / 2 - 10, bullets = [], enemies = [], particles = [], floats = [], powerups = [];
    var enemyBullets = [];
    var score = 0, wave = 0, gameOver = false, moveDir = 1;
    var enemyBulletTimer = 0, scoreSubmitted = false;
    var waveTransition = 0, tick_count = 0;
    var shakeX = 0, shakeY = 0;

    // Power-up state (stacking: first = timed, second same type = permanent)
    var pu_state = { rapid: 0, spread: 0, shield: false, scoreX2: 0 };
    var pu_permanent = { rapid: false, spread: false, shield: false, scoreX2: false };
    var autoFireTimer = 0;

    // Stars
    var stars = [];
    for (var i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5, sp: Math.random() * 0.5 + 0.1 });

    // Wave palettes
    var PALETTES = [
        { bg: '#04040c', star: '255,255,255', accent: '0,255,255' },
        { bg: '#0a0408', star: '255,200,200', accent: '255,100,100' },
        { bg: '#040a04', star: '200,255,200', accent: '100,255,100' },
        { bg: '#08040a', star: '220,200,255', accent: '180,100,255' },
        { bg: '#0a0804', star: '255,230,180', accent: '255,170,0' },
        { bg: '#040808', star: '180,255,255', accent: '0,255,200' }
    ];

    // ── SPRITES ──
    var SPRITES = [
        { color: '#0ff', glow: 'rgba(0,255,255,0.4)', px: [[0,0,1,0,0,0,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,1,0,0,0,1,0,1],[0,0,0,1,0,1,0,0,0]] },
        { color: '#0f0', glow: 'rgba(0,255,0,0.4)', px: [[0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0]] },
        { color: '#f0f', glow: 'rgba(255,0,255,0.4)', px: [[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,1,1,1,0,1,0],[0,1,0,0,0,0,0,1,0],[0,0,1,1,0,1,1,0,0]] },
        { color: '#fa0', glow: 'rgba(255,170,0,0.4)', px: [[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,0,1,0,1,0,0,1],[0,1,0,0,0,0,0,1,0],[1,0,1,0,0,0,1,0,1]] }
    ];

    function drawAlien(x, y, type, sz) {
        var sp = SPRITES[type % 4];
        ctx.fillStyle = sp.color; ctx.shadowColor = sp.glow; ctx.shadowBlur = 6;
        for (var r = 0; r < sp.px.length; r++)
            for (var c = 0; c < sp.px[r].length; c++)
                if (sp.px[r][c]) ctx.fillRect(x + c * sz, y + r * sz, sz, sz);
        ctx.shadowBlur = 0;
    }

    // ── POWER-UPS ──
    var PU_TYPES = [
        { label: 'R', color: '#f44', name: 'RAPID FIRE', key: 'rapid', apply: function() {
            if (pu_state.rapid > 0 || pu_permanent.rapid) { pu_permanent.rapid = true; addFloat(playerX + 10, H - 50, 'RAPID FOREVER', '#f44'); }
            else pu_state.rapid = 1200; // 20 sec
        }},
        { label: 'S', color: '#ff0', name: 'SPREAD', key: 'spread', apply: function() {
            if (pu_state.spread > 0 || pu_permanent.spread) { pu_permanent.spread = true; addFloat(playerX + 10, H - 50, 'SPREAD FOREVER', '#ff0'); }
            else pu_state.spread = 1500; // 25 sec
        }},
        { label: '!', color: '#0ff', name: 'SHIELD', key: 'shield', apply: function() {
            pu_state.shield = true;
        }},
        { label: '2', color: '#0f0', name: 'SCORE x2', key: 'scoreX2', apply: function() {
            if (pu_state.scoreX2 > 0 || pu_permanent.scoreX2) { pu_permanent.scoreX2 = true; addFloat(playerX + 10, H - 50, 'x2 FOREVER', '#0f0'); }
            else pu_state.scoreX2 = 1500; // 25 sec
        }},
        { label: 'P', color: '#f80', name: 'PULSE', key: 'pulse', apply: function() {
            // Damages all enemies for 1 HP, doesn't wipe them
            enemies.forEach(function(e) {
                if (!e.alive) return;
                e.hp--;
                if (e.hp <= 0) { e.alive = false; score += 5; createExplosion(e.x + 9, e.y + 8, SPRITES[e.type % 4].color, false); }
            });
            shakeX = 6; shakeY = 6;
            addFloat(W / 2, H / 2, 'PULSE', '#f80');
            SoundManager.playBloop(200, 0.12);
        }}
    ];

    function maybeDropPowerup(x, y) {
        if (Math.random() < 0.14) {
            var pu = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
            powerups.push({ x: x, y: y, type: pu, vy: 1.2 });
        }
    }

    // ── ENEMIES ──
    function makeEnemy(x, y, type, hp, kind) {
        return { x: x, y: y, targetX: x, targetY: y, alive: true, type: type % 4, hp: hp || 1, maxHp: hp || 1, kind: kind || 'standard', diveState: 0, entering: true, enterDelay: 0 };
    }
    function stagger(list) {
        for (var i = 0; i < list.length; i++) {
            list[i].targetX = list[i].x; list[i].targetY = list[i].y;
            list[i].y = -30 - Math.random() * 100;
            list[i].x = list[i].targetX + (Math.random() - 0.5) * 80;
            list[i].entering = true; list[i].enterDelay = i * 5 + Math.random() * 15;
        }
        return list;
    }

    function formation_grid(rows, cols) {
        var out = [], sx = (W - cols * 50) / 2;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++)
            out.push(makeEnemy(sx + c * 50, 50 + r * 40, r, 1));
        return stagger(out);
    }
    function formation_v() {
        var out = [], cx = W / 2, pts = [[0,-2],[1,-1],[-1,-1],[2,0],[-2,0],[3,1],[-3,1]];
        pts.forEach(function(p) { out.push(makeEnemy(cx + p[0] * 45, 70 + (p[1] + 2) * 40, Math.abs(p[1]) % 4, 1)); });
        return stagger(out);
    }
    function formation_diamond() {
        var out = [], cx = W / 2, pts = [[0,0],[1,1],[-1,1],[2,2],[0,2],[-2,2],[1,3],[-1,3],[0,4]];
        pts.forEach(function(p) { out.push(makeEnemy(cx + p[0] * 45, 40 + p[1] * 35, (p[0] + p[1]) % 4, 1)); });
        return stagger(out);
    }
    function formation_scatter(n) {
        var out = [];
        for (var i = 0; i < n; i++) out.push(makeEnemy(30 + Math.random() * (W - 80), 30 + Math.random() * 160, Math.floor(Math.random() * 4), 1));
        return stagger(out);
    }

    function addDivers(list, n) { for (var i = 0; i < n; i++) list.push(makeEnemy(40 + Math.random() * (W - 100), 30 + Math.random() * 50, 3, 1, 'diver')); }
    function addSplitters(list, n) { for (var i = 0; i < n; i++) list.push(makeEnemy(60 + Math.random() * (W - 140), 40 + Math.random() * 70, 2, 2, 'splitter')); }
    function addShields(list, n) { for (var i = 0; i < n; i++) list.push(makeEnemy(60 + Math.random() * (W - 140), 50 + Math.random() * 50, 1, 3, 'shield')); }

    function nextWave() {
        wave++; moveDir = 1; enemyBullets = []; enemyBulletTimer = 0;
        var isBoss = (wave % 9 === 0), isMiniBoss = (wave % 3 === 0) && !isBoss;

        if (isBoss) {
            enemies = [makeEnemy(W / 2 - 30, 30, 0, 20 + wave * 2, 'boss')];
            formation_scatter(4).forEach(function(e) { enemies.push(e); });
            waveTransition = 120;
        } else if (isMiniBoss) {
            enemies = formation_grid(2, 5);
            enemies.push(makeEnemy(W / 2 - 15, 35, 0, 8 + wave, 'miniboss'));
            if (wave >= 6) addDivers(enemies, 2);
            waveTransition = 90;
        } else {
            var forms = [formation_grid.bind(null, 3, 7), formation_v, formation_diamond, formation_scatter.bind(null, 10 + wave)];
            enemies = forms[(wave - 1) % forms.length]();
            if (wave >= 4) addDivers(enemies, Math.min(wave - 3, 4));
            if (wave >= 5) addSplitters(enemies, Math.min(wave - 4, 3));
            if (wave >= 7) addShields(enemies, Math.min(wave - 6, 2));
            waveTransition = 70;
        }
    }

    // ── EFFECTS ──
    function createExplosion(x, y, color, big) {
        var n = big ? 20 : 10;
        for (var i = 0; i < n; i++) particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * (big ? 8 : 4), vy: (Math.random() - 0.5) * (big ? 8 : 4), life: 1, color: color, sz: big ? 3 : 2 });
        if (big) { shakeX = (Math.random() - 0.5) * 8; shakeY = (Math.random() - 0.5) * 8; }
    }
    function addFloat(x, y, text, color) { floats.push({ x: x, y: y, text: text, color: color, life: 1 }); }

    // ── INPUT ──
    function shootBullet() {
        if (gameOver || waveTransition > 0) return;
        var max = (pu_state.rapid > 0 || pu_permanent.rapid) ? 8 : 3;
        if (bullets.length < max) {
            if (pu_state.spread > 0 || pu_permanent.spread) {
                bullets.push({ x: playerX + 10, y: H - 55 }); bullets.push({ x: playerX + 4, y: H - 52, vx: -1.5 }); bullets.push({ x: playerX + 16, y: H - 52, vx: 1.5 });
            } else { bullets.push({ x: playerX + 10, y: H - 55 }); }
            SoundManager.playBloop(400, 0.02);
        }
    }
    canvas.onmousemove = function(e) { if (gameOver) return; var r = canvas.getBoundingClientRect(); playerX = Math.max(10, Math.min(W - 30, ((e.clientX - r.left) / r.width) * W - 10)); };
    canvas.ontouchmove = function(e) { e.preventDefault(); if (e.touches[0]) { var r = canvas.getBoundingClientRect(); playerX = Math.max(10, Math.min(W - 30, ((e.touches[0].clientX - r.left) / r.width) * W - 10)); } };
    canvas.onclick = function() { if (gameOver) { startInvaders(); return; } shootBullet(); };
    canvas.ontouchstart = function() { if (gameOver) { startInvaders(); return; } shootBullet(); };

    // ── GAME LOOP ──
    function tick() {
        if (!invadersActive) return;
        tick_count++; shakeX *= 0.85; shakeY *= 0.85;

        // Power-up timers
        if (pu_state.rapid > 0 && !pu_permanent.rapid) pu_state.rapid--;
        if (pu_state.spread > 0 && !pu_permanent.spread) pu_state.spread--;
        if (pu_state.scoreX2 > 0 && !pu_permanent.scoreX2) pu_state.scoreX2--;

        // Auto-fire
        if ((pu_state.rapid > 0 || pu_permanent.rapid) && !gameOver && waveTransition <= 0) { autoFireTimer++; if (autoFireTimer % 5 === 0) shootBullet(); } else autoFireTimer = 0;

        if (waveTransition > 0) { waveTransition--; draw(); invadersRaf = requestAnimationFrame(tick); return; }
        if (gameOver) { draw(); return; }

        // Keyboard
        if (window._keys && window._keys['ArrowLeft']) playerX = Math.max(10, playerX - 5);
        if (window._keys && window._keys['ArrowRight']) playerX = Math.min(W - 30, playerX + 5);
        if (window._keys && window._keys[' ']) { shootBullet(); delete window._keys[' ']; }

        // Bullets
        bullets = bullets.filter(function(b) { b.y -= 9; if (b.vx) b.x += b.vx; return b.y > 0 && b.x > 0 && b.x < W; });

        // Enemy bullets
        var playerHitY = H - 40;
        enemyBullets = enemyBullets.filter(function(b) {
            b.y += 2 + wave * 0.1;
            if (b.tx !== undefined) b.x += (b.tx - b.x) * 0.008;
            if (b.y > playerHitY && b.y < playerHitY + 25 && b.x > playerX && b.x < playerX + 20) {
                if (pu_state.shield) { pu_state.shield = false; addFloat(playerX + 10, H - 60, 'SHIELD BREAK', '#0ff'); SoundManager.playBloop(250, 0.05); }
                else { gameOver = true; createExplosion(playerX + 10, H - 35, '#0ff', true); SoundManager.playBloop(100, 0.2); }
            }
            return b.y < H;
        });

        // Move enemies
        var speed = 0.5 + wave * 0.13, edge = false;
        enemies.forEach(function(e) {
            if (!e.alive) return;
            if (e.entering) { if (e.enterDelay > 0) { e.enterDelay--; return; } e.x += (e.targetX - e.x) * 0.07; e.y += (e.targetY - e.y) * 0.07; if (Math.abs(e.x - e.targetX) < 1 && Math.abs(e.y - e.targetY) < 1) { e.x = e.targetX; e.y = e.targetY; e.entering = false; } return; }
            if (e.kind === 'diver') { if (e.diveState === 0) { e.x += moveDir * speed; if (Math.random() < 0.004 + wave * 0.001) e.diveState = 1; } else if (e.diveState === 1) { e.y += 4; e.x += (playerX - e.x) * 0.025; if (e.y >= H - 80) e.diveState = 2; } else { e.y -= 3; if (e.y < 60) { e.diveState = 0; e.y = 50; } } }
            else if (e.kind === 'boss' || e.kind === 'miniboss') { e.x = W / 2 - 20 + Math.sin(tick_count * 0.012) * (W / 3); e.y = 30 + Math.sin(tick_count * 0.008) * 20; }
            else { e.x += moveDir * speed; if (wave >= 3) e.x += Math.sin(tick_count * 0.02 + e.y * 0.06) * 0.5; }
            if (e.x > W - 30 || e.x < 10) edge = true;
            if (e.y > H - 60 && e.kind !== 'diver') gameOver = true;
        });
        if (edge) { moveDir *= -1; enemies.forEach(function(e) { if (e.kind !== 'boss' && e.kind !== 'miniboss' && e.kind !== 'diver' && !e.entering) e.y += 6 + Math.min(wave, 8); }); }

        // Enemy firing
        enemyBulletTimer++;
        var fireRate = wave === 1 ? 180 : wave === 2 ? 120 : wave === 3 ? 90 : wave === 4 ? 70 : Math.max(30, 60 - wave * 2);
        if (enemyBulletTimer > fireRate) {
            var living = enemies.filter(function(e) { return e.alive && !e.entering; });
            if (living.length > 0) {
                var s = living[Math.floor(Math.random() * living.length)];
                if (s.kind === 'boss') { for (var i = -1; i <= 1; i++) enemyBullets.push({ x: s.x + 20 + i * 15, y: s.y + 20, tx: playerX + i * 40 }); }
                else if (s.kind === 'miniboss') { enemyBullets.push({ x: s.x + 9, y: s.y + 16 }); if (wave >= 6) enemyBullets.push({ x: s.x + 9, y: s.y + 16, tx: playerX }); }
                else { enemyBullets.push({ x: s.x + 9, y: s.y + 16 }); }
            }
            enemyBulletTimer = 0;
        }

        // Collisions
        bullets.forEach(function(b, bi) {
            enemies.forEach(function(e) {
                if (!e.alive) return;
                var hw = (e.kind === 'boss') ? 40 : (e.kind === 'miniboss') ? 28 : 18;
                if (b.x > e.x - 2 && b.x < e.x + hw && b.y > e.y && b.y < e.y + 18) {
                    e.hp--; bullets.splice(bi, 1);
                    if (e.hp <= 0) {
                        e.alive = false;
                        var pts = e.kind === 'boss' ? 500 : e.kind === 'miniboss' ? 100 : e.kind === 'shield' ? 30 : e.kind === 'splitter' ? 15 : e.kind === 'diver' ? 20 : 10 * (e.type + 1);
                        if (pu_state.scoreX2 > 0 || pu_permanent.scoreX2) pts *= 2;
                        score += pts;
                        addFloat(e.x + 9, e.y, '+' + pts, SPRITES[e.type % 4].color);
                        createExplosion(e.x + 9, e.y + 8, SPRITES[e.type % 4].color, e.kind === 'boss' || e.kind === 'miniboss');
                        SoundManager.playBloop(600 + Math.random() * 200, 0.05);
                        maybeDropPowerup(e.x + 9, e.y + 8);
                        if (e.kind === 'splitter') { enemies.push(makeEnemy(e.x - 15, e.y, e.type, 1)); enemies.push(makeEnemy(e.x + 15, e.y, e.type, 1)); }
                    } else { createExplosion(b.x, b.y, '#fff', false); SoundManager.playBloop(300, 0.03); }
                }
            });
        });

        // Power-up collection
        powerups = powerups.filter(function(pu) {
            pu.y += pu.vy;
            if (pu.y > H - 50 && pu.y < H - 20 && pu.x > playerX - 8 && pu.x < playerX + 28) {
                pu.type.apply(); addFloat(playerX + 10, H - 60, pu.type.name, pu.type.color);
                SoundManager.playBloop(800, 0.08); return false;
            }
            return pu.y < H;
        });

        particles = particles.filter(function(p) { p.x += p.vx; p.y += p.vy; p.life -= 0.025; return p.life > 0; });
        floats = floats.filter(function(f) { f.y -= 1.2; f.life -= 0.016; return f.life > 0; });

        if (enemies.every(function(e) { return !e.alive; })) { nextWave(); SoundManager.playBloop(800, 0.1); }

        draw();
        invadersRaf = requestAnimationFrame(tick);
    }

    // ── DRAW ──
    function draw() {
        ctx.save(); ctx.translate(shakeX, shakeY);
        var pal = PALETTES[(wave - 1) % PALETTES.length];
        ctx.fillStyle = pal.bg; ctx.fillRect(-5, -5, W + 10, H + 10);

        // Stars
        stars.forEach(function(s) { s.y += s.sp; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } ctx.fillStyle = 'rgba(' + pal.star + ',' + (0.12 + s.s * 0.2) + ')'; ctx.fillRect(s.x, s.y, s.s, s.s); });

        // Scan lines
        ctx.fillStyle = 'rgba(0,0,0,0.04)'; for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

        // Defense line
        ctx.strokeStyle = 'rgba(' + pal.accent + ',0.1)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(0, H - 45); ctx.lineTo(W, H - 45); ctx.stroke(); ctx.setLineDash([]);

        // Player
        if (!gameOver) {
            if (pu_state.shield) { ctx.strokeStyle = 'rgba(0,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(playerX + 10, H - 30, 18, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
            ctx.fillStyle = '#0ff'; ctx.shadowColor = 'rgba(0,255,255,0.6)'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.moveTo(playerX + 10, H - 45); ctx.lineTo(playerX + 22, H - 22); ctx.lineTo(playerX + 17, H - 25); ctx.lineTo(playerX + 17, H - 18); ctx.lineTo(playerX + 3, H - 18); ctx.lineTo(playerX + 3, H - 25); ctx.lineTo(playerX - 2, H - 22); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,255,255,' + (0.3 + Math.random() * 0.3) + ')'; ctx.fillRect(playerX + 5, H - 18, 10, 2 + Math.random() * 4);
        }

        // Enemies
        enemies.forEach(function(e) {
            if (!e.alive) return;
            var sz = (e.kind === 'boss') ? 4 : (e.kind === 'miniboss') ? 3 : 2;
            if (e.hp > 1) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.08 + (e.hp / e.maxHp) * 0.15) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x + (sz * 9) / 2, e.y + (sz * 8) / 2, sz * 6, 0, Math.PI * 2); ctx.stroke(); }
            if ((e.kind === 'boss' || e.kind === 'miniboss') && e.hp > 0) { var bw = sz * 9; ctx.fillStyle = '#222'; ctx.fillRect(e.x, e.y - 6, bw, 3); ctx.fillStyle = e.kind === 'boss' ? '#f44' : '#fa0'; ctx.fillRect(e.x, e.y - 6, bw * (e.hp / e.maxHp), 3); }
            if (e.kind === 'diver' && e.diveState === 1) { ctx.fillStyle = 'rgba(255,170,0,0.12)'; ctx.fillRect(e.x + 4, e.y - 10, 10, 10); }
            drawAlien(e.x, e.y, e.type, sz);
        });

        // Bullets
        ctx.shadowColor = 'rgba(0,255,255,0.7)'; ctx.shadowBlur = 5;
        bullets.forEach(function(b) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, 2, 10); ctx.fillStyle = 'rgba(0,255,255,0.3)'; ctx.fillRect(b.x - 1, b.y, 4, 10); });
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'rgba(255,68,68,0.5)'; ctx.shadowBlur = 4; ctx.fillStyle = '#f66';
        enemyBullets.forEach(function(b) { ctx.fillRect(b.x, b.y, 3, 7); }); ctx.shadowBlur = 0;

        // Power-ups
        powerups.forEach(function(pu) {
            var glow = pu.type.color; ctx.fillStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(pu.x, pu.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(pu.type.label, pu.x, pu.y + 4); ctx.textAlign = 'left';
        });

        // Particles + floats
        particles.forEach(function(p) { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, p.sz, p.sz); }); ctx.globalAlpha = 1;
        floats.forEach(function(f) { ctx.globalAlpha = f.life; ctx.fillStyle = f.color; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1; ctx.textAlign = 'left';

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 28);
        ctx.fillStyle = '#0ff'; ctx.font = 'bold 11px monospace'; ctx.fillText('WAVE ' + wave, 12, 18);
        ctx.fillStyle = '#555'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.fillText(enemies.filter(function(e) { return e.alive; }).length + ' left', W / 2, 18); ctx.textAlign = 'left';
        ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = 'bold 11px monospace'; ctx.fillText('SCORE ' + score, W - 12, 18); ctx.textAlign = 'left';

        // Power-up bars
        var by = 36;
        function drawPuBar(name, timer, max, color, perm) {
            ctx.fillStyle = perm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)';
            ctx.fillRect(8, by, 100, 10);
            ctx.fillStyle = color;
            ctx.fillRect(8, by, perm ? 100 : (timer / max) * 100, 10);
            ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
            ctx.fillText(perm ? name + ' [PERM]' : name + ' ' + Math.ceil(timer / 60) + 's', 12, by + 8);
            by += 14;
        }
        if (pu_state.rapid > 0 || pu_permanent.rapid) drawPuBar('RAPID', pu_state.rapid, 1200, '#f44', pu_permanent.rapid);
        if (pu_state.spread > 0 || pu_permanent.spread) drawPuBar('SPREAD', pu_state.spread, 1500, '#ff0', pu_permanent.spread);
        if (pu_state.scoreX2 > 0 || pu_permanent.scoreX2) drawPuBar('x2 SCORE', pu_state.scoreX2, 1500, '#0f0', pu_permanent.scoreX2);
        if (pu_state.shield) { ctx.fillStyle = '#0ff'; ctx.font = '8px monospace'; ctx.fillText('SHIELD ACTIVE', 12, by + 8); by += 14; }

        // Wave transition
        if (waveTransition > 0) {
            var alpha = waveTransition > 80 ? (120 - waveTransition) / 40 : waveTransition / 80;
            ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.7) + ')'; ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center'; ctx.globalAlpha = alpha;
            if (wave % 9 === 0) { ctx.fillStyle = '#f44'; ctx.shadowColor = 'rgba(255,68,68,0.6)'; ctx.shadowBlur = 16; ctx.font = 'bold 14px monospace'; ctx.fillText('WARNING', W / 2, H / 2 - 30); ctx.font = 'bold 26px monospace'; ctx.fillText('BOSS INCOMING', W / 2, H / 2 + 5); }
            else if (wave % 3 === 0) { ctx.fillStyle = '#fa0'; ctx.shadowColor = 'rgba(255,170,0,0.5)'; ctx.shadowBlur = 12; ctx.font = 'bold 24px monospace'; ctx.fillText('WAVE ' + wave, W / 2, H / 2 - 8); ctx.shadowBlur = 0; ctx.fillStyle = '#888'; ctx.font = '12px monospace'; ctx.fillText('MINI-BOSS', W / 2, H / 2 + 16); }
            else { ctx.fillStyle = '#0ff'; ctx.shadowColor = 'rgba(0,255,255,0.5)'; ctx.shadowBlur = 12; ctx.font = 'bold 26px monospace'; ctx.fillText('WAVE ' + wave, W / 2, H / 2 - 8); ctx.shadowBlur = 0; }
            ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.shadowBlur = 0;
        }

        // Game over
        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f44'; ctx.shadowColor = 'rgba(255,68,68,0.5)'; ctx.shadowBlur = 14; ctx.font = 'bold 24px monospace'; ctx.fillText('NEXUS BREACHED', W / 2, H / 2 - 30); ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText('Score: ' + score, W / 2, H / 2);
            ctx.fillStyle = '#888'; ctx.font = '11px monospace'; ctx.fillText('Wave ' + wave + ' reached', W / 2, H / 2 + 22);
            ctx.fillStyle = '#0ff'; ctx.font = '12px monospace'; ctx.fillText('CLICK TO RETRY', W / 2, H / 2 + 54);
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
    // Restore terminal
    var host = document.getElementById('invaders-host');
    if (host) host.remove();
    var output = document.getElementById('output');
    var inputWrap = document.querySelector('.terminal-input-wrapper');
    var tipBar = document.querySelector('.tip-bar, .nexus-tip');
    if (output) output.style.display = '';
    if (inputWrap) inputWrap.style.display = '';
    if (tipBar) tipBar.style.display = '';
}
