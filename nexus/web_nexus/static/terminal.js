// ── Boot Sequence ─────────────────────────────────────────────────────────────
// Shows once per browser session (sessionStorage). On subsequent page loads
// within the same session it shows a brief one-liner instead.
// Auto-fades after 45s of no activity, or instantly when the user first types.

const BOOT_KEY = 'nexus-session-v1';

const BOOT_MSGS = [
    { tag: 'BOOT',  text: 'Initializing quantum uplink...'  },
    { tag: 'SCAN',  text: 'Probing neural pathways...'      },
    { tag: 'SYNC',  text: 'Handshaking with mainframe...'   },
    { tag: 'CRYPT', text: 'Securing encrypted channel...'   },
    { tag: 'AUTH',  text: 'Verifying node credentials...'   },
    { tag: 'ALLOC', text: 'Allocating memory buffers...'    },
    { tag: 'EXEC',  text: 'Spawning AI core process...'     },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runBoot() {
    const section = document.createElement('div');
    section.id = 'boot-section';
    // Insert before any other output
    const out = document.getElementById('terminal-output');
    out.appendChild(section);

    if (sessionStorage.getItem(BOOT_KEY)) {
        // Quick reconnect line — no full animation
        const p = document.createElement('p');
        p.className = 'boot-line';
        p.innerHTML = `<span class="boot-ok">✓</span> NEXUS uplink restored.`;
        section.appendChild(p);
        scheduleIdleFade(section);
        return;
    }

    sessionStorage.setItem(BOOT_KEY, '1');

    // Animated typewriter for each message
    for (const { tag, text } of BOOT_MSGS) {
        const p = document.createElement('p');
        p.className = 'boot-line';

        const tagEl = document.createElement('span');
        tagEl.className = 'boot-tag';
        tagEl.textContent = `[${tag}]`;
        p.appendChild(tagEl);
        p.appendChild(document.createTextNode(' '));

        const msgEl = document.createElement('span');
        msgEl.className = 'boot-msg';
        p.appendChild(msgEl);

        section.appendChild(p);
        out.scrollTop = out.scrollHeight;

        for (const ch of text) {
            msgEl.textContent += ch;
            await sleep(20);
        }
        await sleep(90);
    }

    // Progress bar
    const barLine = document.createElement('p');
    barLine.className = 'boot-line';
    barLine.innerHTML = `<span class="boot-msg">Loading  </span><span class="boot-bar-wrap"><span class="boot-bar" id="bbar"></span></span>`;
    section.appendChild(barLine);
    out.scrollTop = out.scrollHeight;

    const bar = document.getElementById('bbar');
    for (let i = 0; i <= 100; i += 3) {
        bar.style.width = `${i}%`;
        await sleep(16);
    }
    await sleep(120);

    // Ready banner
    const ready = document.createElement('p');
    ready.className = 'boot-ready';
    ready.textContent = '◈  NEXUS ONLINE — SYSTEM READY';
    section.appendChild(ready);
    out.scrollTop = out.scrollHeight;

    scheduleIdleFade(section);
}

let idleTimer = null;

function scheduleIdleFade(section) {
    const IDLE_MS = 45_000;

    const reset = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => fadeBoot(section), IDLE_MS);
    };

    // Fade immediately on first real command
    const inp = document.getElementById('terminal-input');
    inp.addEventListener('keydown', function onFirstCmd(e) {
        if (e.key === 'Enter' && inp.value.trim()) {
            clearTimeout(idleTimer);
            fadeBoot(section);
            inp.removeEventListener('keydown', onFirstCmd);
        }
    });

    // Reset timer on any activity
    inp.addEventListener('keydown', reset);
    document.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', reset));

    reset();
}

function fadeBoot(el) {
    if (!el || !el.isConnected) return;
    el.style.transition = 'opacity 1.4s ease';
    el.style.opacity    = '0';
    setTimeout(() => el.remove(), 1400);
}

// ── WebSocket Setup ───────────────────────────────────────────────────────────
const statsWs = new WebSocket(`ws://${location.host}/ws/stats`);
const termWs  = new WebSocket(`ws://${location.host}/ws/terminal`);

const cpuStat = document.getElementById('cpu-stat');
const memStat = document.getElementById('mem-stat');
const batStat = document.getElementById('bat-stat');
const output  = document.getElementById('terminal-output');
const input   = document.getElementById('terminal-input');

