// 🛰️ NEXUS MAINTENANCE HUB v5.5.57
// Live diagnostics of the user's own device. Compact 2-column layout that fits without scrolling.

window.startMaintenanceHub = function() {
    if (!window.guiContainer) return;
    stopAllGames();

    window.guiTitle.textContent = 'MAINTENANCE HUB · LIVE DIAGNOSTICS';
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    const cores = navigator.hardwareConcurrency || null;          // null = not reported by browser
    const memHint = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null;
    const colorDepth = screen.colorDepth || null;
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

    // Cards: clickable to expand. Subtle chevron in the header row indicates
    // it's expandable. Tip text reveals on click via _hubShowTip.
    const card = (title, body, tip) => `
        <div ${tip ? `data-hub-tip="${tip.replace(/"/g, '&quot;')}" onclick="window._hubShowTip(this)"` : ''}
             style="background:rgba(0,0,0,0.4); padding:11px 13px; border:1px solid rgba(0,255,255,0.18); border-radius:8px; ${tip ? 'cursor:pointer;' : ''} transition:border-color 0.15s, background 0.15s;"
             ${tip ? `onmouseover="this.style.borderColor='rgba(0,255,255,0.45)'; this.style.background='rgba(0,30,40,0.55)';" onmouseout="this.style.borderColor='rgba(0,255,255,0.18)'; this.style.background='rgba(0,0,0,0.4)';"` : ''}>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.58rem; color:#888; letter-spacing:1.5px; margin-bottom:6px; font-weight:600;">
                <span>${title}</span>
                ${tip ? '<span class="hub-chevron" style="color:#0ff; opacity:0.6; font-size:0.7rem; transition:transform 0.18s;">▾</span>' : ''}
            </div>
            ${body}
            ${tip ? '<div class="hub-tip-body" style="display:none; margin-top:8px; padding-top:8px; border-top:1px solid rgba(0,255,255,0.15); font-size:0.7rem; color:#9ce; line-height:1.55;"></div>' : ''}
        </div>`;

    const kv = (k, v, id) => `
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; padding:2px 0;">
            <span style="color:#888;">${k}</span><span ${id ? `id="${id}"` : ''} style="color:#fff;">${v}</span>
        </div>`;

    // Helper: dash for missing values (better than "?" or "unknown")
    const dash = '<span style="color:#444;">—</span>';

    // Detect architecture via high-entropy hints (Chrome/Edge). Falls back to UA parse.
    let _cpuArch = '';
    try {
        const uad = navigator.userAgentData;
        if (uad?.getHighEntropyValues) {
            uad.getHighEntropyValues(['architecture','bitness']).then(v => {
                const archEl = document.getElementById('hub-cpu-arch');
                if (!archEl) return;
                const a = v.architecture || '';
                const b = v.bitness || '';
                archEl.textContent = a ? (a + (b ? '-' + b : '')) : '';
            }).catch(()=>{});
        }
    } catch(_){}

    // Connection type from Network Information API (Chrome only)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const connType = conn ? (conn.effectiveType || '').toUpperCase() : '';

    window.guiContent.innerHTML = `
        <div style="padding:14px 12px; max-width:480px; margin:0 auto; overflow:hidden;">
            <div style="text-align:center; margin-bottom:14px; color:#888; font-size:0.65rem; letter-spacing:1px;">
                Click any card for details. Browsers limit what a web page can read.
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">
                ${card('CPU', `
                    <div style="font-size:1.4rem; color:#0f0; font-weight:bold;">${cores ? cores + ' <span style="font-size:0.6rem; color:#666;">cores</span>' : dash}</div>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
                        <span id="hub-cpu-arch" style="font-size:0.62rem; color:#888;"></span>
                        <span id="hub-cpu-load" style="font-size:0.62rem; color:#888;">${cores ? 'probing...' : ''}</span>
                    </div>
                `, 'Logical core count from the browser. Architecture (arm/x86) via high-entropy hints. The load value is a rough JS thread-availability estimate, not real CPU usage.')}

                ${card('MEMORY', `
                    <div style="font-size:1.4rem; color:#0ff; font-weight:bold;">${memHint || dash}</div>
                    <div id="hub-mem-line" style="font-size:0.62rem; color:#888; margin-top:4px;">device RAM (rounded by browser)</div>
                    <div id="hub-mem-used" style="font-size:0.58rem; color:#666; margin-top:2px;"></div>
                `, 'Device RAM is a coarse value the browser reports (rounded to 0.25/0.5/1/2/4/8 GB). The JS heap line shows memory used by this tab only — not total system RAM.')}

                ${card('NETWORK', `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            ${kv('Status', '<span style="color:#0f0;">online</span>', 'hub-net-online')}
                            ${connType ? kv('Type', connType) : ''}
                        </div>
                    </div>
                    <a href="speedtest.html" onclick="event.stopPropagation();"
                       style="display:block; margin-top:10px; padding:10px; text-align:center; background:rgba(0,255,255,0.08); color:#0ff; border:1px solid rgba(0,255,255,0.35); border-radius:6px; font-family:inherit; font-size:0.7rem; font-weight:700; letter-spacing:2px; text-decoration:none; transition:0.15s;"
                       onmouseover="this.style.background='rgba(0,255,255,0.18)'; this.style.boxShadow='0 0 12px rgba(0,255,255,0.3)';"
                       onmouseout="this.style.background='rgba(0,255,255,0.08)'; this.style.boxShadow='none';">
                        RUN SPEED TEST
                    </a>
                `, 'Browser-reported connection type (4G/3G/etc) when available. For real bandwidth, use the Speed Test — it measures actual bytes over your link.')}

                ${card('DISPLAY',
                    kv('Screen',   `${screen.width}x${screen.height}`) +
                    kv('Viewport', `${window.innerWidth}x${window.innerHeight}`, 'hub-viewport') +
                    kv('Pixel',    `${window.devicePixelRatio || 1}x`) +
                    kv('Color',    colorDepth ? `${colorDepth}-bit` : dash),
                    'Screen resolution, browser viewport, device pixel ratio, and color depth.')}

                <div id="hub-battery-card" style="display:none; grid-column:span 2;">
                    ${card('BATTERY', `
                        <div style="display:flex; align-items:center; gap:14px;">
                            <div style="flex:1;">
                                <div style="font-size:1.4rem; font-weight:bold;" id="hub-bat-pct-big">--</div>
                                <div style="font-size:0.6rem; color:#888; margin-top:2px;">
                                    <span id="hub-bat-chg-label">--</span> · <span id="hub-bat-rem">--</span> remaining
                                </div>
                            </div>
                            <div style="flex:0 0 100px; height:14px; background:rgba(0,0,0,0.6); border-radius:7px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
                                <div id="hub-bat-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#f55,#ff0,#0f0); transition:width 0.4s; border-radius:7px;"></div>
                            </div>
                        </div>
                    `, 'Battery level, charging status, and estimated time remaining. Only available on devices that expose the Battery API.')}
                </div>

                <div style="grid-column:span 2;">
                    ${card('ENVIRONMENT',
                        kv('OS',        platform || dash, 'hub-os') +
                        kv('Locale',    navigator.language || dash) +
                        kv('Timezone',  (()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return dash}})()) +
                        kv('Touch',     navigator.maxTouchPoints != null ? `${navigator.maxTouchPoints} pts` : dash) +
                        kv('Nexus',     window.NEXUS_VERSION || dash) +
                        kv('Mode',      (window.currentMode || 'nexus').toUpperCase()),
                        'OS, locale, timezone, and touch capability of this device.')}
                </div>
            </div>
        </div>`;

    _hubStartLivePoll();
};

// Click handler — toggles the inline description body + rotates the chevron
window._hubShowTip = function(el) {
    if (!el) return;
    const body = el.querySelector('.hub-tip-body');
    const chev = el.querySelector('.hub-chevron');
    if (!body) return;
    const tip = el.getAttribute('data-hub-tip') || '';
    const isOpen = body.style.display === 'block';
    if (!isOpen) {
        body.textContent = tip;
        body.style.display = 'block';
        if (chev) { chev.style.transform = 'rotate(180deg)'; chev.style.opacity = '1'; }
    } else {
        body.style.display = 'none';
        if (chev) { chev.style.transform = 'rotate(0deg)'; chev.style.opacity = '0.6'; }
    }
};

let _hubLivePoll = null;

function _hubStartLivePoll() {
    if (_hubLivePoll) clearInterval(_hubLivePoll);

    const tick = async () => {
        if (!document.getElementById('hub-cpu-load')) {
            clearInterval(_hubLivePoll); _hubLivePoll = null; return;
        }
        // Memory: show JS heap as a small secondary line
        const memEl = document.getElementById('hub-mem-used');
        if (memEl && performance && performance.memory) {
            const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(0);
            memEl.textContent = `tab JS heap: ${used} MB`;
        } else if (memEl) {
            memEl.textContent = '';
        }

        // CPU: rough thread-availability estimate
        const cpuEl = document.getElementById('hub-cpu-load');
        if (cpuEl) {
            const t0 = performance.now(); let n = 0; const stop = t0 + 8;
            while (performance.now() < stop) n++;
            const score = Math.min(100, Math.max(1, Math.round(2_000_000 / (n + 1))));
            cpuEl.textContent = `load ~${score}%`;
        }

        const onlineEl = document.getElementById('hub-net-online');
        if (onlineEl) {
            onlineEl.textContent = navigator.onLine ? 'online' : 'OFFLINE';
            onlineEl.style.color = navigator.onLine ? '#0f0' : '#f55';
        }

        const vp = document.getElementById('hub-viewport');
        if (vp) vp.textContent = `${window.innerWidth}x${window.innerHeight}`;
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
            const bigEl = document.getElementById('hub-bat-pct-big');
            if (bigEl) {
                bigEl.textContent = `${pct}%`;
                bigEl.style.color = pct < 20 ? '#f55' : (pct < 50 ? '#ff0' : '#0f0');
            }
            const chgEl = document.getElementById('hub-bat-chg-label');
            if (chgEl) chgEl.textContent = b.charging ? 'charging' : 'on battery';
            const remEl = document.getElementById('hub-bat-rem');
            const rem = b.charging ? b.chargingTime : b.dischargingTime;
            if (remEl) remEl.textContent = (!isFinite(rem) || rem === 0) ? '--' :
                (rem > 3600 ? `${Math.round(rem/3600*10)/10}h` : `${Math.round(rem/60)}m`);
            const bar = document.getElementById('hub-bat-bar');
            if (bar) bar.style.width = `${pct}%`;
        }).catch(() => {});
    }
}

// Cleanup is now done via window.registerPanelCleanup (called in _hubStartLivePoll).
// stopAllGames drains that registry, so wrapping is no longer needed.
