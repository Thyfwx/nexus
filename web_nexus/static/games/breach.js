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
        <div style="text-align:center;">
            <div style="color:#0f0;font-size:0.75rem;margin-bottom:8px;">REQUIRED SEQUENCE: <b style="color:#fff;letter-spacing:2px;">${sequence.join(' ')}</b></div>
            <div id="breach-grid" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;max-width:250px;margin:0 auto;">
                ${grid.map((hex, i) => `<button class="gui-btn breach-tile" data-idx="${i}" style="margin:0;padding:8px;font-size:0.8rem;border-color:#333;">${hex}</button>`).join('')}
            </div>
            <div id="breach-timer" style="margin-top:12px;color:#f00;font-weight:bold;">${timeLeft}s</div>
        </div>`;
    
    const timer = setInterval(() => {
        if (!breachActive) { clearInterval(timer); return; }
        timeLeft--;
        const el = document.getElementById('breach-timer');
        if (el) el.textContent = timeLeft + 's';
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
            btn.style.borderColor = '#0f0';
            btn.style.color = '#0f0';
            btn.disabled = true;
            currentInput.push(hex);
            
            // Check sequence
            const match = currentInput.every((h, idx) => h === sequence[idx]);
            if (!match) {
                printToTerminal('[FAIL] Sequence Mismatch. Alarm Triggered.', 'sys-msg');
                stopAllGames();
                guiContainer.classList.add('gui-hidden');
            } else if (currentInput.length === sequence.length) {
                printToTerminal('[OK] Neural link established. Admin access granted.', 'conn-ok');
                clearInterval(timer);
                breachActive = false;
                guiContent.innerHTML = '<h2 style="color:#0f0;">ACCESS GRANTED</h2><p style="color:#888;">System bypassed successfully.</p>';
            }
        };
    });
}