statsWs.onmessage = (e) => {
    const d = JSON.parse(e.data);
    cpuStat.textContent = d.cpu.toFixed(1);
    memStat.textContent = d.mem.toFixed(1);
    batStat.textContent = d.battery;
};

termWs.onmessage = (e) => {
    const clean = handleTriggers(e.data);
    if (clean.trim()) printToTerminal(clean);
};

termWs.onclose = () => printToTerminal('[connection lost — reload to reconnect]', 'sys-msg');

// ── Terminal Output ───────────────────────────────────────────────────────────
// Detects [ERROR], [WARN], [EVIL] prefixes and applies matching CSS class.
const MSG_TAGS = {
    '[ERROR]': 'msg-error',
    '[EVIL]':  'msg-error',
    '[WARN]':  'msg-warn',
    '[OK]':    'msg-ok',
    '[INFO]':  'msg-info',
};

function printToTerminal(text, cls = 'sys-msg') {
    // Check for a known styled prefix on the first line
    for (const [tag, tagCls] of Object.entries(MSG_TAGS)) {
        if (text.trimStart().startsWith(tag)) {
            cls = tagCls;
            break;
        }
    }

    const p = document.createElement('p');
    p.className = cls;
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

// ── Input Handler ─────────────────────────────────────────────────────────────
const chatHistory = [];

input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const cmd = input.value.trim();
    if (!cmd) return;

    if (cmd.toLowerCase() === 'clear') {
        output.innerHTML = '';
    } else {
        printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
        chatHistory.push({ role: 'user', content: cmd });
        termWs.send(JSON.stringify({ command: cmd.toLowerCase(), history: chatHistory.slice(-10) }));
    }
    input.value = '';
});

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd === 'clear') {
            output.innerHTML = '';
        } else {
            printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
            termWs.send(JSON.stringify({ command: cmd.toLowerCase(), history: [] }));
            input.focus();
        }
    });
});

document.querySelector('.terminal-container').addEventListener('click', () => input.focus());

// ── Geo-IP ────────────────────────────────────────────────────────────────────
fetch('https://ipapi.co/json/')
    .then(r => r.json())
    .then(d => {
        document.querySelector('.geo-stat').textContent =
            `LOC: ${d.city || 'Unknown'}, ${d.country || 'World'}`;
    }).catch(() => {
        document.querySelector('.geo-stat').textContent = 'LOC: Unknown';
    });

// ── Trigger Handler ───────────────────────────────────────────────────────────
// The backend embeds [TRIGGER:name] tags in responses. We strip them out and
// act on them so they never appear as raw text in the terminal.
function handleTriggers(text) {
    const re = /\[TRIGGER:(\w+)\]/g;
    let match;
    let clean = text;

    while ((match = re.exec(text)) !== null) {
        clean = clean.replace(match[0], '').trim();
        switch (match[1].toLowerCase()) {
            case 'pong':          openGame('pong');    break;
            case 'breach':        openGame('breach');  break;
            case 'wordle':        openGame('wordle');  break;
            case 'monitor':       openGame('monitor'); break;
            case 'clear':         output.innerHTML = ''; break;
            case 'accessibility': toggleA11yPanel();  break;
        }
    }

    return clean;
}

// ══════════════════════════════════════════════════════════════════════════════
// GAME SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
const gameOverlay = document.getElementById('game-overlay');
const gameTitle   = document.getElementById('game-title');
const gameContent = document.getElementById('game-content');
const gameClose   = document.getElementById('game-close');
const gameRestart = document.getElementById('game-restart');

let currentGame  = null;
let gameCleanup  = null;   // called when the current game is torn down

gameClose.addEventListener('click', closeGame);
gameRestart.addEventListener('click', () => { if (currentGame) openGame(currentGame); });

// Escape closes the game
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !gameOverlay.classList.contains('hidden')) closeGame();
});

function openGame(name) {
    // Tear down whatever was running before
    if (gameCleanup) { gameCleanup(); gameCleanup = null; }

    currentGame = name;
    gameContent.innerHTML = '';
    gameOverlay.classList.remove('hidden');

    switch (name) {
        case 'pong':    gameTitle.textContent = 'PONG';           initPong();    break;
        case 'breach':  gameTitle.textContent = 'BREACH PROTOCOL'; initBreach(); break;
        case 'wordle':  gameTitle.textContent = 'WORDLE';          initWordle(); break;
        case 'monitor': gameTitle.textContent = 'SYSTEM MONITOR';  initMonitor();break;
    }
}

