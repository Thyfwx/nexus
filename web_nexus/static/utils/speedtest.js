// 🚀 NEXUS SPEEDTEST v7.0 — fully self-contained, no external dependencies.
// Uses ONLY your own backend endpoints. Bytes flow over the user's real link to your
// Cloudflare-Pages-hosted backend, so the measurement is honest end-to-end.
//   - /ping                    → latency + jitter
//   - /api/server-info         → user IP + region
//   - /api/speedtest-blob      → download (os.urandom bytes, no compression)
//   - /api/speedtest-up        → upload (POST random bytes)
//
// Dropped: speed.cloudflare.com (AdGuard / school networks block it; we're our own source now)
//
// HONESTY NOTES:
// - Bytes really cross your network — not faked, not cached (random + no-store headers)
// - Speed reported = throughput from your device → Nexus backend → and back. If your
//   bottleneck is Wi-Fi / ISP, that's what you see. If it's our server, you see that instead.

const _BASE = () => window.API_BASE || '';

async function _measureLatency(samples = 10) {
    const pings = [];
    for (let i = 0; i < samples; i++) {
        const t0 = performance.now();
        try {
            await fetch(`${_BASE()}/ping?t=${Date.now()}_${i}`, { cache: 'no-store' });
            pings.push(performance.now() - t0);
        } catch (_) {}
    }
    pings.sort((a, b) => a - b);
    if (!pings.length) return { min: 0, jitter: 0 };
    const min = pings[0];
    const max = pings[pings.length - 1];
    return { min: Math.round(min), jitter: Math.round((max - min) / 2) };
}

async function _measureDown(bytes, onProgress) {
    const t0 = performance.now();
    let received = 0;
    try {
        const r = await fetch(`${_BASE()}/api/speedtest-blob?bytes=${bytes}&t=${Date.now()}_${Math.random()}`, { cache: 'no-store' });
        if (!r.ok || !r.body) return 0;
        const reader = r.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;
            if (onProgress) onProgress(received, performance.now() - t0);
        }
    } catch (_) { return 0; }
    const sec = Math.max(0.001, (performance.now() - t0) / 1000);
    return ((received * 8) / sec) / 1_000_000;
}

async function _measureUp(bytes) {
    const data = new Uint8Array(bytes);
    const CHUNK = 65536;
    for (let off = 0; off < bytes; off += CHUNK) {
        crypto.getRandomValues(data.subarray(off, Math.min(off + CHUNK, bytes)));
    }
    const t0 = performance.now();
    try {
        const r = await fetch(`${_BASE()}/api/speedtest-up`, { method: 'POST', body: data, cache: 'no-store' });
        if (!r.ok) return 0;
    } catch (_) { return 0; }
    const sec = Math.max(0.001, (performance.now() - t0) / 1000);
    return ((bytes * 8) / sec) / 1_000_000;
}

async function _serverInfo() {
    try {
        const r = await fetch(`${_BASE()}/api/server-info`, { cache: 'no-store' });
        const j = await r.json();
        const loc = (j.city && j.country) ? `${j.city}, ${j.country}` : (j.country || 'unknown');
        return { ip: j.client_ip || 'unknown', loc, host: j.host || 'nexus' };
    } catch (_) { return { ip: 'unknown', loc: 'unknown', host: 'nexus' }; }
}

