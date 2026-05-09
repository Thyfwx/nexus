function startBreach() {
    stopAllGames();
    breachActive = true;
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'BREACH PROTOCOL';

    const hexCodes = ['E9', '1C', '55', 'BD', '7A', 'FF', 'F0'];
    const grid = [];
    for(let i=0; i<25; i++) grid.push(hexCodes[Math.floor(Math.random() * hexCodes.length)]);

    const sequence = [];
    for(let i=0; i<3; i++) sequence.push(grid[Math.floor(Math.random() * grid.length)]);

    let currentInput = [];
    let timeLeft = 30;

    guiContent.innerHTML = `
        <div style="text-align:center; padding:18px 12px; max-width:520px; margin:0 auto;">
            <div style="color:#0ff; letter-spacing:3px; font-size:0.78rem; font-weight:700; margin-bottom:6px; text-shadow:0 0 10px #0ff;">BREACH PROTOCOL</div>
            <div style="color:#666; font-size:0.7rem; margin-bottom:18px; line-height:1.5; letter-spacing:0.5px;">
                Click the hex codes below in the EXACT order shown.<br>
                One wrong code = game over. You have 30 seconds.
            </div>
            <div style="background:rgba(0,0,0,0.4); border:1px solid #0f0; border-radius:6px; padding:14px; margin-bottom:16px;">
                <div style="color:#888; font-size:0.65rem; letter-spacing:2px; margin-bottom:6px;">REQUIRED SEQUENCE</div>
                <div style="color:#0f0; font-size:1.4rem; letter-spacing:8px; font-weight:700; font-family:monospace; text-shadow:0 0 12px #0f0;">${sequence.join(' &middot; ')}</div>
                <div style="color:#444; font-size:0.6rem; margin-top:6px;">Match these in order →</div>
            </div>
            <div id="breach-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; max-width:380px; margin:0 auto;">
                ${grid.map((hex, i) => `<button class="gui-btn breach-tile" data-idx="${i}" style="margin:0; padding:14px; font-size:0.95rem; font-weight:700; letter-spacing:1px; border:1.5px solid #333; background:rgba(255,255,255,0.02); color:#aaa; cursor:pointer; transition:0.15s; font-family:monospace;" onmouseover="if(!this.disabled){this.style.borderColor='#0ff'; this.style.color='#0ff';}" onmouseout="if(!this.disabled){this.style.borderColor='#333'; this.style.color='#aaa';}">${hex}</button>`).join('')}
            </div>
            <div style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:14px;">
                <span style="color:#888; font-size:0.7rem; letter-spacing:1px;">TIME LEFT:</span>
                <span id="breach-timer" style="color:#0f0; font-size:1.1rem; font-weight:700; font-family:monospace; min-width:48px; text-align:left;">${timeLeft}s</span>
            </div>
            <div id="breach-progress" style="color:#666; font-size:0.65rem; margin-top:10px; letter-spacing:1px;">SEQUENCE: __ __ __</div>
        </div>`;
    
    const timer = setInterval(() => {
        if (!breachActive) { clearInterval(timer); return; }
        timeLeft--;
        const el = document.getElementById('breach-timer');
        if (el) {
            el.textContent = timeLeft + 's';
            // Color shifts as time runs out
            el.style.color = timeLeft > 15 ? '#0f0' : timeLeft > 8 ? '#ff0' : '#f44';
        }
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (breachActive) {
                printToTerminal('[FAIL] Breach Timeout. ICE reset.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            }
        }
    }, 1000);

    guiContent.querySelectorAll('.breach-tile').forEach(btn => {
        btn.onclick = () => {
            const hex = btn.textContent;
            currentInput.push(hex);

            // Update progress display
            const prog = document.getElementById('breach-progress');
            if (prog) {
                const display = sequence.map((s, i) => currentInput[i] || '__').join(' ');
                prog.innerHTML = `SEQUENCE: <span style="color:#0ff; letter-spacing:2px;">${display}</span>`;
            }

            // Check sequence
            const match = currentInput.every((h, idx) => h === sequence[idx]);
            if (!match) {
                btn.style.borderColor = '#f44';
                btn.style.color = '#f44';
                btn.style.background = 'rgba(255,68,68,0.1)';
                if (typeof submitScore === 'function') submitScore('breach', 0);
                printToTerminal('[FAIL] Sequence Mismatch. Alarm triggered.', 'sys-msg');
                clearInterval(timer);
                breachActive = false;
                setTimeout(() => {
                    guiContent.innerHTML = `
                        <div style="text-align:center; padding:40px 20px;">
                            <div style="color:#f44; font-size:1.6rem; font-weight:700; letter-spacing:3px; text-shadow:0 0 14px #f44; margin-bottom:8px;">ACCESS DENIED</div>
                            <div style="color:#888; font-size:0.85rem; margin-bottom:18px;">You picked <b style="color:#f44;">${hex}</b>, expected <b style="color:#0f0;">${sequence[currentInput.length - 1]}</b>.</div>
                            <button onclick="startBreach()" style="background:transparent; border:1px solid #0ff; color:#0ff; padding:10px 22px; font-family:'Fira Code',monospace; cursor:pointer; border-radius:4px; font-size:0.78rem; letter-spacing:2px; font-weight:700;">TRY AGAIN</button>
                        </div>`;
                }, 800);
            } else {
                btn.style.borderColor = '#0f0';
                btn.style.color = '#0f0';
                btn.style.background = 'rgba(0,255,0,0.1)';
                btn.disabled = true;
                if (currentInput.length === sequence.length) {
                    if (typeof submitScore === 'function') submitScore('breach', Math.max(1, timeLeft) * 10);
                    printToTerminal('[OK] Neural link established. Admin access granted.', 'conn-ok');
                    clearInterval(timer);
                    breachActive = false;
                    setTimeout(() => {
                        guiContent.innerHTML = `
                            <div style="text-align:center; padding:40px 20px;">
                                <div style="color:#0f0; font-size:1.6rem; font-weight:700; letter-spacing:3px; text-shadow:0 0 14px #0f0; margin-bottom:8px;">ACCESS GRANTED</div>
                                <div style="color:#888; font-size:0.85rem; margin-bottom:6px;">System bypassed in ${30 - timeLeft}s.</div>
                                <div style="color:#ff0; font-size:0.75rem; margin-bottom:20px;">Score: ${Math.max(1, timeLeft) * 10}</div>
                                <button onclick="startBreach()" style="background:transparent; border:1px solid #0ff; color:#0ff; padding:10px 22px; font-family:'Fira Code',monospace; cursor:pointer; border-radius:4px; font-size:0.78rem; letter-spacing:2px; font-weight:700;">PLAY AGAIN</button>
                            </div>`;
                    }, 600);
                }
            }
        };
    });
}
