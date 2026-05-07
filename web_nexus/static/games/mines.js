let mineGrid = [], mineRevealed = [], mineFlagged = [], mineOver = false, mineWon = false, mineFirst = true;

function startMinesweeper() {
    stopAllGames();
    mineActive = true;
    mineOver = false; mineWon = false; mineFirst = true;
    mineGrid = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(0));
    mineRevealed = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));
    mineFlagged  = Array.from({length: MINE_ROWS}, () => Array(MINE_COLS).fill(false));

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'NEXUS MINESWEEPER';
    nexusCanvas.style.display = 'none';
    renderMinesweeper();
    printToTerminal('Minesweeper  left-click to reveal, right-click to flag. First click is always safe.', 'sys-msg');
}

function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < MINE_COUNT) {
        const r = Math.floor(Math.random() * MINE_ROWS);
        const c = Math.floor(Math.random() * MINE_COLS);
        if (mineGrid[r][c] !== -1 && !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) {
            mineGrid[r][c] = -1;
            placed++;
        }
    }
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) {
        if (mineGrid[r][c] === -1) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && mineGrid[nr][nc] === -1) n++;
        }
        mineGrid[r][c] = n;
    }
}

function mineFlood(r, c) {
    if (r < 0 || r >= MINE_ROWS || c < 0 || c >= MINE_COLS) return;
    if (mineRevealed[r][c] || mineFlagged[r][c]) return;
    mineRevealed[r][c] = true;
    if (mineGrid[r][c] === 0) for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) mineFlood(r+dr,c+dc);
}

function renderMinesweeper() {
    const NCOLORS = ['','#0ff','#0f0','#f55','#55f','#f80','#0ff','#0ff','#aaa'];
    const flagsLeft = MINE_COUNT - mineFlagged.flat().filter(Boolean).length;

    let html = `<div style="text-align:center;font-size:0.75rem;color:#888;margin-bottom:8px;">
         ${flagsLeft} mines remaining${mineOver ? '  <span style="color:#f55">BOOM</span>' : ''}${mineWon ? '  <span style="color:#0f0">YOU WIN!</span>' : ''}
    </div><table style="border-collapse:collapse;margin:0 auto;">`;

    for (let r = 0; r < MINE_ROWS; r++) {
        html += '<tr>';
        for (let c = 0; c < MINE_COLS; c++) {
            const revealed = mineRevealed[r][c];
            const flagged  = mineFlagged[r][c];
            const val      = mineGrid[r][c];
            let bg = revealed ? '#1a1a2e' : '#2a2a3e';
            let color = '#0ff', text = '';
            let border = revealed ? '1px solid #111' : '1px solid #444';
            if (revealed) {
                if (val === -1) { bg = '#500'; color = '#f55'; text = ''; }
                else if (val > 0) { color = NCOLORS[val]; text = val; }
            } else if (flagged) { text = ''; }
            const style = `width:30px;height:30px;text-align:center;vertical-align:middle;background:${bg};border:${border};color:${color};font-size:0.8rem;font-weight:bold;cursor:${mineOver||mineWon?'default':'pointer'};user-select:none;`;
            html += `<td style="${style}" onclick="mineClick(${r},${c})" oncontextmenu="mineFlag(event,${r},${c})">${text}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    if (mineOver || mineWon) html += `<div style="text-align:center;margin-top:10px;"><button onclick="startMinesweeper()" style="background:transparent;border:1px solid #0ff;color:#0ff;padding:6px 14px;font-family:'Fira Code',monospace;cursor:pointer;border-radius:4px;">New Game</button></div>`;

    guiContent.innerHTML = html;
}

window.mineClick = function(r, c) {
    if (mineOver || mineWon || mineRevealed[r][c] || mineFlagged[r][c]) return;
    if (mineFirst) { placeMines(r, c); mineFirst = false; }
    if (mineGrid[r][c] === -1) {
        mineRevealed[r][c] = true;
        mineOver = true;
        // Reveal all mines
        for (let i=0;i<MINE_ROWS;i++) for (let j=0;j<MINE_COLS;j++) if (mineGrid[i][j]===-1) mineRevealed[i][j]=true;
        renderMinesweeper();
        printToTerminal(' Detonated. Better luck next time.', 'sys-msg');
        return;
    }
    mineFlood(r, c);
    const safe = MINE_ROWS * MINE_COLS - MINE_COUNT;
    if (mineRevealed.flat().filter(Boolean).length >= safe) {
        mineWon = true;
        printToTerminal(' All mines cleared. Nice work.', 'conn-ok');
    }
    renderMinesweeper();
};

window.mineFlag = function(e, r, c) {
    e.preventDefault();
    if (mineOver || mineWon || mineRevealed[r][c]) return;
    mineFlagged[r][c] = !mineFlagged[r][c];
    renderMinesweeper();
};
