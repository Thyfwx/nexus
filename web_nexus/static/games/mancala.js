// =============================================================
// NEXUS MANCALA  (Kalah variant)
// Board indices:
//   0..5   player pits  (left to right on the player's row)
//   6      player store (right edge)
//   7..12  AI pits      (in sowing order: 7 is closest to player store)
//   13     AI store     (left edge)
// Player and AI both sow counter-clockwise. Each skips the opponent's store.
// =============================================================

let mancalaBoard = null;
let mancalaTurn = 'player';
let mancalaDifficulty = 'medium';
let mancalaInputLocked = false;
let mancalaTimeoutQueue = [];
let mancalaPitGeom = [];
let mancalaCtx = null;
const mancalaW = 760;
const mancalaH = 320;
let mancalaStatusText = '';
let mancalaStatusColor = '#0ff';
let mancalaGameOver = false;
let mancalaHardStreak = 0;
let mancalaCaptureFlash = null;
let mancalaPostCaptureRedraw = null;

const MANCALA_PLAYER_PITS = [0, 1, 2, 3, 4, 5];
const MANCALA_PLAYER_STORE = 6;
const MANCALA_AI_PITS = [7, 8, 9, 10, 11, 12];
const MANCALA_AI_STORE = 13;
const MANCALA_OPP_PIT = (i) => 12 - i;

function startMancala() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiContainer.classList.add('gui-game-wide');
    guiTitle.textContent = 'NEXUS MANCALA';

    let savedStreak = 0;
    try { savedStreak = parseInt(localStorage.getItem('mancala_hard_streak') || '0', 10) || 0; } catch (_) {}

    guiContent.innerHTML = `
        <style>
            .mancala-pick {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 14px;
                margin: 0 auto;
                max-width: 580px;
            }
            .mancala-pick button.man-diff {
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
            .mancala-pick button.man-diff .diff-name {
                font-size: 1rem;
                font-weight: 700;
                letter-spacing: 2.5px;
                line-height: 1;
            }
            .mancala-pick button.man-diff .diff-desc {
                font-size: 0.62rem;
                opacity: 0.65;
                letter-spacing: 1px;
                line-height: 1.3;
            }
            .mancala-pick button.man-diff:hover {
                background: var(--mode-bg-hov) !important;
                box-shadow: 0 0 18px var(--mode-color);
            }
            @media (max-width: 600px) {
                .mancala-pick { grid-template-columns: 1fr; max-width: 280px; }
            }
        </style>
        <div style="text-align:center; padding:24px 12px;">
            <div style="color:#0ff; letter-spacing:4px; font-size:0.85rem; font-weight:700; margin-bottom:6px; text-shadow:0 0 12px #0ff;">SELECT DIFFICULTY</div>
            <div style="color:#666; font-size:0.7rem; margin-bottom:24px; letter-spacing:1px;">Click a pit on your row. Land in your store for an extra turn.</div>
            <div class="mancala-pick">
                <button class="man-diff" data-diff="easy"
                    style="--mode-color:#0f0; --mode-bg:rgba(0,255,0,0.06); --mode-bg-hov:rgba(0,255,0,0.18);">
                    <span class="diff-name">EASY</span>
                    <span class="diff-desc">single-move lookahead</span>
                </button>
                <button class="man-diff" data-diff="medium"
                    style="--mode-color:#ff0; --mode-bg:rgba(255,255,0,0.06); --mode-bg-hov:rgba(255,255,0,0.18);">
                    <span class="diff-name">MEDIUM</span>
                    <span class="diff-desc">plans 4 moves ahead</span>
                </button>
                <button class="man-diff" data-diff="hard"
                    style="--mode-color:#0ff; --mode-bg:rgba(0,255,255,0.06); --mode-bg-hov:rgba(0,255,255,0.18);">
                    <span class="diff-name">HARD</span>
                    <span class="diff-desc">6 deep · streak counted</span>
                </button>
            </div>
            <div style="color:#666; font-size:0.62rem; margin-top:18px; letter-spacing:1.5px;">
                HARD STREAK: <span style="color:#0ff;">${savedStreak}</span>
                <span style="margin:0 10px; color:#333;">|</span>
                LOSE OR DRAW ON HARD AND IT RESETS
            </div>
        </div>`;
    nexusCanvas.style.display = 'none';

    guiContent.querySelectorAll('.man-diff').forEach(btn => {
        btn.addEventListener('click', () => launchMancala(btn.dataset.diff));
    });
}

