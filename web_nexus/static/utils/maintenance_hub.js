// NEXUS MAINTENANCE HUB v5.6.0

window.startMaintenanceHub = function() {
    if (!window.guiContainer) return;
    stopAllGames();

    window.guiTitle.textContent = 'MAINTENANCE HUB';
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    const cores = navigator.hardwareConcurrency || null;
    const memGB = navigator.deviceMemory || null;

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

    // Row: label then value with natural spacing. Tap rows with tips to reveal info.
    const stat = (label, value, id, tip) => `
        <div class="hub-row" ${tip ? 'data-hub-tip="' + tip.replace(/"/g, '&quot;') + '"' : ''}
             style="padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.03); ${tip ? 'cursor:pointer;' : ''}">
            <div style="display:flex; align-items:center; gap:10px; font-size:0.72rem;">
                <span style="color:#666;">${label}</span>
                <span ${id ? 'id="' + id + '"' : ''} style="color:#ccc;">${value}</span>
                ${tip ? '<span style="color:#333; font-size:0.55rem; margin-left:auto;">i</span>' : ''}
            </div>
            ${tip ? '<div class="hub-tip" style="display:none; font-size:0.6rem; color:#668; padding:4px 0 2px; line-height:1.4;"></div>' : ''}
        </div>`;

    window.guiContent.innerHTML = `
        <div style="padding:14px 16px; max-width:380px; margin:0 auto;">

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; margin-bottom:14px;">
                <div style="text-align:center; padding:10px; background:rgba(0,255,0,0.04); border-radius:8px;">
                    <div style="font-size:1.8rem; color:#0f0; font-weight:800; line-height:1;">${cores || '--'}</div>
                    <div style="font-size:0.55rem; color:#555; letter-spacing:1px; margin-top:4px;">CPU CORES</div>
                </div>
                <div style="text-align:center; padding:10px; background:rgba(0,255,255,0.04); border-radius:8px;">
                    <div style="font-size:1.8rem; color:#0ff; font-weight:800; line-height:1;">${memGB || '--'}<span style="font-size:0.7rem; color:#555;"> GB</span></div>
                    <div style="font-size:0.55rem; color:#555; letter-spacing:1px; margin-top:4px;">RAM</div>
                </div>
            </div>

            <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:4px 14px; margin-bottom:12px;">
                ${stat('Architecture', '<span id="hub-arch"></span>', null, 'Chip type — arm (Apple Silicon, phones) or x86 (Intel/AMD).')}
                ${stat('Thread Load', '<span id="hub-cpu-load">--</span>', null, 'How busy the JS thread is right now. Not real CPU usage — browsers can\'t report that.')}
                ${stat('Tab Heap', '<span id="hub-mem-heap">--</span>', null, 'JavaScript memory used by this tab only. Not your total system RAM.')}
                ${stat('OS', '<span id="hub-os">${platform}</span>', null, 'Detected from browser metadata. May not show the exact version on all browsers.')}
                ${stat('Language', navigator.language || '--')}
                ${stat('Timezone', (()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return '--'}})())}
                ${stat('Screen', '${screen.width}x${screen.height}', null, 'Physical display resolution.')}
                ${stat('Viewport', '<span id="hub-viewport">${window.innerWidth}x${window.innerHeight}</span>', null, 'Browser window size. Updates live if you resize.')}
            </div>

            <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 14px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span style="width:8px; height:8px; border-radius:50%; background:#0f0; box-shadow:0 0 6px #0f0;" id="hub-net-dot"></span>
                    <span id="hub-net-online" style="color:#0f0; font-size:0.72rem; font-weight:600;">ONLINE</span>
                    ${connType ? '<span style="color:#666; font-size:0.62rem; margin-left:auto;">' + connType + (connDown ? ' · ~' + connDown + ' Mbps' : '') + '</span>' : ''}
                </div>
                <a href="speedtest.html"
                   style="display:block; padding:9px; text-align:center; background:rgba(0,255,255,0.06); color:#0ff; border:1px solid rgba(0,255,255,0.25); border-radius:5px; font-size:0.68rem; font-weight:600; letter-spacing:2px; text-decoration:none; transition:0.15s;"
                   onmouseover="this.style.background='rgba(0,255,255,0.14)';"
                   onmouseout="this.style.background='rgba(0,255,255,0.06)';">
                    RUN SPEED TEST
                </a>
            </div>

            <div id="hub-battery-card" style="display:none; background:rgba(0,0,0,0.3); border-radius:6px; padding:10px 14px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span id="hub-bat-pct" style="font-size:1.3rem; font-weight:800; color:#0f0; min-width:50px;">--</span>
                    <div style="flex:1;">
                        <div style="height:8px; background:rgba(0,0,0,0.5); border-radius:4px; overflow:hidden;">
                            <div id="hub-bat-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#f55 0%,#ff0 50%,#0f0 100%); transition:width 0.4s; border-radius:4px;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.58rem; color:#555; margin-top:4px;">
                            <span id="hub-bat-status">--</span>
                            <span id="hub-bat-rem">--</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="text-align:center; font-size:0.55rem; color:#444; letter-spacing:1px;">
                ${window.NEXUS_VERSION || ''} · <span id="hub-mode">${(window.currentMode || 'nexus').toUpperCase()}</span>
            </div>
        </div>`;

    // Wire up tappable tips
    document.querySelectorAll('.hub-row[data-hub-tip]').forEach(row => {
        row.addEventListener('click', () => {
            const tip = row.querySelector('.hub-tip');
            if (!tip) return;
            const showing = tip.style.display === 'block';
            // Close all other tips first
            document.querySelectorAll('.hub-tip').forEach(t => t.style.display = 'none');
            document.querySelectorAll('.hub-row .hub-i').forEach(i => { if (i) i.style.color = '#333'; });
            if (!showing) {
                tip.textContent = row.getAttribute('data-hub-tip');
                tip.style.display = 'block';
            }
        });
    });

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
            if (dotEl) { dotEl.style.background = on ? '#0f0' : '#f55'; dotEl.style.boxShadow = '0 0 6px ' + (on ? '#0f0' : '#f55'); }
        }

        const vp = document.getElementById('hub-viewport');
        if (vp) vp.textContent = window.innerWidth + 'x' + window.innerHeight;

        const modeEl = document.getElementById('hub-mode');
        if (modeEl) modeEl.textContent = (window.currentMode || 'nexus').toUpperCase();
    };

    tick();
    _hubLivePoll = setInterval(tick, 1000);
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
                pctEl.textContent = pct + '%';
                pctEl.style.color = pct < 20 ? '#f55' : (pct < 50 ? '#ff0' : '#0f0');
            }
            const statusEl = document.getElementById('hub-bat-status');
            if (statusEl) statusEl.textContent = b.charging ? 'Charging' : 'On Battery';
            const remEl = document.getElementById('hub-bat-rem');
            const rem = b.charging ? b.chargingTime : b.dischargingTime;
            if (remEl) remEl.textContent = (!isFinite(rem) || rem === 0) ? '' :
                (rem > 3600 ? '~' + Math.round(rem/3600*10)/10 + 'h left' : '~' + Math.round(rem/60) + 'm left');
            const bar = document.getElementById('hub-bat-bar');
            if (bar) bar.style.width = pct + '%';
        }).catch(() => {});
    }
}