window.startSpeedTest = function() {
    if (!window.guiContainer) return;
    stopAllGames();

    window.guiTitle.textContent = 'NETWORK · SPEED TEST';
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    window.guiContent.innerHTML = `
        <div style="padding:20px 18px;">
            <h2 id="speed-status" style="color:var(--accent); margin:0 0 4px; letter-spacing:2px; font-size:0.92rem; text-align:center;">READY</h2>
            <p id="speed-server" style="color:#666; font-size:0.68rem; margin:0 0 16px; text-align:center;">Click START — runs entirely against the Nexus backend, no external deps.</p>

            <div style="text-align:center; margin-bottom:18px;">
                <div id="speed-rate-live" style="color:#0ff; font-weight:800; font-size:3rem; letter-spacing:1px; line-height:1;">—</div>
                <div id="speed-phase" style="color:#555; font-size:0.65rem; letter-spacing:3px; margin-top:4px;">MBPS · LIVE</div>
            </div>

            <div style="height:18px; background:rgba(0,0,0,0.7); border:1px solid rgba(0,255,255,0.25); border-radius:9px; overflow:hidden; position:relative;">
                <div id="speed-meter-fill" style="position:absolute; left:0; top:0; bottom:0; width:0%; background:linear-gradient(90deg, #0f0 0%, #0ff 30%, #ff0 60%, #f80 80%, #f0f 100%); transition:width 0.18s ease-out;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.55rem; color:#555; letter-spacing:1px; margin-top:4px; padding:0 2px;">
                <span>0</span><span>25</span><span>100</span><span>250</span><span>500</span><span>1Gb+</span>
            </div>

            <div id="speed-results" style="margin-top:18px; background:rgba(0,0,0,0.3); padding:12px 14px; border-radius:8px; display:none;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; text-align:center;">
                    <div><div id="speed-down" style="color:#0f0; font-weight:bold; font-size:1rem;">—</div><div style="color:#666; font-size:0.55rem; letter-spacing:1.5px; margin-top:2px;">DOWN Mbps</div></div>
                    <div><div id="speed-up" style="color:#0ff; font-weight:bold; font-size:1rem;">—</div><div style="color:#666; font-size:0.55rem; letter-spacing:1.5px; margin-top:2px;">UP Mbps</div></div>
                    <div><div id="speed-ping" style="color:#0ff; font-weight:bold; font-size:1rem;">—</div><div style="color:#666; font-size:0.55rem; letter-spacing:1.5px; margin-top:2px;">LATENCY ms</div></div>
                    <div><div id="speed-jitter" style="color:#0ff; font-weight:bold; font-size:1rem;">—</div><div style="color:#666; font-size:0.55rem; letter-spacing:1.5px; margin-top:2px;">JITTER ms</div></div>
                </div>
            </div>

            <div style="margin-top:20px; display:flex; gap:8px; justify-content:center;">
                <button id="speed-start" class="action-btn" style="min-width:200px;" onclick="window._runSpeedTest()">START FULL TEST</button>
            </div>
            <p style="color:#666; font-size:0.6rem; text-align:center; margin-top:10px; line-height:1.5;">
                Measures real bytes from your device to the Nexus backend (Cloudflare Pages edge).<br>
                If your link is slow, the number will be slow. If it's fast, the number will be fast. Honest.
            </p>
        </div>`;
};

