function startMonitor() {
    stopAllGames();
    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'SYSTEM TELEMETRY';

    //  Gather real device data 
    const cores    = navigator.hardwareConcurrency || '?';
    const ramHint  = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '?';
    const conn     = navigator.connection;
    const hasHeap  = !!(window.performance && performance.memory);
    const connType = conn ? (conn.type || conn.effectiveType || '?') : 'N/A';
    const dlMbps   = conn?.downlink !== undefined ? conn.downlink : null;
    const scrn     = `${window.screen.width}${window.screen.height}`;
    const dpr      = window.devicePixelRatio ? `@${window.devicePixelRatio}x` : '';

    let batPct = null, batChg = null;
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            batPct = Math.round(b.level * 100); batChg = b.charging;
            b.onlevelchange     = () => { batPct = Math.round(b.level * 100); };
            b.onchargingchange  = () => { batChg = b.charging; };
            const v = document.getElementById('mon-bat-val');
            const s = document.getElementById('mon-bat-sub');
            if (v) v.textContent = batPct + '%';
            if (s) s.textContent = batChg ? 'CHARGING ' : 'ON BATTERY';
        }).catch(() => {});
    }

    guiContent.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:6px;text-align:center;font-size:0.68rem;">
            <div style="border:1px solid #0ff;padding:5px 3px;background:rgba(0,255,255,0.05);">
                <div style="color:#0ff;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">CPU</div>
                <div style="color:#fff;font-size:0.95rem;font-weight:bold;">${cores}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">CORES</div>
            </div>
            <div style="border:1px solid #f0f;padding:5px 3px;background:rgba(255,0,255,0.05);">
                <div style="color:#f0f;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">RAM</div>
                <div style="color:#fff;font-size:0.95rem;font-weight:bold;">${ramHint}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">DEVICE</div>
            </div>
            <div style="border:1px solid #0f0;padding:5px 3px;background:rgba(0,255,0,0.05);">
                <div style="color:#0f0;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">NET</div>
                <div id="mon-net-val" style="color:#fff;font-size:0.9rem;font-weight:bold;">${dlMbps !== null ? dlMbps + 'Mb' : connType}</div>
                <div style="color:#555;font-size:0.58rem;margin-top:2px;">${dlMbps !== null ? 'DOWNLINK' : 'TYPE'}</div>
            </div>
            <div style="border:1px solid #ff0;padding:5px 3px;background:rgba(255,255,0,0.04);">
                <div style="color:#ff0;letter-spacing:2px;font-size:0.58rem;margin-bottom:3px;">BATT</div>
                <div id="mon-bat-val" style="color:#fff;font-size:0.95rem;font-weight:bold;">${batPct !== null ? batPct + '%' : ''}</div>
                <div id="mon-bat-sub" style="color:#555;font-size:0.58rem;margin-top:2px;">${batPct !== null ? (batChg ? 'CHARGING ' : 'ON BATTERY') : 'N/A'}</div>
            </div>
        </div>
        <div style="color:#252525;font-size:0.6rem;text-align:right;margin-bottom:4px;padding:0 2px;">${scrn}${dpr}  ${connType}  ${navigator.language||'?'}  ${hasHeap ? 'heap API' : 'est'}</div>`;

    nexusCanvas.style.display = 'block';
    nexusCanvas.width = 400; nexusCanvas.height = 165;
    const ctx = nexusCanvas.getContext('2d');

    let prevIntervalMs = performance.now();

    clearInterval(monitorInterval);
    monitorInterval = setInterval(() => {
        //  Real data 
        // CPU proxy: measure interval overshoot (browser busyness)
        const nowMs = performance.now();
        const elapsed = nowMs - prevIntervalMs;
        prevIntervalMs = nowMs;
        // Expected: 400ms. Overshoot means main thread was busy.
        const cpuLoad = Math.min(95, Math.max(5, 10 + ((elapsed - 400) / 400) * 80 + Math.random() * 8));

        // Memory: real JS heap (Chrome) or device memory hint fallback
        let memPct;
        if (hasHeap) {
            memPct = Math.min(99, (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
        } else {
            memPct = 30 + Math.random() * 12; // estimated
        }

        // Network: real downlink reading
        const freshDl = navigator.connection?.downlink;
        const netPct  = freshDl !== undefined
            ? Math.min(100, (freshDl / 100) * 100) // normalize against 100Mbps
            : 15 + Math.random() * 20;

        // Update live readouts
        const netEl = document.getElementById('mon-net-val');
        if (netEl && freshDl !== undefined) netEl.textContent = freshDl.toFixed(1) + 'Mb';
        const batV = document.getElementById('mon-bat-val');
        const batS = document.getElementById('mon-bat-sub');
        if (batV && batPct !== null) batV.textContent = batPct + '%';
        if (batS && batPct !== null) batS.textContent = batChg ? 'CHARGING ' : 'ON BATTERY';

        cpuHistory.push(cpuLoad);
        memHistory.push(memPct);
        netHistory.push(netPct);
        [cpuHistory, memHistory, netHistory].forEach(h => { if (h.length > 50) h.shift(); });

        //  Draw sparklines 
        const W = 400, H = 165;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, W, H);

        const sections = [
            { label: 'CPU LOAD', note: 'thread est', data: cpuHistory, color: '#0ff', yBase: 52,  maxVal: 100 },
            { label: 'MEMORY',   note: hasHeap ? 'js heap' : 'est',   data: memHistory, color: '#f0f', yBase: 107, maxVal: 100 },
            { label: 'NETWORK',  note: freshDl !== undefined ? 'live' : 'est', data: netHistory, color: '#0f0', yBase: 162, maxVal: 100 },
        ];
        const sectionH = 52;

        sections.forEach(({ label, note, data, color, yBase }) => {
            const top = yBase - sectionH + 2;

            ctx.fillStyle = color + '08';
            ctx.fillRect(0, top, W, sectionH - 2);

            ctx.fillStyle = color;
            ctx.font = 'bold 8px monospace';
            ctx.fillText(label, 6, top + 11);
            ctx.fillStyle = '#333';
            ctx.font = '7px monospace';
            ctx.fillText(`[${note}]`, 7 + ctx.measureText(label).width + 4, top + 11);

            if (data.length > 1) {
                ctx.strokeStyle = color; ctx.lineWidth = 1.5;
                ctx.beginPath();
                data.forEach((v, i) => {
                    const x = (i / 50) * W;
                    const y = yBase - 4 - ((v / 100) * (sectionH - 16));
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.stroke();
                // Fill under
                ctx.beginPath();
                data.forEach((v, i) => {
                    const x = (i / 50) * W;
                    const y = yBase - 4 - ((v / 100) * (sectionH - 16));
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.lineTo((data.length - 1) / 50 * W, yBase - 4);
                ctx.lineTo(0, yBase - 4);
                ctx.closePath();
                ctx.fillStyle = color + '16';
                ctx.fill();
            }

            const last = data[data.length - 1];
            if (last !== undefined) {
                ctx.fillStyle = color; ctx.font = '8px monospace';
                ctx.fillText(last.toFixed(1) + '%', W - 46, top + 11);
            }

            ctx.strokeStyle = color + '33'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, yBase); ctx.lineTo(W, yBase); ctx.stroke();
        });
    }, 400);
}

// =============================================================
//  BREACH PROTOCOL (Hacking Game)
// =============================================================
let breachActive = false, _breachClick = null;