function closeGame() {
    if (gameCleanup) { gameCleanup(); gameCleanup = null; }
    gameOverlay.classList.add('hidden');
    gameContent.innerHTML = '';
    currentGame = null;
    input.focus();
}

// ══════════════════════════════════════════════════════════════════════════════
// PONG
// ══════════════════════════════════════════════════════════════════════════════
function initPong() {
    const W = 520, H = 340;
    const PAD_W = 10, PAD_H = 72, BALL_R = 8;
    const WIN_SCORE = 5;

    gameContent.innerHTML = `
        <div class="game-score"><span id="p-score">0</span> : <span id="ai-score">0</span></div>
        <canvas id="pong-canvas" width="${W}" height="${H}"></canvas>
        <div class="game-msg">Mouse or ↑↓ to move · First to ${WIN_SCORE} wins · ↺ to restart</div>
    `;

    const canvas = document.getElementById('pong-canvas');
    const ctx    = canvas.getContext('2d');

    let playerY = H / 2 - PAD_H / 2;
    let aiY     = H / 2 - PAD_H / 2;
    let bx = W / 2, by = H / 2;
    let dx = 4.5 * (Math.random() > 0.5 ? 1 : -1);
    let dy = 3   * (Math.random() > 0.5 ? 1 : -1);
    let pScore = 0, aiScore = 0;
    let paused = true, winner = null;
    let running = true;
    let animId;

    // Input
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        playerY = e.clientY - rect.top - PAD_H / 2;
        playerY = Math.max(0, Math.min(H - PAD_H, playerY));
    });

    // Player must click to serve — never auto-starts
    canvas.addEventListener('click', () => {
        if (paused && !winner) paused = false;
    });

    const keys = {};
    const onKey = (e) => {
        if (gameOverlay.classList.contains('hidden')) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
        keys[e.key] = (e.type === 'keydown');
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup',   onKey);

    function resetBall() {
        bx = W / 2; by = H / 2;
        dx = 4.5 * (Math.random() > 0.5 ? 1 : -1);
        dy = 3   * (Math.random() > 0.5 ? 1 : -1);
        paused = true;
        // No auto-resume — player clicks canvas to serve
    }

    function update() {
        if (paused || winner || !running) return;

        if (keys['ArrowUp'])   playerY = Math.max(0,           playerY - 6);
        if (keys['ArrowDown']) playerY = Math.min(H - PAD_H,   playerY + 6);

        // AI tracks ball with slight delay
        const aiMid = aiY + PAD_H / 2;
        const spd   = 3.8;
        if (aiMid < by - 5) aiY = Math.min(H - PAD_H, aiY + spd);
        else if (aiMid > by + 5) aiY = Math.max(0,    aiY - spd);

        bx += dx; by += dy;

        // Top / bottom bounce
        if (by - BALL_R <= 0)  dy =  Math.abs(dy);
        if (by + BALL_R >= H)  dy = -Math.abs(dy);

        // Player paddle (left side: x 20–30)
        if (bx - BALL_R <= 30 && bx - BALL_R >= 18 && by >= playerY && by <= playerY + PAD_H) {
            dx = Math.abs(dx) * 1.05;
            dy = ((by - playerY) / PAD_H - 0.5) * 9;
        }

        // AI paddle (right side)
        if (bx + BALL_R >= W - 30 && bx + BALL_R <= W - 18 && by >= aiY && by <= aiY + PAD_H) {
            dx = -Math.abs(dx) * 1.05;
            dy = ((by - aiY) / PAD_H - 0.5) * 9;
        }

        // Speed cap
        dx = Math.max(-10, Math.min(10, dx));
        dy = Math.max(-9,  Math.min(9,  dy));

        // Scoring
        if (bx < 0) {
            aiScore++;
            document.getElementById('ai-score').textContent = aiScore;
            if (aiScore >= WIN_SCORE) { winner = 'ai'; return; }
            resetBall();
        }
        if (bx > W) {
            pScore++;
            document.getElementById('p-score').textContent = pScore;
            if (pScore >= WIN_SCORE) { winner = 'player'; return; }
            resetBall();
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // Centre dashes
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.setLineDash([]);

        const glow = (color) => { ctx.shadowColor = color; ctx.shadowBlur = 12; };
        const noGlow = () => { ctx.shadowBlur = 0; };

        // Player paddle
        glow('#0ff'); ctx.fillStyle = '#0ff';
        ctx.fillRect(20, playerY, PAD_W, PAD_H);

        // AI paddle
        glow('#f0f'); ctx.fillStyle = '#f0f';
        ctx.fillRect(W - 30, aiY, PAD_W, PAD_H);

        // Ball
        glow('#fff'); ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2); ctx.fill();
        noGlow();

        // Pause / serve screen — shown between points and on first launch
        if (paused && !winner) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#0ff';
            ctx.font = 'bold 20px Fira Code, monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#0ff'; ctx.shadowBlur = 12;
            ctx.fillText('CLICK TO SERVE', W / 2, H / 2 - 8);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#444';
            ctx.font = '12px Fira Code, monospace';
            ctx.fillText('or use ↑ ↓ to move', W / 2, H / 2 + 16);
        }

        // Game-over / winner screen — loop stops after this frame
        if (winner) {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = winner === 'player' ? '#0ff' : '#f0f';
            ctx.font = 'bold 30px Fira Code, monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
            ctx.fillText(winner === 'player' ? 'YOU WIN!' : 'AI WINS', W / 2, H / 2 - 14);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#555';
            ctx.font = '13px Fira Code, monospace';
            ctx.fillText('Press  ↺  to play again', W / 2, H / 2 + 18);
        }
    }

    function loop() {
        if (!running) return;
        update(); draw();
        // Stop scheduling new frames once a winner is declared
        if (!winner) animId = requestAnimationFrame(loop);
    }

    gameCleanup = () => {
        running = false;
        cancelAnimationFrame(animId);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup',   onKey);
    };

    resetBall(); // sets paused = true, shows CLICK TO SERVE on first frame
    loop();
}