window._runSpeedTest = async function() {
    const status   = document.getElementById('speed-status');
    const meter    = document.getElementById('speed-meter-fill');
    const rateEl   = document.getElementById('speed-rate-live');
    const phaseEl  = document.getElementById('speed-phase');
    const results  = document.getElementById('speed-results');
    const downEl   = document.getElementById('speed-down');
    const upEl     = document.getElementById('speed-up');
    const pingEl   = document.getElementById('speed-ping');
    const jitEl    = document.getElementById('speed-jitter');
    const serverEl = document.getElementById('speed-server');
    const startBtn = document.getElementById('speed-start');
    if (!status || !meter) return;

    const mbpsToWidth = (mbps) => {
        if (mbps <= 0) return 0;
        if (mbps >= 1000) return 100;
        if (mbps < 25)   return (mbps / 25) * 20;
        if (mbps < 100)  return 20 + ((mbps - 25) / 75) * 20;
        if (mbps < 250)  return 40 + ((mbps - 100) / 150) * 20;
        if (mbps < 500)  return 60 + ((mbps - 250) / 250) * 20;
        return 80 + ((mbps - 500) / 500) * 20;
    };
    const setLive = (mbps) => {
        if (meter) meter.style.width = `${mbpsToWidth(mbps).toFixed(1)}%`;
        if (rateEl) rateEl.textContent = mbps > 0 ? mbps.toFixed(1) : '—';
    };
    setLive(0);
    if (results) results.style.display = 'none';
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'RUNNING…'; }

    if (phaseEl) phaseEl.textContent = 'CONNECTING';
    status.textContent = 'CONNECTING…';
    const srv = await _serverInfo();
    if (serverEl) serverEl.textContent = `Nexus backend · ${srv.loc} · your IP ${srv.ip}`;

    if (phaseEl) phaseEl.textContent = 'PINGING';
    status.textContent = 'MEASURING LATENCY…';
    const lat = await _measureLatency(10);
    if (pingEl) pingEl.textContent = `${lat.min}`;
    if (jitEl)  jitEl.textContent  = `${lat.jitter}`;

    if (phaseEl) phaseEl.textContent = 'DOWNLOAD';
    status.textContent = 'MEASURING DOWNLOAD…';
    const sizes = [
        { bytes: 1_000_000, runs: 4 },
        { bytes: 10_000_000, runs: 3 },
        { bytes: 25_000_000, runs: 2 },
    ];
    const downResults = [];
    const downRawLog = [];
    let bestDown = 0;
    for (const sz of sizes) {
        const sizeRuns = [];
        for (let i = 0; i < sz.runs; i++) {
            const t0 = performance.now();
            const m = await _measureDown(sz.bytes);
            const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
            if (m > 0) {
                sizeRuns.push(m);
                downRawLog.push(`${(sz.bytes/1_000_000).toFixed(0)}MB in ${elapsed}s = ${m.toFixed(1)} Mbps`);
                if (m > bestDown) { bestDown = m; setLive(m); }
            } else {
                downRawLog.push(`${(sz.bytes/1_000_000).toFixed(0)}MB FAILED`);
            }
        }
        if (sizeRuns.length) {
            sizeRuns.sort((a, b) => a - b);
            downResults.push(sizeRuns[Math.floor(sizeRuns.length / 2)]);
        }
        if (downResults.length && downResults[downResults.length - 1] < 5) break;
    }
    const finalDown = downResults.length ? downResults[downResults.length - 1] : 0;
    setLive(finalDown);
    if (downEl) downEl.textContent = finalDown ? finalDown.toFixed(1) : '0.0';
    window._lastDownLog = downRawLog;  // accessible for debug panel below

    if (phaseEl) phaseEl.textContent = 'UPLOAD';
    status.textContent = 'MEASURING UPLOAD…';
    const upSizes = [{ bytes: 100_000, runs: 4 }, { bytes: 1_000_000, runs: 3 }, { bytes: 5_000_000, runs: 2 }];
    const upResults = [];
    let bestUp = 0;
    for (const sz of upSizes) {
        const sizeRuns = [];
        for (let i = 0; i < sz.runs; i++) {
            const m = await _measureUp(sz.bytes);
            if (m > 0) {
                sizeRuns.push(m);
                if (m > bestUp) { bestUp = m; setLive(m); }
            }
        }
        if (sizeRuns.length) {
            sizeRuns.sort((a, b) => a - b);
            upResults.push(sizeRuns[Math.floor(sizeRuns.length / 2)]);
        }
        if (upResults.length && upResults[upResults.length - 1] < 5) break;
    }
    const finalUp = upResults.length ? upResults[upResults.length - 1] : 0;
    if (upEl) upEl.textContent = finalUp ? finalUp.toFixed(1) : '0.0';

    setLive(finalDown);
    if (results) results.style.display = 'block';
    if (phaseEl) phaseEl.textContent = 'MBPS · DOWNLOAD';

    if (finalDown <= 0 && finalUp <= 0) {
        status.textContent = 'TEST FAILED · backend unreachable';
    } else {
        status.textContent = 'TEST COMPLETE';
    }
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'RUN AGAIN'; }

    // Transparency panel — shows the actual measurement math so you can verify the number.
    const log = (window._lastDownLog || []).map(l => `  • ${l}`).join('\n');
    const existing = document.getElementById('speed-raw'); if (existing) existing.remove();
    const raw = document.createElement('div');
    raw.id = 'speed-raw';
    raw.style.cssText = 'margin-top:14px; padding:10px 14px; background:rgba(0,0,0,0.4); border-left:3px solid #0ff; border-radius:4px; font-family:monospace; font-size:0.62rem; color:#9ce; line-height:1.7; white-space:pre-line;';
    raw.textContent = `RAW MEASUREMENTS (verify the math yourself):
${log}
Final download = median of largest size's runs = ${finalDown.toFixed(1)} Mbps
Latency = min of 10 pings to /ping = ${lat.min} ms
Upload  = median of upload runs       = ${finalUp.toFixed(1)} Mbps

Math: bits / seconds / 1,000,000 = Mbps`;
    if (window.guiContent) window.guiContent.querySelector('div').appendChild(raw);
};
