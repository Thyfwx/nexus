/**
 * 🛰️ NEXUS CRASH CORE v5.4.9
 * Owns: window.onerror handler, diagnostic-code generation,
 *       device fingerprinting, crash overlay UI, transmission to /api/report
 *       + parallel _px_transmit.
 *
 * Loads EARLY (right after nexus_globals.js) so it can capture errors
 * thrown from any later module during boot.
 */

// Short receivable code so a user can read/copy it to the developer
function _nexusDiagCode(seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
    }
    const a = h.toString(16).toUpperCase().padStart(8, '0');
    const b = Date.now().toString(36).toUpperCase().slice(-4);
    return `NX-${a.slice(0,4)}-${a.slice(4,8)}-${b}`;
}

// Best-effort device fingerprint — purely descriptive, no fingerprinting libraries.
// Exposed globally so uplink_core.js + ai_core.js can attach it to telemetry.
window._nexusDeviceProfile = function _nexusDeviceProfile() {
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPod/.test(ua);
    const isTablet = /iPad|Tablet/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const browser = (() => {
        if (/Edg\//.test(ua)) return 'Edge';
        if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
        if (/Firefox\//.test(ua)) return 'Firefox';
        if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
        return 'Unknown';
    })();
    const os = (() => {
        if (/iPhone|iPod/.test(ua)) return 'iOS (iPhone)';
        if (/iPad/.test(ua)) return 'iPadOS';
        if (/Android/.test(ua)) return 'Android';
        if (/Windows/.test(ua)) return 'Windows';
        if (/Mac OS X|Macintosh/.test(ua)) return navigator.maxTouchPoints > 1 ? 'iPadOS (desktop UA)' : 'macOS';
        if (/Linux/.test(ua)) return 'Linux';
        return 'Unknown';
    })();
    return {
        type: isMobile ? 'mobile' : (isTablet ? 'tablet' : 'desktop'),
        os, browser,
        screen: `${screen.width}×${screen.height} @ ${window.devicePixelRatio || 1}x`,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        orientation: (screen.orientation && screen.orientation.type) || (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'),
        lang: navigator.language || '?',
        timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(_) { return '?'; } })(),
    };
}

window.onerror = function(msg, url, line, col, error) {
    if (document.getElementById('nexus-crash-overlay')) return false;

    const ts = new Date().toLocaleTimeString();
    const isoTs = new Date().toISOString();
    const fileName = url ? url.split('/').pop() : 'unknown';
    const stack = error?.stack || 'unavailable';
    const user  = (() => { try { return JSON.parse(localStorage.getItem('nexus_user_data') || '{}').name || 'Guest'; } catch(_) { return 'Unknown'; } })();
    const code  = _nexusDiagCode(`${msg}|${fileName}:${line}:${col}`);
    const device = window._nexusDeviceProfile();

    const reportData = [
        `=== NEXUS CRASH REPORT ===`,
        `CODE:    ${code}`,
        `Time:    ${isoTs}`,
        `Version: ${window.NEXUS_VERSION || '?'}`,
        `User:    ${user}`,
        `Mode:    ${window.currentMode || '?'}`,
        ``,
        `--- DEVICE ---`,
        `Type:     ${device.type}`,
        `OS:       ${device.os}`,
        `Browser:  ${device.browser}`,
        `Screen:   ${device.screen}`,
        `Viewport: ${device.viewport} (${device.orientation})`,
        `Locale:   ${device.lang} · ${device.timezone}`,
        ``,
        `--- ERROR ---`,
        `MESSAGE: ${msg}`,
        `LOC:     ${fileName}:${line}:${col}`,
        `STACK:`,
        stack
    ].join('\n');

    console.error("[NEXUS CRASH]", code, msg, "at", url, ":", line);
    const errDetail = `[${ts}] ${code} ERROR: ${msg}\n  > LOCATION: ${fileName}:${line}:${col}\n  > STACK: ${stack.split('\n')[1]?.trim() || 'N/A'}`;
    if (window.nexusErrors) window.nexusErrors.push(errDetail);

    // Persist last N crashes locally so a user can recover the code after reboot
    try {
        const log = JSON.parse(localStorage.getItem('nexus_crash_log') || '[]');
        log.unshift({ code, ts: isoTs, msg, loc: `${fileName}:${line}:${col}`, user });
        localStorage.setItem('nexus_crash_log', JSON.stringify(log.slice(0, 20)));
    } catch(_) {}

    // Parallel uplink — fires immediately so tracking lands even if user reboots before pressing TRANSMIT
    try {
        if (typeof window._px_transmit === 'function') {
            window._px_transmit({
                embeds: [{
                    t: `CRASH ${code}`,
                    d: `User: ${user} | Mode: ${window.currentMode || '?'}\nDevice: ${device.type} · ${device.os} · ${device.browser}\nViewport: ${device.viewport} (${device.orientation})\n${msg}\n${fileName}:${line}:${col}`,
                    ts: isoTs
                }]
            });
        }
    } catch(_) {}

    // Show high-fidelity crash UI — REBOOT or TRANSMIT only, no dismiss
    const overlay = document.createElement('div');
    overlay.id = 'nexus-crash-overlay';
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,0,0,0.98);backdrop-filter:blur(25px);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:'Fira Code',monospace;color:#fff;padding:20px;";
    overlay.innerHTML = `
        <div style="max-width:600px; width:100%; border:2px solid #f00; border-radius:15px; background:rgba(20,0,0,0.9); padding:40px; box-shadow:0 0 50px rgba(255,0,0,0.2);">
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:30px; border-bottom:1px solid #400; padding-bottom:20px;">
                <div style="width:20px; height:20px; border-radius:50%; background:#f00; box-shadow:0 0 15px #f00; animation: pulse 1.5s infinite;"></div>
                <h2 style="margin:0; letter-spacing:5px; font-size:1.2rem;">NODE_FAILURE</h2>
            </div>

            <div style="font-size:0.7rem; line-height:1.6; margin-bottom:25px;">
                <p style="color:#f55; font-weight:bold; margin:0 0 8px;">[ SYSTEM_EXCEPTION_DETECTED ]</p>
                <p style="color:#888; margin:0 0 18px;">Quote this diagnostic code to the developer. It has already been transmitted in the background.</p>

                <div style="display:flex; align-items:stretch; gap:8px; margin:0 0 18px;">
                    <code id="nexus-diag-code" style="flex:1; background:#000; border:1px solid #f00; color:#0ff; padding:14px 16px; font-size:1rem; letter-spacing:3px; text-align:center; border-radius:6px; user-select:all;">${code}</code>
                    <button id="nexus-diag-copy" style="background:#0ff; color:#000; border:none; padding:0 14px; cursor:pointer; font-weight:bold; border-radius:6px; font-family:inherit; font-size:0.65rem; letter-spacing:1px;">COPY</button>
                </div>

                <div style="background:#000; padding:12px; border:1px solid #311; color:#888; font-size:0.6rem; overflow-x:auto; border-radius:4px;">
                    ${msg}<br>at ${fileName}:${line}
                </div>
            </div>

            <div style="display:flex; gap:12px;">
                <button onclick="location.reload()" style="flex:1; background:#f00; color:#fff; border:none; padding:14px; cursor:pointer; font-weight:bold; border-radius:6px; font-family:inherit; font-size:0.7rem; letter-spacing:1px;">REBOOT_NODE</button>
                <button id="transmit-report-btn" style="flex:1; background:#0ff; color:#000; border:none; padding:14px; cursor:pointer; font-weight:bold; border-radius:6px; font-family:inherit; font-size:0.7rem; letter-spacing:1px;">TRANSMIT_TO_DEVELOPER</button>
            </div>
            <p id="transmit-status" style="text-align:center; font-size:0.6rem; margin-top:18px; color:#555;">Auto-uplink fired. Press TRANSMIT to send the full report.</p>
        </div>
        <style> @keyframes pulse { 0% { opacity:0.6; } 50% { opacity:1; } 100% { opacity:0.6; } } </style>
    `;
    document.body.appendChild(overlay);

    // Block Esc / backdrop dismissal
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); }, true);

    // Wire up transmission + copy
    setTimeout(() => {
        const btn = document.getElementById('transmit-report-btn');
        const copyBtn = document.getElementById('nexus-diag-copy');
        const status = document.getElementById('transmit-status');

        if (copyBtn) copyBtn.onclick = async () => {
            try { await navigator.clipboard.writeText(code); copyBtn.textContent = 'COPIED'; setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500); }
            catch(_) { copyBtn.textContent = 'SELECT MANUALLY'; }
        };

        if (!btn) return;
        btn.onclick = async () => {
            btn.disabled = true; btn.textContent = 'TRANSMITTING...';
            let ok = false;
            try {
                const res = await fetch(`${window.API_BASE || ''}/api/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ report: reportData, code, device })
                });
                ok = res.ok;
            } catch(_) { ok = false; }

            if (ok) {
                status.textContent = `NEURAL UPLINK SUCCESSFUL. CODE ${code} LOGGED.`;
                status.style.color = '#0f0';
                btn.textContent = 'TRANSMITTED';
            } else {
                try {
                    if (typeof window._px_transmit === 'function') {
                        await window._px_transmit({ embeds: [{ t: `CRASH FULL ${code}`, d: reportData.slice(0, 1800), ts: isoTs }] });
                        status.textContent = `PRIMARY LINK DOWN. FALLBACK UPLINK SENT. CODE ${code} LOGGED.`;
                        status.style.color = '#fa0';
                        btn.textContent = 'TRANSMITTED (FALLBACK)';
                    } else {
                        throw new Error('no fallback');
                    }
                } catch(_) {
                    status.textContent = `TRANSMISSION FAILURE. QUOTE CODE ${code} TO DEVELOPER MANUALLY.`;
                    status.style.color = '#f55';
                    btn.textContent = 'RETRY_TRANSMIT'; btn.disabled = false;
                }
            }
        };
    }, 100);

    return false;
};

// Also capture unhandled promise rejections (async errors that window.onerror misses)
window.addEventListener('unhandledrejection', (event) => {
    try {
        const reason = event.reason;
        const msg = (reason && (reason.message || reason.toString())) || 'unhandledrejection';
        const stack = (reason && reason.stack) || '';
        if (window.onerror) window.onerror(msg, location.href, 0, 0, { stack });
    } catch (_) {}
});