// ══════════════════════════════════════════════════════════════════════════════
// BREACH PROTOCOL
// ══════════════════════════════════════════════════════════════════════════════
function initBreach() {
    const GRID  = 5;
    const BUF   = 6;
    const SECS  = 30;
    const POOL  = ['1C', 'E9', '55', 'BD', '7A', 'FF', '2B', 'CC', '44', 'A8'];
    const NAMES = ['DATAMINE_V1', 'DATAMINE_V2', 'CRASH_SYS'];

    const grid    = Array.from({ length: GRID }, () =>
        Array.from({ length: GRID }, () => POOL[Math.floor(Math.random() * POOL.length)]));

    const targets = [pickSeq(2), pickSeq(3), pickSeq(2)];

    function pickSeq(len) {
        return Array.from({ length: len }, () => POOL[Math.floor(Math.random() * POOL.length)]);
    }

    let buffer   = [];
    let mode     = 'row';   // alternates: row → col → row …
    let activeR  = 0;
    let activeC  = 0;
    let used     = new Set();
    let timeLeft = SECS;
    let dead     = false;
    let timer;

    // ── Build DOM
    const targetsHTML = targets.map((t, i) => `
        <div class="breach-target">
            <span class="breach-target-label">${NAMES[i]}</span>
            ${t.map((c, j) => `<span class="breach-code" id="bc-${i}-${j}">${c}</span>`).join('')}
        </div>`).join('');

    let gridHTML = `<div class="breach-grid" style="grid-template-columns:repeat(${GRID},1fr)">`;
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            gridHTML += `<div class="breach-cell" data-r="${r}" data-c="${c}" id="bc${r}-${c}">${grid[r][c]}</div>`;
    gridHTML += '</div>';

    const bufHTML = `<div class="breach-buffer">
        <span class="breach-buffer-label">Buffer</span>
        ${Array.from({ length: BUF }, (_, i) => `<div class="breach-buf-cell" id="bb-${i}"></div>`).join('')}
    </div>`;

    gameContent.innerHTML = `
        <div class="breach-wrap">
            <div class="breach-timer" id="btimer">${SECS}s</div>
            <div class="breach-targets">${targetsHTML}</div>
            <div class="breach-grid-label">Select in sequence — row then column alternating</div>
            ${gridHTML}
            ${bufHTML}
            <div class="breach-status" id="bstatus">Select a code from the highlighted row</div>
        </div>`;

    document.querySelectorAll('.breach-cell').forEach(el => el.addEventListener('click', onCell));
    highlight();

    timer = setInterval(() => {
        timeLeft--;
        const el = document.getElementById('btimer');
        if (el) { el.textContent = `${timeLeft}s`; if (timeLeft <= 10) el.classList.add('danger'); }
        if (timeLeft <= 0) end(false, 'TIME OUT');
    }, 1000);

    gameCleanup = () => clearInterval(timer);

    // ── Helpers
    function highlight() {
        document.querySelectorAll('.breach-cell').forEach(c => c.classList.remove('hi-row', 'hi-col'));
        if (dead) return;
        if (mode === 'row')
            for (let c = 0; c < GRID; c++) cell(activeR, c)?.classList.add('hi-row');
        else
            for (let r = 0; r < GRID; r++) cell(r, activeC)?.classList.add('hi-col');
    }

    function cell(r, c) { return document.getElementById(`bc${r}-${c}`); }

    function onCell(e) {
        if (dead) return;
        const r = +e.target.dataset.r, c = +e.target.dataset.c;
        if (used.has(`${r},${c}`)) return;
        if (mode === 'row' && r !== activeR) return;
        if (mode === 'col' && c !== activeC) return;

        const code = grid[r][c];
        buffer.push(code);
        const idx = buffer.length - 1;
        if (idx < BUF) {
            const bb = document.getElementById(`bb-${idx}`);
            if (bb) { bb.textContent = code; bb.classList.add('filled'); }
        }

        used.add(`${r},${c}`);
        e.target.classList.add('used');

        if (mode === 'row') { mode = 'col'; activeC = c; }
        else                { mode = 'row'; activeR = r; }

        evalTargets();
        if (!dead) {
            if (buffer.length >= BUF) { end(false, 'Buffer full'); return; }
            highlight();
        }
    }

    function evalTargets() {
        const bufStr = buffer.join(',');
        let allDone = true;

        targets.forEach((tgt, ti) => {
            const tStr = tgt.join(',');
            const done = bufStr.includes(tStr);
            if (!done) allDone = false;

            tgt.forEach((code, ci) => {
                const el = document.getElementById(`bc-${ti}-${ci}`);
                if (!el) return;
                el.classList.remove('matched', 'partial');
                if (done) {
                    el.classList.add('matched');
                } else {
                    // Check if the end of the buffer partially matches the start of target
                    for (let k = 1; k <= Math.min(ci + 1, buffer.length); k++) {
                        const partial = buffer.slice(-k).join(',');
                        const targetStart = tgt.slice(0, k).join(',');
                        if (partial === targetStart && k === ci + 1) {
                            el.classList.add('partial');
                        }
                    }
                }
            });
        });

        if (allDone) end(true, 'ACCESS GRANTED');
    }

    function end(success, msg) {
        dead = true;
        clearInterval(timer);
        highlight(); // clears highlights
        const st = document.getElementById('bstatus');
        if (st) { st.textContent = msg; st.style.color = success ? '#4c4' : '#f55'; st.style.fontWeight = '700'; }
        const tm = document.getElementById('btimer');
        if (tm) tm.style.color = success ? '#4c4' : '#f55';
        printToTerminal(success ? '[BREACH] ACCESS GRANTED — system compromised.' : `[BREACH] ${msg} — breach failed.`);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// WORDLE
// ══════════════════════════════════════════════════════════════════════════════
function initWordle() {
    const WORDS = [
        'NEXUS','BYTES','PIXEL','CYBER','PATCH','QUERY','STACK','HEIST','PROXY',
        'DRONE','LASER','GHOST','VAULT','FORGE','BLAZE','CRISP','FLAME','GLARE',
        'PRIME','RAPID','SHARP','TRACK','ULTRA','VIVID','SWIFT','STONE','SPARK',
        'SCOUT','BRACE','CRASH','FLARE','GRIND','BLEND','BRAVE','CLEAR','DRIFT',
        'ELITE','FLINT','GRAND','HELIX','IONIC','JOUST','KNEEL','LUSTY','MAGIC',
        'NOBLE','ORBIT','PLANK','QUOTA','RAVEN','SIGMA','TANGO','UMBRA','VAPOR',
        'BRAKE','CLOUD','DEPTH','EMBER','FUSED','GROVE','HYPER','INPUT','JOINT',
        'KARMA','LATCH','MIXED','NIGHT','OXIDE','PHASE','QUIET','REALM','SHADE',
        'TOXIC','UNION','VIRGO','WATCH','XENON','YIELD','ZEALOT'[0]+'EALO'.slice(1),'ARMOR'
    ].filter(w => w.length === 5);

    const answer  = WORDS[Math.floor(Math.random() * WORDS.length)];
    const ROWS = 6, COLS = 5;

    let curRow = 0, curCol = 0;
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    let over = false;

    const KB = [
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L'],
        ['ENTER','Z','X','C','V','B','N','M','⌫']
    ];

    // Build grid
    let gridH = '<div class="wordle-grid">';
    for (let r = 0; r < ROWS; r++) {
        gridH += '<div class="wordle-row">';
        for (let c = 0; c < COLS; c++) gridH += `<div class="wordle-cell" id="wc-${r}-${c}"></div>`;
        gridH += '</div>';
    }
    gridH += '</div>';

    // Build keyboard
    let kbH = '<div class="wordle-keyboard">';
    KB.forEach(row => {
        kbH += '<div class="wordle-key-row">';
        row.forEach(k => {
            const wide = (k === 'ENTER' || k === '⌫') ? ' wide' : '';
            kbH += `<button class="wordle-key${wide}" data-k="${k}">${k}</button>`;
        });
        kbH += '</div>';
    });
    kbH += '</div>';

    gameContent.innerHTML = `
        <div class="wordle-wrap">
            <div class="wordle-msg" id="wm"></div>
            ${gridH}
            ${kbH}
        </div>`;

    document.querySelectorAll('.wordle-key').forEach(b => b.addEventListener('click', () => key(b.dataset.k)));

    const physKey = (e) => {
        if (gameOverlay.classList.contains('hidden')) return;
        if (e.key === 'Enter')     { e.preventDefault(); key('ENTER'); }
        else if (e.key === 'Backspace') key('⌫');
        else if (/^[a-zA-Z]$/.test(e.key)) key(e.key.toUpperCase());
    };
    document.addEventListener('keydown', physKey);

    gameCleanup = () => document.removeEventListener('keydown', physKey);

    function cellEl(r, c) { return document.getElementById(`wc-${r}-${c}`); }
    function msg(t)        { const el = document.getElementById('wm'); if (el) el.textContent = t; }

    function key(k) {
        if (over) return;
        if (k === '⌫') {
            if (curCol > 0) {
                curCol--;
                board[curRow][curCol] = '';
                const el = cellEl(curRow, curCol);
                el.textContent = '';
                el.className = 'wordle-cell';
            }
        } else if (k === 'ENTER') {
            if (curCol < COLS) { msg('Not enough letters'); return; }
            submit();
        } else if (/^[A-Z]$/.test(k) && curCol < COLS) {
            board[curRow][curCol] = k;
            const el = cellEl(curRow, curCol);
            el.textContent = k;
            el.className = 'wordle-cell active';
            curCol++;
        }
    }

    function submit() {
        const guess  = board[curRow].join('');
        const result = evaluate(guess);

        result.forEach((cls, i) => {
            setTimeout(() => {
                const el = cellEl(curRow, i);
                el.className = `wordle-cell ${cls}`;
                updateKb(guess[i], cls);
            }, i * 130);
        });

        const won = guess === answer;
        const lastRow = curRow === ROWS - 1;

        setTimeout(() => {
            if (won) {
                msg('Cracked! ');
                over = true;
                printToTerminal(`[WORDLE] CRACKED: ${answer}`);
            } else if (lastRow) {
                msg(`Answer: ${answer}`);
                over = true;
                printToTerminal(`[WORDLE] FAILED — word was: ${answer}`);
            } else {
                msg('');
            }
        }, COLS * 130 + 100);

        curRow++;
        curCol = 0;
    }

    function evaluate(guess) {
        const ans  = answer.split('');
        const g    = guess.split('');
        const res  = Array(COLS).fill('absent');
        const used = Array(COLS).fill(false);

        for (let i = 0; i < COLS; i++) {
            if (g[i] === ans[i]) { res[i] = 'correct'; used[i] = true; }
        }
        for (let i = 0; i < COLS; i++) {
            if (res[i] === 'correct') continue;
            for (let j = 0; j < COLS; j++) {
                if (!used[j] && g[i] === ans[j]) { res[i] = 'present'; used[j] = true; break; }
            }
        }
        return res;
    }

    const kbState = {};
    const PRIO = { correct: 3, present: 2, absent: 1 };

    function updateKb(letter, cls) {
        const btn = document.querySelector(`.wordle-key[data-k="${letter}"]`);
        if (!btn) return;
        if (!kbState[letter] || PRIO[cls] > PRIO[kbState[letter]]) {
            kbState[letter] = cls;
            btn.className = `wordle-key ${cls}`;
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM MONITOR GRAPH
// ══════════════════════════════════════════════════════════════════════════════
function initMonitor() {
    const W = 480, H = 220;
    const cpuH = Array(60).fill(0);
    const memH = Array(60).fill(0);
    let running = true;

    gameContent.innerHTML = `
        <canvas id="monitor-canvas" width="${W}" height="${H}"></canvas>
        <div class="game-msg">Live CPU <span style="color:#0ff">■</span> and Memory <span style="color:#f0f">■</span> — past 60 s</div>`;

    const canvas = document.getElementById('monitor-canvas');
    const ctx    = canvas.getContext('2d');

    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = '#111';
        ctx.lineWidth   = 1;
        ctx.setLineDash([3, 4]);
        for (let y = 0; y <= 100; y += 25) {
            const py = H - (y / 100) * H;
            ctx.beginPath(); ctx.moveTo(30, py); ctx.lineTo(W, py); ctx.stroke();
            ctx.fillStyle = '#333';
            ctx.font = '10px monospace';
            ctx.fillText(`${y}%`, 2, py + 4);
        }
        ctx.setLineDash([]);

        function line(data, color) {
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.shadowColor = color; ctx.shadowBlur = 6;
            ctx.beginPath();
            data.forEach((v, i) => {
                const x = 30 + (i / (data.length - 1)) * (W - 30);
                const y = H  - (v / 100) * H;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        line(cpuH, '#0ff');
        line(memH, '#f0f');
    }

    const iv = setInterval(() => {
        if (!running) return;
        cpuH.push(parseFloat(cpuStat.textContent) || 0); cpuH.shift();
        memH.push(parseFloat(memStat.textContent) || 0); memH.shift();
        draw();
    }, 1000);

    draw();
    gameCleanup = () => { running = false; clearInterval(iv); };
}

// ══════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ══════════════════════════════════════════════════════════════════════════════
const a11yPanel = document.getElementById('a11y-panel');
const a11yBtn   = document.getElementById('a11y-btn');

a11yBtn.addEventListener('click', toggleA11yPanel);
document.getElementById('a11y-sidebar-btn').addEventListener('click', toggleA11yPanel);
document.getElementById('a11y-close').addEventListener('click', () => a11yPanel.classList.add('hidden'));

function toggleA11yPanel() {
    a11yPanel.classList.toggle('hidden');
}

// Option group buttons
document.querySelectorAll('.a11y-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        const val   = btn.dataset.value;

        document.querySelectorAll(`.a11y-opt[data-group="${group}"]`).forEach(b => {
            b.classList.remove('active');
            document.body.classList.remove(b.dataset.value);
        });

        btn.classList.add('active');
        document.body.classList.add(val);
        localStorage.setItem(`a11y-${group}`, val);
    });
});

// Reduce-motion toggle
document.getElementById('reduce-motion').addEventListener('change', (e) => {
    document.body.classList.toggle('reduce-motion', e.target.checked);
    localStorage.setItem('a11y-motion', e.target.checked ? '1' : '0');
});

// Restore saved preferences on load
(function restoreA11y() {
    const defaults = { size: 'size-s', font: 'font-mono', theme: 'theme-cyber', spacing: 'space-n' };

    Object.entries(defaults).forEach(([group, def]) => {
        const saved = localStorage.getItem(`a11y-${group}`) || def;

        // Clear all group values from body, then apply saved
        document.querySelectorAll(`.a11y-opt[data-group="${group}"]`).forEach(b => {
            b.classList.remove('active');
            document.body.classList.remove(b.dataset.value);
        });

        const btn = document.querySelector(`.a11y-opt[data-group="${group}"][data-value="${saved}"]`);
        if (btn) { btn.classList.add('active'); document.body.classList.add(saved); }
    });

    const motionOn = localStorage.getItem('a11y-motion') === '1';
    document.getElementById('reduce-motion').checked = motionOn;
    document.body.classList.toggle('reduce-motion', motionOn);
})();

// Kick off boot sequence
runBoot();