function launchMancala(difficulty) {
    mancalaDifficulty = difficulty;
    mancalaBoard = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
    mancalaTurn = 'player';
    mancalaInputLocked = false;
    mancalaGameOver = false;
    mancalaCaptureFlash = null;
    mancalaTimeoutQueue.forEach(t => clearTimeout(t));
    mancalaTimeoutQueue = [];

    try {
        mancalaHardStreak = parseInt(localStorage.getItem('mancala_hard_streak') || '0', 10) || 0;
    } catch (_) {
        mancalaHardStreak = 0;
    }

    const accent = difficulty === 'easy' ? '#00ff00' : difficulty === 'medium' ? '#ffff00' : '#00ffff';
    const streakTag = difficulty === 'hard'
        ? `<span style="color:#0ff;">STREAK ${mancalaHardStreak}</span>`
        : `<span style="color:#888;">UNRANKED</span>`;

    guiContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; font-size:0.78rem; margin-bottom:8px; background:rgba(255,255,255,0.02); border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
            <span style="color:#0ff; font-weight:700; letter-spacing:2px;">YOU</span>
            <span style="color:${accent}; font-size:0.7rem; letter-spacing:2px; font-weight:700;">${difficulty.toUpperCase()} &middot; ${streakTag}</span>
            <span style="color:#f88; font-weight:700; letter-spacing:2px;">AI</span>
        </div>`;
    nexusCanvas.style.display = 'block';
    nexusCanvas.style.maxWidth = '100%';
    nexusCanvas.style.height = 'auto';
    nexusCanvas.style.borderRadius = '4px';
    nexusCanvas.style.border = `1px solid ${accent}33`;
    nexusCanvas.style.boxShadow = `0 0 24px ${accent}22`;
    nexusCanvas.width = mancalaW;
    nexusCanvas.height = mancalaH;
    mancalaCtx = nexusCanvas.getContext('2d');

    mancalaBuildGeometry();

    nexusCanvas.onclick = (e) => mancalaHandleClick(e.clientX, e.clientY);
    nexusCanvas.ontouchstart = (e) => {
        if (e.touches && e.touches[0]) {
            e.preventDefault();
            mancalaHandleClick(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    mancalaStatusText = 'YOUR TURN';
    mancalaStatusColor = '#0ff';
    mancalaDrawBoard();
}

function mancalaBuildGeometry() {
    mancalaPitGeom = [];
    const padX = 18;
    const padY = 28;
    const storeW = 70;
    const innerW = mancalaW - padX * 2 - storeW * 2 - 20;
    const pitR = Math.floor((innerW / 6 - 8) / 2);
    const pitCYTop = padY + pitR + 8;
    const pitCYBot = mancalaH - padY - pitR - 8;
    const storeCY = mancalaH / 2;
    const storeH = mancalaH - padY * 2;
    const firstPitCX = padX + storeW + 10 + pitR + 4;
    const pitStep = pitR * 2 + 8;

    // Top row (AI), visually left to right: pits 12, 11, 10, 9, 8, 7
    for (let i = 0; i < 6; i++) {
        const cx = firstPitCX + i * pitStep;
        mancalaPitGeom.push({ idx: 12 - i, cx, cy: pitCYTop, r: pitR, side: 'ai', isStore: false });
    }
    // Bottom row (player), left to right: 0..5
    for (let i = 0; i < 6; i++) {
        const cx = firstPitCX + i * pitStep;
        mancalaPitGeom.push({ idx: i, cx, cy: pitCYBot, r: pitR, side: 'player', isStore: false });
    }
    // Stores
    mancalaPitGeom.push({ idx: MANCALA_AI_STORE, cx: padX + storeW / 2, cy: storeCY, r: pitR, side: 'ai', isStore: true, w: storeW, h: storeH });
    mancalaPitGeom.push({ idx: MANCALA_PLAYER_STORE, cx: mancalaW - padX - storeW / 2, cy: storeCY, r: pitR, side: 'player', isStore: true, w: storeW, h: storeH });
}

function mancalaRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function mancalaDrawBoard() {
    const ctx = mancalaCtx;
    if (!ctx) return;

    ctx.fillStyle = '#080816';
    ctx.fillRect(0, 0, mancalaW, mancalaH);

    ctx.strokeStyle = 'rgba(0,180,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < mancalaW; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mancalaH); ctx.stroke();
    }

    for (const p of mancalaPitGeom) {
        const isPlayer = p.side === 'player';
        const accent = isPlayer ? '#00ffff' : '#ff8888';
        const stones = mancalaBoard[p.idx];
        const isClickable = !mancalaInputLocked && !mancalaGameOver && p.side === 'player' && !p.isStore && stones > 0 && mancalaTurn === 'player';
        const flashing = mancalaCaptureFlash && mancalaCaptureFlash.idx === p.idx && Date.now() < mancalaCaptureFlash.until;

        if (p.isStore) {
            const x = p.cx - p.w / 2;
            const y = p.cy - p.h / 2;
            ctx.fillStyle = `${accent}10`;
            ctx.strokeStyle = `${accent}66`;
            ctx.lineWidth = 1.5;
            mancalaRoundRect(ctx, x, y, p.w, p.h, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = accent;
            ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10;
            ctx.shadowColor = accent;
            ctx.fillText(String(stones), p.cx, p.cy);
            ctx.shadowBlur = 0;

            ctx.fillStyle = `${accent}88`;
            ctx.font = '9px monospace';
            ctx.fillText(isPlayer ? 'YOUR STORE' : 'AI STORE', p.cx, p.cy + p.h / 2 - 12);
        } else {
            ctx.beginPath();
            ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
            ctx.fillStyle = flashing ? `${accent}40` : `${accent}10`;
            ctx.fill();
            ctx.strokeStyle = isClickable ? accent : `${accent}55`;
            ctx.lineWidth = isClickable ? 2 : 1;
            if (isClickable) {
                ctx.shadowBlur = 14;
                ctx.shadowColor = accent;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = accent;
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(stones), p.cx, p.cy);

            if (stones > 0 && stones <= 12) {
                ctx.fillStyle = `${accent}88`;
                for (let i = 0; i < stones; i++) {
                    const angle = (i / stones) * Math.PI * 2;
                    const sx = p.cx + Math.cos(angle) * (p.r * 0.62);
                    const sy = p.cy + Math.sin(angle) * (p.r * 0.62);
                    ctx.beginPath();
                    ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    ctx.fillStyle = mancalaStatusColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 6;
    ctx.shadowColor = mancalaStatusColor;
    ctx.fillText(mancalaStatusText, mancalaW / 2, 12);
    ctx.shadowBlur = 0;

    if (mancalaCaptureFlash && Date.now() < mancalaCaptureFlash.until) {
        clearTimeout(mancalaPostCaptureRedraw);
        mancalaPostCaptureRedraw = setTimeout(() => mancalaDrawBoard(), 80);
        mancalaTimeoutQueue.push(mancalaPostCaptureRedraw);
    }
}

function mancalaHandleClick(clientX, clientY) {
    if (mancalaGameOver) {
        launchMancala(mancalaDifficulty);
        return;
    }
    if (mancalaInputLocked) return;
    if (mancalaTurn !== 'player') return;

    const rect = nexusCanvas.getBoundingClientRect();
    const cx = (clientX - rect.left) * (mancalaW / rect.width);
    const cy = (clientY - rect.top) * (mancalaH / rect.height);

    for (const p of mancalaPitGeom) {
        if (p.side !== 'player' || p.isStore) continue;
        const dx = cx - p.cx;
        const dy = cy - p.cy;
        if (dx * dx + dy * dy < p.r * p.r) {
            if (mancalaBoard[p.idx] > 0) mancalaExecuteSow(p.idx, false);
            return;
        }
    }
}

function mancalaExecuteSow(startIdx, isAI) {
    mancalaInputLocked = true;
    let stones = mancalaBoard[startIdx];
    mancalaBoard[startIdx] = 0;

    let pos = startIdx;
    const skipStore = isAI ? MANCALA_PLAYER_STORE : MANCALA_AI_STORE;
    const ownStore = isAI ? MANCALA_AI_STORE : MANCALA_PLAYER_STORE;
    const ownPits = isAI ? MANCALA_AI_PITS : MANCALA_PLAYER_PITS;

    const sowOne = () => {
        if (stones <= 0) {
            const lastPit = pos;
            const isOwnPit = ownPits.includes(lastPit);
            const isOwnStore = lastPit === ownStore;

            let captureMsg = '';
            if (isOwnPit && mancalaBoard[lastPit] === 1) {
                const opp = MANCALA_OPP_PIT(lastPit);
                if (mancalaBoard[opp] > 0) {
                    const captured = mancalaBoard[opp] + 1;
                    mancalaBoard[ownStore] += captured;
                    mancalaBoard[opp] = 0;
                    mancalaBoard[lastPit] = 0;
                    captureMsg = isAI ? `AI CAPTURED ${captured} STONES` : `CAPTURED ${captured} STONES`;
                    mancalaCaptureFlash = { idx: lastPit, until: Date.now() + 400 };
                    try { SoundManager.playBloop(180, 0.1); } catch (_) {}
                    const t2 = setTimeout(() => { try { SoundManager.playBloop(360, 0.1); } catch (_) {} }, 90);
                    mancalaTimeoutQueue.push(t2);
                }
            }

            const playerEmpty = MANCALA_PLAYER_PITS.every(i => mancalaBoard[i] === 0);
            const aiEmpty = MANCALA_AI_PITS.every(i => mancalaBoard[i] === 0);
            if (playerEmpty || aiEmpty) {
                if (playerEmpty) {
                    for (const i of MANCALA_AI_PITS) { mancalaBoard[MANCALA_AI_STORE] += mancalaBoard[i]; mancalaBoard[i] = 0; }
                } else {
                    for (const i of MANCALA_PLAYER_PITS) { mancalaBoard[MANCALA_PLAYER_STORE] += mancalaBoard[i]; mancalaBoard[i] = 0; }
                }
                mancalaEndGame();
                return;
            }

            if (isOwnStore) {
                mancalaStatusText = isAI ? 'AI EXTRA TURN' : 'EXTRA TURN';
                mancalaStatusColor = isAI ? '#f88' : '#0f0';
                try { SoundManager.playBloop(440, 0.06); } catch (_) {}
                mancalaDrawBoard();
                const t = setTimeout(() => {
                    mancalaInputLocked = false;
                    if (isAI) {
                        mancalaAITurn();
                    } else {
                        mancalaStatusText = 'YOUR TURN';
                        mancalaStatusColor = '#0ff';
                        mancalaDrawBoard();
                    }
                }, 700);
                mancalaTimeoutQueue.push(t);
                return;
            }

            mancalaTurn = isAI ? 'player' : 'ai';
            if (captureMsg) {
                mancalaStatusText = captureMsg;
                mancalaStatusColor = isAI ? '#f88' : '#0f0';
            } else {
                mancalaStatusText = mancalaTurn === 'player' ? 'YOUR TURN' : 'AI THINKING...';
                mancalaStatusColor = mancalaTurn === 'player' ? '#0ff' : '#f88';
            }
            mancalaDrawBoard();

            const delay = captureMsg ? 800 : 380;
            const t = setTimeout(() => {
                mancalaInputLocked = false;
                if (mancalaTurn === 'ai') {
                    mancalaAITurn();
                } else {
                    mancalaStatusText = 'YOUR TURN';
                    mancalaStatusColor = '#0ff';
                    mancalaDrawBoard();
                }
            }, delay);
            mancalaTimeoutQueue.push(t);
            return;
        }

        pos = (pos + 1) % 14;
        if (pos === skipStore) pos = (pos + 1) % 14;
        mancalaBoard[pos]++;
        stones--;
        try { SoundManager.playBloop(280, 0.02); } catch (_) {}
        mancalaDrawBoard();

        const t = setTimeout(sowOne, 140);
        mancalaTimeoutQueue.push(t);
    };

    sowOne();
}

function mancalaAITurn() {
    if (mancalaGameOver) return;
    mancalaInputLocked = true;
    mancalaTurn = 'ai';
    mancalaStatusText = 'AI THINKING...';
    mancalaStatusColor = '#f88';
    mancalaDrawBoard();

    const depth = mancalaDifficulty === 'easy' ? 1 : mancalaDifficulty === 'medium' ? 4 : 6;
    const move = mancalaChooseAIMove(mancalaBoard.slice(), depth);

    if (move === -1 || mancalaBoard[move] === 0) {
        mancalaEndGame();
        return;
    }

    const t = setTimeout(() => mancalaExecuteSow(move, true), 420);
    mancalaTimeoutQueue.push(t);
}

function mancalaChooseAIMove(board, depth) {
    let bestMove = -1;
    let bestScore = -Infinity;

    const moves = MANCALA_AI_PITS.filter(i => board[i] > 0);
    if (moves.length === 0) return -1;

    for (const m of moves) {
        const newBoard = board.slice();
        const extraTurn = mancalaSimulateSow(newBoard, m, true);
        const score = mancalaMinimax(newBoard, depth - 1, extraTurn, -Infinity, Infinity);
        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }
    }
    return bestMove;
}

function mancalaMinimax(board, depth, maximizing, alpha, beta) {
    const playerEmpty = MANCALA_PLAYER_PITS.every(i => board[i] === 0);
    const aiEmpty = MANCALA_AI_PITS.every(i => board[i] === 0);

    if (playerEmpty || aiEmpty) {
        const b = board.slice();
        if (playerEmpty) for (const i of MANCALA_AI_PITS) { b[MANCALA_AI_STORE] += b[i]; b[i] = 0; }
        else for (const i of MANCALA_PLAYER_PITS) { b[MANCALA_PLAYER_STORE] += b[i]; b[i] = 0; }
        return mancalaEvaluate(b);
    }

    if (depth === 0) return mancalaEvaluate(board);

    if (maximizing) {
        const moves = MANCALA_AI_PITS.filter(i => board[i] > 0);
        if (moves.length === 0) return mancalaEvaluate(board);
        let best = -Infinity;
        for (const m of moves) {
            const newBoard = board.slice();
            const extraTurn = mancalaSimulateSow(newBoard, m, true);
            const score = mancalaMinimax(newBoard, depth - 1, extraTurn ? true : false, alpha, beta);
            if (score > best) best = score;
            if (best > alpha) alpha = best;
            if (beta <= alpha) break;
        }
        return best;
    } else {
        const moves = MANCALA_PLAYER_PITS.filter(i => board[i] > 0);
        if (moves.length === 0) return mancalaEvaluate(board);
        let best = Infinity;
        for (const m of moves) {
            const newBoard = board.slice();
            const extraTurn = mancalaSimulateSow(newBoard, m, false);
            const score = mancalaMinimax(newBoard, depth - 1, extraTurn ? false : true, alpha, beta);
            if (score < best) best = score;
            if (best < beta) beta = best;
            if (beta <= alpha) break;
        }
        return best;
    }
}

function mancalaSimulateSow(board, startIdx, isAI) {
    let stones = board[startIdx];
    board[startIdx] = 0;
    let pos = startIdx;
    const skipStore = isAI ? MANCALA_PLAYER_STORE : MANCALA_AI_STORE;
    const ownStore = isAI ? MANCALA_AI_STORE : MANCALA_PLAYER_STORE;
    const ownPits = isAI ? MANCALA_AI_PITS : MANCALA_PLAYER_PITS;

    while (stones > 0) {
        pos = (pos + 1) % 14;
        if (pos === skipStore) pos = (pos + 1) % 14;
        board[pos]++;
        stones--;
    }

    if (ownPits.includes(pos) && board[pos] === 1) {
        const opp = MANCALA_OPP_PIT(pos);
        if (board[opp] > 0) {
            board[ownStore] += board[opp] + 1;
            board[opp] = 0;
            board[pos] = 0;
        }
    }

    return pos === ownStore;
}

function mancalaEvaluate(board) {
    const storeDiff = board[MANCALA_AI_STORE] - board[MANCALA_PLAYER_STORE];
    const aiSeeds = MANCALA_AI_PITS.reduce((s, i) => s + board[i], 0);
    const playerSeeds = MANCALA_PLAYER_PITS.reduce((s, i) => s + board[i], 0);
    return storeDiff + 0.1 * (aiSeeds - playerSeeds);
}

function mancalaEndGame() {
    mancalaGameOver = true;
    mancalaInputLocked = true;
    const playerScore = mancalaBoard[MANCALA_PLAYER_STORE];
    const aiScore = mancalaBoard[MANCALA_AI_STORE];
    const playerWon = playerScore > aiScore;
    const draw = playerScore === aiScore;
    const priorStreak = mancalaHardStreak;

    if (mancalaDifficulty === 'hard') {
        if (playerWon) {
            mancalaHardStreak++;
            try { localStorage.setItem('mancala_hard_streak', String(mancalaHardStreak)); } catch (_) {}
            submitScore('mancala_hard_streak', mancalaHardStreak);
        } else if (!draw) {
            mancalaHardStreak = 0;
            try { localStorage.setItem('mancala_hard_streak', '0'); } catch (_) {}
        }
    }

    if (playerWon) { try { SoundManager.playBloop(800, 0.2); } catch (_) {} }
    else if (draw) { try { SoundManager.playBloop(440, 0.15); } catch (_) {} }
    else { try { SoundManager.playBloop(140, 0.2); } catch (_) {} }

    mancalaDrawBoard();

    const ctx = mancalaCtx;
    ctx.fillStyle = playerWon ? 'rgba(0,30,10,0.86)' : draw ? 'rgba(20,20,30,0.86)' : 'rgba(30,0,10,0.86)';
    ctx.fillRect(0, 0, mancalaW, mancalaH);

    const borderCol = playerWon ? '#00ff00' : draw ? '#ffff00' : '#ff4444';
    const cx = mancalaW / 2, cy = mancalaH / 2;
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 240, cy - 80, 480, 160);
    ctx.strokeStyle = borderCol + '66';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 244, cy - 84, 488, 168);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = borderCol;
    ctx.font = 'bold 38px monospace';
    ctx.shadowBlur = 18;
    ctx.shadowColor = borderCol;
    ctx.fillText(playerWon ? 'VICTORY' : draw ? 'DRAW' : 'DEFEATED', cx, cy - 38);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${playerScore}  -  ${aiScore}`, cx, cy - 6);

    if (mancalaDifficulty === 'hard') {
        ctx.fillStyle = playerWon ? '#0ff' : '#888';
        ctx.font = '12px monospace';
        let streakLine;
        if (playerWon) streakLine = `HARD WIN STREAK: ${mancalaHardStreak}`;
        else if (draw) streakLine = `STREAK PAUSED &middot; STILL ${mancalaHardStreak}`;
        else streakLine = priorStreak > 0 ? `STREAK RESET FROM ${priorStreak}` : `NO STREAK STARTED`;
        ctx.fillText(streakLine.replace('&middot;', '·'), cx, cy + 20);
    } else {
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.fillText(`${mancalaDifficulty.toUpperCase()} MODE · NOT SCORED`, cx, cy + 20);
    }

    ctx.fillStyle = borderCol + 'cc';
    ctx.font = '12px monospace';
    ctx.fillText('CLICK to play again', cx, cy + 56);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

function stopMancala() {
    mancalaTimeoutQueue.forEach(t => clearTimeout(t));
    mancalaTimeoutQueue = [];
    clearTimeout(mancalaPostCaptureRedraw);
    mancalaInputLocked = false;
    mancalaGameOver = false;
    if (typeof nexusCanvas !== 'undefined' && nexusCanvas) {
        nexusCanvas.onclick = null;
        nexusCanvas.onmousemove = null;
        nexusCanvas.ontouchstart = null;
        nexusCanvas.style.maxWidth = '';
        nexusCanvas.style.height = '';
        nexusCanvas.style.borderRadius = '';
        nexusCanvas.style.border = '';
        nexusCanvas.style.boxShadow = '';
    }
    if (typeof guiContainer !== 'undefined' && guiContainer) {
        guiContainer.classList.remove('gui-game-wide');
    }
}
