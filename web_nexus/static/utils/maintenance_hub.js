// 🛰️ NEXUS MAINTENANCE HUB v5.5.57
// Live diagnostics of the user's own device. Compact 2-column layout that fits without scrolling.

window.startMaintenanceHub = function() {
    if (!window.guiContainer) return;
    stopAllGames();

    window.guiTitle.textContent = 'MAINTENANCE HUB · LIVE DIAGNOSTICS';
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    const cores = navigator.hardwareConcurrency || '?';
    const memHint = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'unknown';
    // OS detection — try userAgentData platform first (modern), fall back to UA string parse.
    const _detectOS = () => {
        try {
            const uad = navigator.userAgentData;
            if (uad?.platform) {
                // Async upgrade: full version string via high-entropy hints
                if (uad.getHighEntropyValues) {
                    uad.getHighEntropyValues(['platformVersion']).then(v => {
                        const el = document.getElementById('hub-os'); if (!el) return;
                        const ver = v.platformVersion || '';
                        if (uad.platform === 'macOS' && ver) {
                            // platformVersion is the FULL version like "14.5.0" or "26.0.1" — display it as-is
                            el.textContent = `macOS ${ver}`;
                        } else if (ver) {
                            el.textContent = `${uad.platform} ${ver}`;
                        }
                    }).catch(()=>{});
                }
                return uad.platform;
            }
        } catch (_) {}
        // UA-string fallback for browsers without userAgentData (Safari, Firefox)
        const ua = navigator.userAgent || '';
        const macMatch = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
        if (macMatch) return `macOS ${macMatch[1].replace(/_/g, '.')}`;
        const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
        if (winMatch) return `Windows NT ${winMatch[1]}`;
        if (/Mac OS X/.test(ua)) return 'macOS';
        if (/Windows/.test(ua)) return 'Windows';
        if (/Linux/.test(ua)) return 'Linux';
        if (/Android/.test(ua)) return 'Android';
        if (/iPhone|iPad/.test(ua)) return 'iOS';
        return navigator.platform || 'unknown';
    };
    const platform = _detectOS();

    const card = (title, body, tip) => `
        <div ${tip ? `data-hub-tip="${tip.replace(/"/g, '&quot;')}" onclick="window._hubShowTip(this)"` : ''}
             title="${(tip || '').replace(/"/g, '&quot;')}"
             style="background:rgba(0,0,0,0.4); padding:10px 12px; border:1px solid rgba(0,255,255,0.18); border-radius:8px; ${tip ? 'cursor:pointer;' : ''}">
            <div style="font-size:0.55rem; color:#666; letter-spacing:1.5px; margin-bottom:4px;">${title}${tip ? ' <span style="color:#0ff; opacity:0.6;">·</span>' : ''}</div>
            ${body}
            ${tip ? '<div class="hub-tip-body" style="display:none; margin-top:6px; padding-top:6px; border-top:1px solid rgba(0,255,255,0.12); font-size:0.65rem; color:#888; line-height:1.5;"></div>' : ''}
        </div>`;

    const kv = (k, v, id) => `
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; padding:2px 0;">
            <span style="color:#888;">${k}</span><span ${id ? `id="${id}"` : ''} style="color:#fff;">${v}</span>
        </div>`;

    window.guiContent.innerHTML = `
        <div style="padding:12px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">
                ${card('CPU', `
                    <div style="font-size:1.4rem; color:#0f0; font-weight:bold;">${cores} <span style="font-size:0.6rem; color:#666;">cores</span></div>
                    <div id="hub-cpu-load" style="font-size:0.62rem; color:#888; margin-top:2px;">load: probing…</div>
                `, 'Logical core count reported by the browser. The "load" line below is a JS busy-loop heuristic — it estimates how much spare time JS has, NOT actual system CPU usage. A real OS-level reading is not available from a web page.')}

                ${card('TAB JS HEAP', `
                    <div id="hub-mem-used" style="font-size:1.4rem; color:#0ff; font-weight:bold;">—</div>
                    <div id="hub-mem-line" style="font-size:0.62rem; color:#888; margin-top:2px;">device RAM: ${memHint}</div>
                `, 'This is the JavaScript heap used by THIS browser tab — NOT total system RAM or even total browser memory. Real system memory usage is not available from a web page. "Device RAM" below is a coarse browser-reported value (rounded to nearest 0.25/0.5/1/2/4/8 GB) used by sites for adaptive loading.')}

                ${card('NETWORK',
                    kv('Status',  'online', 'hub-net-online') +
                    `<div style="font-size:0.65rem; color:#aaa; margin-top:8px; line-height:1.5;">Browsers can't expose your real network bandwidth — only a rough rounded estimate that's often misleading. For an honest transfer-based measurement, run the <button onclick="event.stopPropagation(); window.startSpeedTest()" style="background:rgba(0,255,255,0.15); color:#0ff; border:1px solid rgba(0,255,255,0.4); padding:3px 10px; border-radius:4px; cursor:pointer; font-family:inherit; font-size:0.65rem; font-weight:600;">Speed Test</button> in the sidebar.</div>`,
                    'A web page cannot accurately read your network bandwidth. The Speed Test in the sidebar runs real transfers against the Nexus backend and reports actual measured speed.')}

                ${card('DISPLAY',
                    kv('Screen',   `${screen.width}×${screen.height}`) +
                    kv('Viewport', `${window.innerWidth}×${window.innerHeight}`, 'hub-viewport') +
                    kv('Pixel',    `${window.devicePixelRatio || 1}×`) +
                    kv('Color',    `${screen.colorDepth || '?'}-bit`),
                    'Your screen + browser window dimensions. Viewport updates if you rotate or resize.')}

                <div id="hub-battery-card" style="display:none; grid-column:span 2;">
                    ${card('BATTERY', `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="flex:1;">
                                ${kv('Charge',   '—', 'hub-bat-pct')}
                                ${kv('Charging', '—', 'hub-bat-chg')}
                                ${kv('Time',     '—', 'hub-bat-rem')}
                            </div>
                            <div style="flex:1; height:10px; background:rgba(0,0,0,0.6); border-radius:5px; overflow:hidden;">
                                <div id="hub-bat-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#f55,#ff0,#0f0); transition:width 0.4s;"></div>
                            </div>
                        </div>
                    `, 'Battery state on phones / laptops that report it. Charge percent + charging status + estimated time remaining.')}
                </div>

                <div style="grid-column:span 2;">
                    ${card('ENVIRONMENT',
                        kv('OS',        platform, 'hub-os') +
                        kv('Locale',    navigator.language || '—') +
                        kv('Timezone',  (()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return '—'}})()) +
                        kv('Touch',     `${navigator.maxTouchPoints || 0} pts`) +
                        kv('Nexus',     window.NEXUS_VERSION || '?') +
                        kv('Mode',      (window.currentMode || 'nexus').toUpperCase()),
                        'OS / browser context this session is running in.')}
                </div>
            </div>
        </div>`;

    _hubStartLivePoll();
};

// Click handler — toggles the inline description body for any card with a data-hub-tip
window._hubShowTip = function(el) {
    if (!el) return;
    const body = el.querySelector('.hub-tip-body');
    if (!body) return;
    const tip = el.getAttribute('data-hub-tip') || '';
    if (body.style.display === 'none' || !body.style.display) {
        body.textContent = tip;
        body.style.display = 'block';
    } else {
        body.style.display = 'none';
    }
};

let _hubLivePoll = null;

function _hubStartLivePoll() {
    if (_hubLivePoll) clearInterval(_hubLivePoll);

    const tick = async () => {
        if (!document.getElementById('hub-cpu-load')) {
            clearInterval(_hubLivePoll); _hubLivePoll = null; return;
        }
        const memEl = document.getElementById('hub-mem-used');
        if (memEl && performance && performance.memory) {
            const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            const cap  = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
            memEl.textContent = `${used} MB`;
            const lineEl = document.getElementById('hub-mem-line');
            if (lineEl) lineEl.textContent = `of ${cap} MB cap`;
        } else if (memEl) {
            memEl.textContent = 'n/a';
        }

        const cpuEl = document.getElementById('hub-cpu-load');
        if (cpuEl) {
            const t0 = performance.now(); let n = 0; const stop = t0 + 8;
            while (performance.now() < stop) n++;
            const score = Math.min(100, Math.max(1, Math.round(2_000_000 / (n + 1))));
            cpuEl.textContent = `JS contention estimate: ${score}%`;
        }

        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const onlineEl = document.getElementById('hub-net-online');
        if (onlineEl) {
            onlineEl.textContent = navigator.onLine ? 'online' : 'OFFLINE';
            onlineEl.style.color = navigator.onLine ? '#0f0' : '#f55';
        }
        // Network downlink panel removed — too misleading. Speed Test is the source of truth now.

        const vp = document.getElementById('hub-viewport');
        if (vp) vp.textContent = `${window.innerWidth}×${window.innerHeight}`;
    };

    tick();
    _hubLivePoll = setInterval(tick, 2000);
    if (window.registerPanelCleanup) {
        window.registerPanelCleanup(() => { if (_hubLivePoll) { clearInterval(_hubLivePoll); _hubLivePoll = null; } });
    }

    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            const card = document.getElementById('hub-battery-card');
            if (!card) return;
            card.style.display = '';
            const pct = Math.round((b.level || 0) * 100);
            const pctEl = document.getElementById('hub-bat-pct');
            if (pctEl) { pctEl.textContent = `${pct}%`; pctEl.style.color = pct < 20 ? '#f55' : (pct < 50 ? '#ff0' : '#0f0'); }
            const chgEl = document.getElementById('hub-bat-chg');
            if (chgEl) chgEl.textContent = b.charging ? 'yes' : 'no';
            const remEl = document.getElementById('hub-bat-rem');
            const rem = b.charging ? b.chargingTime : b.dischargingTime;
            if (remEl) remEl.textContent = (!isFinite(rem) || rem === 0) ? '—' :
                (rem > 3600 ? `${Math.round(rem/3600*10)/10}h` : `${Math.round(rem/60)}m`);
            const bar = document.getElementById('hub-bat-bar');
            if (bar) bar.style.width = `${pct}%`;
        }).catch(() => {});
    }
}

// Cleanup is now done via window.registerPanelCleanup (called in _hubStartLivePoll).
// stopAllGames drains that registry, so wrapping is no longer needed.
