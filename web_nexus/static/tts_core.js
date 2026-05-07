/**
 * 🛰️ NEXUS TTS CORE v5.4.9
 * Owns: voice/rate/pitch/volume settings, browser SpeechSynthesis playback,
 *       settings-panel hookup, persistence in localStorage.
 *
 * Replaces the old HF-only playback so settings actually change the sound.
 */
(function () {
    const KEY = 'nexus_tts_v2';

    function loadPrefs() {
        try {
            return Object.assign({ enabled: false, voice: '', rate: 1, pitch: 1, volume: 1 },
                                 JSON.parse(localStorage.getItem(KEY) || '{}'));
        } catch { return { enabled: false, voice: '', rate: 1, pitch: 1, volume: 1 }; }
    }
    function savePrefs(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

    let prefs = loadPrefs();
    let voicesCache = [];

    function refreshVoices() {
        if (!('speechSynthesis' in window)) return [];
        voicesCache = window.speechSynthesis.getVoices() || [];
        return voicesCache;
    }

    function pickVoice() {
        if (!voicesCache.length) refreshVoices();
        if (prefs.voice) {
            const found = voicesCache.find(v => v.name === prefs.voice);
            if (found) return found;
        }
        // Fallback: prefer English voices, then anything
        return voicesCache.find(v => /en[-_]/i.test(v.lang)) || voicesCache[0] || null;
    }

    function speak(text) {
        if (!prefs.enabled || !('speechSynthesis' in window)) return;
        if (!text) return;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(String(text).slice(0, 1500));
            const v = pickVoice();
            if (v) u.voice = v;
            u.rate   = +prefs.rate   || 1;
            u.pitch  = +prefs.pitch  || 1;
            u.volume = +prefs.volume || 1;
            window.speechSynthesis.speak(u);
        } catch (e) { console.warn('[TTS] speak error', e); }
    }

    function preview() {
        const wasEnabled = prefs.enabled;
        prefs.enabled = true;
        speak('Nexus voice channel test. Identity confirmed.');
        prefs.enabled = wasEnabled;
    }

    function toggle() {
        prefs.enabled = !prefs.enabled;
        savePrefs(prefs);
        renderToggleButton();
        if (prefs.enabled) speak('Voice output enabled.');
        else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function resetSliders() {
        prefs.rate = 1; prefs.pitch = 1; prefs.volume = 1;
        savePrefs(prefs);
        bindSliders();
    }

    function renderToggleButton() {
        const btn = document.getElementById('tts-toggle');
        if (!btn) return;
        btn.classList.toggle('active', !!prefs.enabled);
        const lbl = btn.querySelector('.fp-toggle-state');
        if (lbl) lbl.textContent = prefs.enabled ? 'ON' : 'OFF';
    }

    function bindSliders() {
        const map = [
            ['tts-rate',   'rate',   2],
            ['tts-pitch',  'pitch',  2],
            ['tts-volume', 'volume', 2],
        ];
        for (const [id, key, dec] of map) {
            const el = document.getElementById(id);
            const out = document.getElementById(`${id}-val`);
            if (!el) continue;
            el.value = prefs[key];
            if (out) out.textContent = (+prefs[key]).toFixed(dec);
            el.oninput = () => {
                prefs[key] = +el.value;
                if (out) out.textContent = (+prefs[key]).toFixed(dec);
                savePrefs(prefs);
            };
        }
    }

    function bindVoicePicker() {
        const sel = document.getElementById('tts-voice');
        if (!sel) return;
        const _isPremium = v => /(premium|enhanced|neural|siri|natural)/i.test(`${v.name} ${v.lang}`);
        const fillOpts = () => {
            refreshVoices();
            // Sort: premium voices first, then English voices, then everything else
            const sorted = voicesCache.slice().sort((a, b) => {
                const ap = _isPremium(a) ? 0 : 1;
                const bp = _isPremium(b) ? 0 : 1;
                if (ap !== bp) return ap - bp;
                const ae = /^en/i.test(a.lang) ? 0 : 1;
                const be = /^en/i.test(b.lang) ? 0 : 1;
                if (ae !== be) return ae - be;
                return a.name.localeCompare(b.name);
            });
            const premiumGroup = sorted.filter(_isPremium);
            const stdGroup     = sorted.filter(v => !_isPremium(v));
            const optHtml = (v) => `<option value="${v.name}">${_isPremium(v) ? '✨ ' : ''}${v.name} — ${v.lang}${v.default ? ' (default)' : ''}</option>`;
            sel.innerHTML = (premiumGroup.length
                ? `<optgroup label="Premium / Natural voices">${premiumGroup.map(optHtml).join('')}</optgroup><optgroup label="Standard voices">${stdGroup.map(optHtml).join('')}</optgroup>`
                : sorted.map(optHtml).join(''))
                || '<option value="">No voices available in this browser</option>';
            if (prefs.voice && voicesCache.find(v => v.name === prefs.voice)) sel.value = prefs.voice;
            else if (voicesCache.length) { prefs.voice = sel.value; savePrefs(prefs); }
        };
        fillOpts();
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = fillOpts;
        }
        sel.onchange = () => { prefs.voice = sel.value; savePrefs(prefs); };
    }

    // Public surface
    window.NexusTTS = {
        speak, preview, toggle, resetSliders,
        getPrefs: () => ({ ...prefs }),
        bindUI() {  // called when settings panel opens
            renderToggleButton();
            bindSliders();
            bindVoicePicker();
        },
    };

    // First voice list often arrives async — warm it up at boot
    if ('speechSynthesis' in window) {
        refreshVoices();
        setTimeout(refreshVoices, 500);
    }
})();
