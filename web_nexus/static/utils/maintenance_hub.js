// NEXUS MAINTENANCE HUB v5.6.0
// Dashboard-style device diagnostics. Compact horizontal stat rows.

window.startMaintenanceHub = function() {
    if (!window.guiContainer) return;
    stopAllGames();

    window.guiTitle.textContent = 'MAINTENANCE HUB';
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    const cores = navigator.hardwareConcurrency || null;
    const memGB = navigator.deviceMemory || null;

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
        const m = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
        if (m) return `macOS ${m[1].replace(/_/g, '.')}`;
        const w = ua.match(/Windows NT (\d+\.\d+)/);
        if (w) return `Windows NT ${w[1]}`;
        if (/Mac OS X/.test(ua)) return 'macOS';
        if (/Windows/.test(ua)) return 'Windows';
        if (/Linux/.test(ua)) return 'Linux';
        if (/Android/.test(ua)) return 'Android';
        if (/iPhone|iPad/.test(ua)) return 'iOS';
        return navigator.platform || '--';
    };
    const platform = _detectOS();

    // Architecture
    try {
        const uad = navigator.userAgentData;
        if (uad?.getHighEntropyValues) {
            uad.getHighEntropyValues(['architecture','bitness']).then(v => {
                const el = document.getElementById('hub-arch'); if (!el) return;
                const a = v.architecture || '';
                const b = v.bitness || '';
                if (a) el.textContent = a + (b ? '-' + b : '');
            }).catch(()=>{});
        }
    } catch(_){}

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const connType = conn?.effectiveType ? conn.effectiveType.toUpperCase() : '';
    const connDown = conn?.downlink || '';

    // Stat block: colored value on the left, label on the right
    const stat = (value, label, color, id) => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
            <span ${id ? `id="${id}"` : ''} style="color:${color}; font-weight:700; font-size:0.82rem; min-width:90px;">${value}</span>
            <span style="color:#666; font-size:0.68rem; letter-spacing:0.5px;">${label}</span>
        </div>`;

    window.guiContent.innerHTML = `
        <div style="padding:14px 16px; max-width:380px; margin:0 auto;">

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; margin-bottom:14px;">
                <div style="text-align:center; padding:10px; background:rgba(0,255,0,0.04); border-radius:8px;">
                    <div style="font-size:1.8rem; color:#0f0; font-weight:800; line-height:1;">${cores || '--'}</div>
                    <div style="font-size:0.58rem; color:#666; letter-spacing:1px; margin-top:4px;">CPU CORES</div>
                </div>
                <div style="text-align:center; padding:10px; background:rgba(0,255,255,0.04); border-radius:8px;">
                    <div style="font-size:1.8rem; color:#0ff; font-weight:800; line-height:1;">${memGB || '--'}<span style="font-size:0.7rem; color:#666;"> GB</span></div>
                    <div style="font-size:0.58rem; color:#666; letter-spacing:1px; margin-top:4px;">RAM</div>
                </div>
            </div>

            <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:6px 14px; margin-bottom:12px;">
                ${stat(`<span id="hub-arch"></span>`, 'architecture', '#888')}
                ${stat('<span id="hub-cpu-load">--</span>', 'thread load', '#888')}
                ${stat('<span id="hub-mem-heap">--</span>', 'tab JS heap', '#888')}
                ${stat(`<span id="hub-os">${platform}</span>`, 'operating system', '#ddd')}
                ${stat(navigator.language || '--', 'language', '#ddd')}
                ${stat((()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return '--'}})(), 'timezone', '#ddd')}
                ${stat(`${screen.width}x${screen.height}`, 'screen', '#ddd')}
                ${stat(`<span id="hub-viewport">${window.innerWidth}x${window.innerHeight}</span>`, 'viewport', '#ddd')}
                ${stat(`${window.devicePixelRatio || 1}x`, 'pixel ratio', '#ddd')}
            </div>

            <!-- Network -->
            <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 14px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span style="width:8px; height:8px; border-radius:50%; background:#0f0; box-shadow:0 0 6px #0f0;" id="hub-net-dot"></span>
                    <span id="hub-net-online" style="color:#0f0; font-size:0.75rem; font-weight:700;">ONLINE</span>
                    ${connType ? `<span style="color:#888; font-size:0.65rem; margin-left:auto;">${connType}${connDown ? ' · ' + connDown + ' Mbps' : ''}</span>` : ''}
                </div>
                <a href="speedtest.html"
                   style="display:block; padding:9px; text-align:center; background:rgba(0,255,255,0.06); color:#0ff; border:1px solid rgba(0,255,255,0.25); border-radius:5px; font-size:0.68rem; font-weight:700; letter-spacing:2px; text-decoration:none; transition:0.15s;"
                   onmouseover="this.style.background='rgba(0,255,255,0.14)';"
                   onmouseout="this.style.background='rgba(0,255,255,0.06)';">
                    RUN SPEED TEST
                </a>
            </div>

            <!-- Battery (hidden until API responds) -->
            <div id="hub-battery-card" style="display:none; background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 14px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span id="hub-bat-pct" style="font-size:1.3rem; font-weight:800; color:#0f0; min-width:50px;">--</span>
                    <div style="flex:1;">
                        <div style="height:8px; background:rgba(0,0,0,0.5); border-radius:4px; overflow:hidden;">
                            <div id="hub-bat-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#f55 0%,#ff0 50%,#0f0 100%); transition:width 0.4s; border-radius:4px;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.58rem; color:#666; margin-top:4px;">
                            <span id="hub-bat-status">--</span>
                            <span id="hub-bat-rem">--</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="text-align:center; font-size:0.55rem; color:#444; letter-spacing:1px; margin-top:4px;">
                ${window.NEXUS_VERSION || ''} · ${(window.currentMode || 'nexus').toUpperCase()}
            </div>

        </div>`;

    _hubStartLivePoll();
};

let _hubLivePoll = null;

function _hubStartLivePoll() {
    if (_hubLivePoll) clearInterval(_hubLivePoll);

    const tick = () => {
        if (!document.getElementById('hub-cpu-load')) {
            clearInterval(_hubLivePoll); _hubLivePoll = null; return;
        }

        const heapEl = document.getElementById('hub-mem-heap');
        if (heapEl && performance && performance.memory) {
            heapEl.textContent = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(0) + ' MB';
        }

        const cpuEl = document.getElementById('hub-cpu-load');
        if (cpuEl && navigator.hardwareConcurrency) {
            const t0 = performance.now(); let n = 0; const stop = t0 + 8;
            while (performance.now() < stop) n++;
            const score = Math.min(100, Math.max(1, Math.round(2_000_000 / (n + 1))));
            cpuEl.textContent = `~${score}%`;
        }

        const onlineEl = document.getElementById('hub-net-online');
        const dotEl = document.getElementById('hub-net-dot');
        if (onlineEl) {
            const on = navigator.onLine;
            onlineEl.textContent = on ? 'ONLINE' : 'OFFLINE';
            onlineEl.style.color = on ? '#0f0' : '#f55';
            if (dotEl) { dotEl.style.background = on ? '#0f0' : '#f55'; dotEl.style.boxShadow = `0 0 6px ${on ? '#0f0' : '#f55'}`; }
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
            const pctEl = document.getElementById('hub-bat-pct');
            if (pctEl) {
                pctEl.textContent = `${pct}%`;
                pctEl.style.color = pct < 20 ? '#f55' : (pct < 50 ? '#ff0' : '#0f0');
            }
            const statusEl = document.getElementById('hub-bat-status');
            if (statusEl) statusEl.textContent = b.charging ? 'Charging' : 'On Battery';
            const remEl = document.getElementById('hub-bat-rem');
            const rem = b.charging ? b.chargingTime : b.dischargingTime;
            if (remEl) remEl.textContent = (!isFinite(rem) || rem === 0) ? '' :
                (rem > 3600 ? `~${Math.round(rem/3600*10)/10}h left` : `~${Math.round(rem/60)}m left`);
            const bar = document.getElementById('hub-bat-bar');
            if (bar) bar.style.width = `${pct}%`;
        }).catch(() => {});
    }
}
