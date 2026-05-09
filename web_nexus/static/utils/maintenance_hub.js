// NEXUS MAINTENANCE HUB v5.6.0
// Clean device diagnostics. No expandable tips — info is inline and concise.

window.startMaintenanceHub = function() {
    if (!window.guiContainer) return;
    stopAllGames();

    window.guiTitle.textContent = 'MAINTENANCE HUB';
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    const cores = navigator.hardwareConcurrency || null;
    const memGB = navigator.deviceMemory || null;
    const colorDepth = screen.colorDepth || null;

    // OS detection
    const _detectOS = () => {
        try {
            const uad = navigator.userAgentData;
            if (uad?.platform) {
                if (uad.getHighEntropyValues) {
                    uad.getHighEntropyValues(['platformVersion']).then(v => {
                        const el = document.getElementById('hub-os'); if (!el) return;
                        const ver = v.platformVersion || '';
                        if (uad.platform === 'macOS' && ver) el.textContent = `macOS ${ver}`;
                        else if (ver) el.textContent = `${uad.platform} ${ver}`;
                    }).catch(()=>{});
                }
                return uad.platform;
            }
        } catch (_) {}
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

    // Architecture detection (async upgrade)
    try {
        const uad = navigator.userAgentData;
        if (uad?.getHighEntropyValues) {
            uad.getHighEntropyValues(['architecture','bitness']).then(v => {
                const el = document.getElementById('hub-cpu-arch'); if (!el) return;
                const a = v.architecture || '';
                const b = v.bitness || '';
                if (a) el.textContent = a + (b ? '-' + b : '');
            }).catch(()=>{});
        }
    } catch(_){}

    // Connection type
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const connType = conn?.effectiveType ? conn.effectiveType.toUpperCase() : '';
    const connDown = conn?.downlink ? conn.downlink + ' Mbps' : '';

    const dash = '<span style="color:#444;">--</span>';

    const row = (label, value, id) => `
        <div style="display:flex; justify-content:space-between; padding:3px 0; font-size:0.72rem;">
            <span style="color:#666;">${label}</span>
            <span ${id ? `id="${id}"` : ''} style="color:#ddd;">${value}</span>
        </div>`;

    window.guiContent.innerHTML = `
        <div style="padding:16px 14px; max-width:460px; margin:0 auto;">

            <!-- CPU -->
            <div style="background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:6px; border:1px solid rgba(0,255,255,0.12); margin-bottom:8px;">
                <div style="font-size:0.6rem; color:#888; letter-spacing:1.5px; font-weight:600; margin-bottom:8px;">CPU</div>
                <div style="display:flex; align-items:baseline; gap:10px;">
                    <span style="font-size:1.5rem; color:#0f0; font-weight:800;">${cores || dash}</span>
                    <span style="font-size:0.65rem; color:#666;">${cores ? 'logical cores' : 'not reported'}</span>
                    <span id="hub-cpu-arch" style="font-size:0.62rem; color:#888; margin-left:auto;"></span>
                </div>
                <div id="hub-cpu-load" style="font-size:0.58rem; color:#555; margin-top:4px;"></div>
            </div>

            <!-- MEMORY -->
            <div style="background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:6px; border:1px solid rgba(0,255,255,0.12); margin-bottom:8px;">
                <div style="font-size:0.6rem; color:#888; letter-spacing:1.5px; font-weight:600; margin-bottom:8px;">MEMORY</div>
                <div style="display:flex; align-items:baseline; gap:10px;">
                    <span style="font-size:1.5rem; color:#0ff; font-weight:800;">${memGB ? memGB + ' GB' : dash}</span>
                    <span style="font-size:0.65rem; color:#666;">${memGB ? 'device RAM' : 'not reported'}</span>
                </div>
                <div id="hub-mem-used" style="font-size:0.58rem; color:#555; margin-top:4px;"></div>
            </div>

            <!-- NETWORK + SPEED TEST -->
            <div style="background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:6px; border:1px solid rgba(0,255,255,0.12); margin-bottom:8px;">
                <div style="font-size:0.6rem; color:#888; letter-spacing:1.5px; font-weight:600; margin-bottom:8px;">NETWORK</div>
                ${row('Status', '<span id="hub-net-online" style="color:#0f0;">online</span>')}
                ${connType ? row('Type', connType) : ''}
                ${connDown ? row('Estimated', connDown) : ''}
                <a href="speedtest.html"
                   style="display:block; margin-top:10px; padding:10px; text-align:center; background:rgba(0,255,255,0.06); color:#0ff; border:1px solid rgba(0,255,255,0.3); border-radius:6px; font-size:0.7rem; font-weight:700; letter-spacing:2px; text-decoration:none; transition:0.15s;"
                   onmouseover="this.style.background='rgba(0,255,255,0.15)'; this.style.boxShadow='0 0 10px rgba(0,255,255,0.25)';"
                   onmouseout="this.style.background='rgba(0,255,255,0.06)'; this.style.boxShadow='none';">
                    RUN SPEED TEST
                </a>
            </div>

            <!-- DISPLAY -->
            <div style="background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:6px; border:1px solid rgba(0,255,255,0.12); margin-bottom:8px;">
                <div style="font-size:0.6rem; color:#888; letter-spacing:1.5px; font-weight:600; margin-bottom:8px;">DISPLAY</div>
                ${row('Screen', `${screen.width}x${screen.height}`)}
                ${row('Viewport', `${window.innerWidth}x${window.innerHeight}`, 'hub-viewport')}
                ${row('Pixel Ratio', `${window.devicePixelRatio || 1}x`)}
                ${row('Color Depth', colorDepth ? `${colorDepth}-bit` : dash)}
            </div>

            <!-- BATTERY (revealed by JS if available) -->
            <div id="hub-battery-card" style="display:none; background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:6px; border:1px solid rgba(0,255,255,0.12); margin-bottom:8px;">
                <div style="font-size:0.6rem; color:#888; letter-spacing:1.5px; font-weight:600; margin-bottom:8px;">BATTERY</div>
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:6px;">
                    <span id="hub-bat-pct" style="font-size:1.5rem; font-weight:800; color:#0f0;">--</span>
                    <div style="flex:1;">
                        <div style="height:10px; background:rgba(0,0,0,0.6); border-radius:5px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
                            <div id="hub-bat-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#f55 0%,#ff0 50%,#0f0 100%); transition:width 0.4s; border-radius:5px;"></div>
                        </div>
                    </div>
                </div>
                ${row('Status', '<span id="hub-bat-status">--</span>')}
                ${row('Time Left', '<span id="hub-bat-rem">--</span>')}
            </div>

            <!-- ENVIRONMENT -->
            <div style="background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:6px; border:1px solid rgba(0,255,255,0.12);">
                <div style="font-size:0.6rem; color:#888; letter-spacing:1.5px; font-weight:600; margin-bottom:8px;">ENVIRONMENT</div>
                ${row('OS', `<span id="hub-os">${platform || dash}</span>`)}
                ${row('Language', navigator.language || dash)}
                ${row('Timezone', (()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return dash}})())}
                ${row('Nexus', window.NEXUS_VERSION || dash)}
                ${row('Mode', (window.currentMode || 'nexus').toUpperCase())}
            </div>

        </div>`;

    _hubStartLivePoll();
};

let _hubLivePoll = null;

function _hubStartLivePoll() {
    if (_hubLivePoll) clearInterval(_hubLivePoll);

    const tick = async () => {
        if (!document.getElementById('hub-cpu-load')) {
            clearInterval(_hubLivePoll); _hubLivePoll = null; return;
        }

        // JS heap (tiny secondary line in MEMORY card)
        const memEl = document.getElementById('hub-mem-used');
        if (memEl && performance && performance.memory) {
            const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(0);
            memEl.textContent = `tab using ${used} MB JS heap`;
        } else if (memEl) {
            memEl.textContent = '';
        }

        // CPU load estimate
        const cpuEl = document.getElementById('hub-cpu-load');
        if (cpuEl && navigator.hardwareConcurrency) {
            const t0 = performance.now(); let n = 0; const stop = t0 + 8;
            while (performance.now() < stop) n++;
            const score = Math.min(100, Math.max(1, Math.round(2_000_000 / (n + 1))));
            cpuEl.textContent = `thread busy ~${score}%`;
        }

        // Online status
        const onlineEl = document.getElementById('hub-net-online');
        if (onlineEl) {
            onlineEl.textContent = navigator.onLine ? 'online' : 'OFFLINE';
            onlineEl.style.color = navigator.onLine ? '#0f0' : '#f55';
        }

        // Viewport live update
        const vp = document.getElementById('hub-viewport');
        if (vp) vp.textContent = `${window.innerWidth}x${window.innerHeight}`;
    };

    tick();
    _hubLivePoll = setInterval(tick, 2000);
    if (window.registerPanelCleanup) {
        window.registerPanelCleanup(() => { if (_hubLivePoll) { clearInterval(_hubLivePoll); _hubLivePoll = null; } });
    }

    // Battery
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            const card = document.getElementById('hub-battery-card');
            if (!card) return;
            card.style.display = '';
            const pct = Math.round((b.level || 0) * 100);
            const pctEl = document.getElementById('hub-bat-pct');
            if (pctEl) {
                pctEl.textContent = `${pct}%`;
                pctEl.style.color = pct < 20 ? '#f55' : (pct < 50 ? '#ff0' : '#0f0');
            }
            const statusEl = document.getElementById('hub-bat-status');
            if (statusEl) statusEl.textContent = b.charging ? 'Charging' : 'On Battery';
            const remEl = document.getElementById('hub-bat-rem');
            const rem = b.charging ? b.chargingTime : b.dischargingTime;
            if (remEl) remEl.textContent = (!isFinite(rem) || rem === 0) ? '--' :
                (rem > 3600 ? `${Math.round(rem/3600*10)/10} hours` : `${Math.round(rem/60)} min`);
            const bar = document.getElementById('hub-bat-bar');
            if (bar) bar.style.width = `${pct}%`;
        }).catch(() => {});
    }
}
