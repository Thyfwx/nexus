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
        <div style="padding:22px 18px; max-width:560px; margin:0 auto;">

            <!-- Header: status + server info pill -->
            <div style="text-align:center; margin-bottom:20px;">
                <h2 id="speed-status" style="color:var(--accent); margin:0 0 6px; letter-spacing:3px; font-size:0.85rem; font-weight:700; text-shadow:0 0 12px var(--accent);">READY</h2>
                <div id="speed-server-pill" style="display:inline-flex; align-items:center; gap:8px; padding:5px 12px; background:rgba(0,180,255,0.06); border:1px solid rgba(0,180,255,0.2); border-radius:14px; font-size:0.65rem; color:#9ce; letter-spacing:0.5px; font-family:inherit;">
                    <span style="width:6px; height:6px; background:#0f0; border-radius:50%; box-shadow:0 0 6px #0f0;"></span>
                    <span id="speed-server">Click START to begin</span>
                </div>
            </div>

            <!-- Live MBPS readout -->
            <div style="text-align:center; margin-bottom:14px;">
                <div id="speed-rate-live" style="color:#0ff; font-weight:800; font-size:3.4rem; letter-spacing:0; line-height:1; text-shadow:0 0 18px rgba(0,255,255,0.4);">—</div>
                <div id="speed-phase" style="color:#666; font-size:0.65rem; letter-spacing:3px; margin-top:6px; font-weight:600;">MBPS · LIVE</div>
            </div>

            <!-- Meter bar with cleaner gradient + axis -->
            <div style="height:14px; background:rgba(0,0,0,0.6); border:1px solid rgba(0,255,255,0.2); border-radius:7px; overflow:hidden; position:relative;">
                <div id="speed-meter-fill" style="position:absolute; left:0; top:0; bottom:0; width:0%; background:linear-gradient(90deg, #0f0 0%, #0ff 30%, #ff0 60%, #f80 80%, #f0f 100%); transition:width 0.18s ease-out;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.55rem; color:#555; letter-spacing:1px; margin-top:5px; padding:0 2px; font-family:monospace;">
                <span>0</span><span>25</span><span>100</span><span>250</span><span>500</span><span>1 Gb+</span>
            </div>

            <!-- Results panel — reveals after first run -->
            <div id="speed-results" style="margin-top:22px; background:rgba(0,0,0,0.35); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); display:none;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:14px; text-align:center;">
                    <div>
                        <div id="speed-down" style="color:#0f0; font-weight:800; font-size:1.2rem; line-height:1;">—</div>
                        <div style="color:#888; font-size:0.55rem; letter-spacing:1.5px; margin-top:6px;">DOWN<br>Mbps</div>
                    </div>
                    <div>
                        <div id="speed-up" style="color:#0ff; font-weight:800; font-size:1.2rem; line-height:1;">—</div>
                        <div style="color:#888; font-size:0.55rem; letter-spacing:1.5px; margin-top:6px;">UP<br>Mbps</div>
                    </div>
                    <div>
                        <div id="speed-ping" style="color:#ff0; font-weight:800; font-size:1.2rem; line-height:1;">—</div>
                        <div style="color:#888; font-size:0.55rem; letter-spacing:1.5px; margin-top:6px;">LATENCY<br>ms</div>
                    </div>
                    <div>
                        <div id="speed-jitter" style="color:#fa0; font-weight:800; font-size:1.2rem; line-height:1;">—</div>
                        <div style="color:#888; font-size:0.55rem; letter-spacing:1.5px; margin-top:6px;">JITTER<br>ms</div>
                    </div>
                </div>
            </div>

            <!-- Start button -->
            <div style="margin-top:22px; display:flex; gap:8px; justify-content:center;">
                <button id="speed-start" class="action-btn" style="min-width:220px; padding:12px 20px; font-weight:700; letter-spacing:2px; font-size:0.78rem;" onclick="window._runSpeedTest()">START SPEED TEST</button>
            </div>

            <!-- Honest note (smaller) -->
            <p style="color:#555; font-size:0.6rem; text-align:center; margin-top:14px; line-height:1.5; letter-spacing:0.3px;">
                Measures real bytes between your device and the Nexus backend.<br>
                Bottlenecks (Wi-Fi, ISP, server) all reflect honestly in the number.
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
    if (serverEl) {
        // Cleaner server info: "Nexus · Dallas, US · IP 1.2.3.4" (no clutter)
        const loc = srv.loc && srv.loc !== 'unknown' ? srv.loc : 'unknown region';
        serverEl.innerHTML = `<b style="color:#fff;">NEXUS</b> · ${loc} · IP <code style="color:#9ce; background:rgba(0,0,0,0.3); padding:1px 5px; border-radius:3px; font-size:0.62rem;">${srv.ip}</code>`;
    }

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

    // QUALITY RATING — tells the user what their result actually means in plain language
    // instead of leaving them to interpret the bare Mbps number.
    const rateConnection = (down, up, ping) => {
        if (down <= 0) return { label: 'NO RESULT', color: '#888', desc: 'Test failed — backend unreachable.' };
        if (down >= 200 && ping < 30) return { label: 'EXCELLENT', color: '#0f0', desc: 'Pristine connection. Great for 4K streaming, gaming, large file uploads.' };
        if (down >= 100 && ping < 50) return { label: 'VERY GOOD', color: '#7fff00', desc: 'Strong link. Handles 1080p streams, video calls, and most workloads without issue.' };
        if (down >= 50  && ping < 80) return { label: 'GOOD',      color: '#0ff', desc: 'Solid for everyday browsing, HD streaming, and Zoom/Discord calls.' };
        if (down >= 25  && ping < 120) return { label: 'FAIR',     color: '#ff0', desc: 'Streaming HD works; video calls may stutter under load.' };
        if (down >= 10) return { label: 'BASIC', color: '#fa0', desc: 'Web browsing OK. Streaming is iffy, large downloads slow.' };
        return { label: 'POOR', color: '#f44', desc: 'Below modern broadband. Pages and videos may struggle.' };
    };
    const rating = rateConnection(finalDown, finalUp, lat.min);

    const existing = document.getElementById('speed-raw'); if (existing) existing.remove();
    const card = document.createElement('div');
    card.id = 'speed-raw';
    card.style.cssText = `margin-top:16px; padding:14px 16px; background:rgba(0,0,0,0.4); border-left:3px solid ${rating.color}; border-radius:4px; font-family:'Fira Code',monospace;`;
    card.innerHTML = `
        <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:6px;">
            <span style="color:${rating.color}; font-size:1.1rem; font-weight:800; letter-spacing:2px; text-shadow:0 0 10px ${rating.color};">${rating.label}</span>
            <span style="color:#888; font-size:0.66rem; letter-spacing:1px;">your connection quality</span>
        </div>
        <div style="color:#bbb; font-size:0.74rem; line-height:1.5; margin-bottom:10px;">${rating.desc}</div>
        <details style="margin-top:10px;">
            <summary style="color:#888; font-size:0.64rem; letter-spacing:1px; cursor:pointer; user-select:none;">RAW MEASUREMENTS (verify the math)</summary>
            <pre style="font-size:0.62rem; color:#9ce; line-height:1.7; margin:8px 0 0; white-space:pre-line;">${(window._lastDownLog || []).map(l => '  • ' + l).join('\n')}
Download = median of largest-size runs = ${finalDown.toFixed(1)} Mbps
Upload   = median of upload runs       = ${finalUp.toFixed(1)} Mbps
Latency  = min of 10 pings to /ping    = ${lat.min} ms (jitter ${lat.jitter} ms)

Math: bits / seconds / 1,000,000 = Mbps</pre>
        </details>`;
    if (window.guiContent) window.guiContent.querySelector('div').appendChild(card);
};
