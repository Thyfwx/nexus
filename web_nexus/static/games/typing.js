// NEXUS TYPING TEST v2.0 — MonkeyType-style with mode selection
// 200+ word pool, timer/word-count modes, live WPM, leaderboard submission

const TYPE_WORDS = [
    // Common English
    'the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you',
    'do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my',
    'one','all','would','there','their','what','so','up','out','if','about','who','get','which',
    'go','me','when','make','can','like','time','no','just','him','know','take','people','into',
    'year','your','good','some','could','them','see','other','than','then','now','look','only',
    'come','its','over','think','also','back','after','use','two','how','our','work','first',
    'well','way','even','new','want','because','any','these','give','day','most','us','great',
    // Tech / coding
    'server','network','system','code','debug','deploy','build','test','data','cloud','stack',
    'docker','linux','proxy','cache','query','token','route','parse','render','fetch','async',
    'socket','buffer','thread','kernel','driver','module','config','script','binary','compile',
    'runtime','process','daemon','shell','terminal','console','output','input','stream','packet',
    'firewall','gateway','router','switch','bridge','tunnel','cipher','encrypt','decrypt','hash',
    'protocol','header','payload','request','response','status','error','warning','timeout',
    // Hardware
    'cpu','gpu','ram','disk','board','chip','wire','power','signal','clock','voltage','current',
    'solder','repair','diagnostic','component','capacitor','resistor','transistor','circuit',
    'motherboard','heatsink','thermal','battery','display','sensor','controller','interface',
    // Descriptive
    'fast','slow','broken','clean','secure','stable','active','offline','online','live','dead',
    'fresh','stale','heavy','light','sharp','smooth','rough','quiet','loud','bright','dark',
    'simple','complex','basic','advanced','modern','legacy','custom','default','manual','auto',
    // Action
    'run','stop','start','push','pull','send','load','save','read','write','copy','move',
    'delete','create','update','check','scan','mount','boot','sync','ping','trace','dump',
    'flash','wipe','clone','patch','lock','unlock','grant','revoke','block','allow','deny',
    // Abstract
    'speed','quality','control','access','power','memory','storage','network','security',
    'performance','reliability','efficiency','bandwidth','latency','throughput','capacity',
    'uptime','downtime','backup','restore','monitor','alert','notify','report','audit',
];

// typeTestActive and typeTimerInterval are declared in _lifecycle.js — reuse them
let _typeMode = null;   // { type: 'time', seconds: N } or { type: 'words', count: N }
let _typeTarget = '';
let _typeStart = 0;
let _typeErrors = 0;

function _generatePassage(wordCount) {
    const words = [];
    for (let i = 0; i < wordCount; i++) {
        words.push(TYPE_WORDS[Math.floor(Math.random() * TYPE_WORDS.length)]);
    }
    return words.join(' ');
}

function startTypingTest() {
    if (typeof stopAllGames === 'function') stopAllGames();
    typeTestActive = false;
    _typeMode = null;
    _typeTarget = '';
    _typeStart = 0;
    _typeErrors = 0;
    clearInterval(typeTimerInterval);

    const termInputWrap = document.querySelector('.terminal-input-wrapper');
    if (termInputWrap) { termInputWrap._origDisplay = termInputWrap.style.display; termInputWrap.style.display = 'none'; }

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'TYPING TEST';
    nexusCanvas.style.display = 'none';

    // Mode descriptions
    const MODE_INFO = {
        'time-15':  { label: '15s', sub: 'SPRINT', desc: 'Quick burst — type as fast as you can for 15 seconds. Tests peak speed under pressure.' },
        'time-30':  { label: '30s', sub: 'SHORT', desc: 'Short round — 30 seconds of typing. Good balance of speed and consistency.' },
        'time-60':  { label: '60s', sub: 'STANDARD', desc: 'The standard test — one full minute. The most common way to measure typing speed.' },
        'time-120': { label: '120s', sub: 'ENDURANCE', desc: 'Endurance run — 2 minutes of sustained typing. Tests stamina and consistency over time.' },
        'words-25': { label: '25', sub: 'WORDS', desc: 'Short passage — 25 random words. Finish as fast as you can. Great for quick practice.' },
        'words-50': { label: '50', sub: 'WORDS', desc: 'Medium passage — 50 words. A solid test of speed and accuracy without the time pressure.' },
        'words-100':{ label: '100', sub: 'WORDS', desc: 'Long passage — 100 words. The real deal. Measures sustained focus and typing endurance.' },
    };

    const modeBtn = (id) => `
        <button class="type-mode-btn" data-mode-id="${id}"
            style="flex:1; min-width:70px; padding:14px 10px; background:rgba(0,255,255,0.04); border:1px solid rgba(0,255,255,0.15); border-radius:8px; cursor:pointer; font-family:'Fira Code',monospace; text-align:center; transition:0.15s; color:#ccc;">
            <div style="font-size:1.2rem; font-weight:800; color:#0ff;">${MODE_INFO[id].label}</div>
            <div style="font-size:0.55rem; color:#666; margin-top:3px; letter-spacing:1px;">${MODE_INFO[id].sub}</div>
        </button>`;

    guiContent.innerHTML = `
        <div style="padding:20px 16px; max-width:480px; margin:0 auto;">
            <div style="text-align:center; margin-bottom:18px;">
                <div style="font-size:0.7rem; color:#888; letter-spacing:2px;">SELECT A MODE</div>
            </div>

            <div style="font-size:0.6rem; color:#555; letter-spacing:1.5px; margin-bottom:6px;">TIMED</div>
            <div style="display:flex; gap:6px; margin-bottom:14px;">
                ${modeBtn('time-15')}${modeBtn('time-30')}${modeBtn('time-60')}${modeBtn('time-120')}
            </div>

            <div style="font-size:0.6rem; color:#555; letter-spacing:1.5px; margin-bottom:6px;">WORD COUNT</div>
            <div style="display:flex; gap:6px; margin-bottom:14px;">
                ${modeBtn('words-25')}${modeBtn('words-50')}${modeBtn('words-100')}
            </div>

            <!-- Description of selected mode -->
            <div id="type-mode-desc" style="min-height:50px; padding:12px 14px; background:rgba(0,255,255,0.03); border:1px solid rgba(0,255,255,0.1); border-radius:8px; font-size:0.75rem; color:#888; line-height:1.6; margin-bottom:14px; text-align:center;">
                Tap a mode above to see what it does.
            </div>

            <!-- Start button — disabled until a mode is selected -->
            <button id="type-start-btn" disabled
                style="width:100%; padding:14px; font-family:'Fira Code',monospace; font-size:0.85rem; font-weight:700; letter-spacing:2px; background:rgba(0,255,255,0.06); border:2px solid rgba(0,255,255,0.2); color:#555; border-radius:8px; cursor:not-allowed; transition:0.15s;">
                SELECT A MODE
            </button>
        </div>`;

    // Wire up mode selection
    let selectedMode = null;
    document.querySelectorAll('.type-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-mode-id');
            const info = MODE_INFO[id];
            selectedMode = id;

            // Highlight selected, dim others
            document.querySelectorAll('.type-mode-btn').forEach(b => {
                b.style.borderColor = 'rgba(0,255,255,0.15)';
                b.style.background = 'rgba(0,255,255,0.04)';
            });
            btn.style.borderColor = '#0ff';
            btn.style.background = 'rgba(0,255,255,0.12)';

            // Show description
            const desc = document.getElementById('type-mode-desc');
            if (desc) {
                desc.textContent = info.desc;
                desc.style.color = '#aac';
                desc.style.borderColor = 'rgba(0,255,255,0.25)';
            }

            // Enable start button
            const startBtn = document.getElementById('type-start-btn');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'START';
                startBtn.style.cursor = 'pointer';
                startBtn.style.borderColor = '#0ff';
                startBtn.style.color = '#0ff';
                startBtn.style.background = 'rgba(0,255,255,0.08)';
            }
        });
    });

    // Wire start button
    document.getElementById('type-start-btn')?.addEventListener('click', () => {
        if (!selectedMode) return;
        const parts = selectedMode.split('-');
        if (parts[0] === 'time') {
            window._startTypeMode({ type: 'time', seconds: parseInt(parts[1]) });
        } else {
            window._startTypeMode({ type: 'words', count: parseInt(parts[1]) });
        }
    });
}

window._startTypeMode = function(mode) {
    _typeMode = mode;
    typeTestActive = true;
    _typeStart = 0;
    _typeErrors = 0;
    clearInterval(typeTimerInterval);

    // Generate passage
    if (mode.type === 'time') {
        _typeTarget = _generatePassage(200); // plenty of words for any timer
    } else {
        _typeTarget = _generatePassage(mode.count);
    }

    const limitLabel = mode.type === 'time' ? `${mode.seconds}s` : `${mode.count} words`;

    guiContent.innerHTML = `
        <div style="padding:14px 16px; max-width:520px; margin:0 auto;">
            <!-- Progress bar -->
            <div style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.62rem; color:#555; margin-bottom:4px;">
                    <span>${limitLabel}</span><span id="type-progress-pct">0%</span>
                </div>
                <div style="height:3px; background:#111; border-radius:2px;">
                    <div id="type-progress-bar" style="height:3px; width:0%; background:#0ff; border-radius:2px; transition:width 0.1s;"></div>
                </div>
            </div>

            <!-- Phrase display -->
            <div id="type-phrase-view" style="font-size:0.88rem; line-height:1.9; letter-spacing:0.03em; word-break:break-word; margin-bottom:14px; font-family:'Fira Code',monospace; max-height:180px; overflow-y:auto; scrollbar-width:none;"></div>

            <!-- Stats -->
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
                <div style="background:#0a0a1a; border:1px solid #1a1a2e; padding:8px; border-radius:6px;">
                    <div id="type-timer-val" style="font-size:1.4rem; font-weight:bold; color:#0ff;">${mode.type === 'time' ? mode.seconds + 's' : '--'}</div>
                    <div style="font-size:0.58rem; color:#555; letter-spacing:1px; margin-top:2px;">${mode.type === 'time' ? 'TIME LEFT' : 'ELAPSED'}</div>
                </div>
                <div style="background:#0a0a1a; border:1px solid #1a1a2e; padding:8px; border-radius:6px;">
                    <div id="type-wpm-val" style="font-size:1.4rem; font-weight:bold; color:#0ff;">0</div>
                    <div style="font-size:0.58rem; color:#555; letter-spacing:1px; margin-top:2px;">WPM</div>
                </div>
                <div style="background:#0a0a1a; border:1px solid #1a1a2e; padding:8px; border-radius:6px;">
                    <div id="type-acc-val" style="font-size:1.4rem; font-weight:bold; color:#0f0;">100%</div>
                    <div style="font-size:0.58rem; color:#555; letter-spacing:1px; margin-top:2px;">ACCURACY</div>
                </div>
            </div>

            <!-- Input -->
            <input id="type-own-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                   placeholder="start typing..."
                   style="width:100%; box-sizing:border-box; margin-top:14px; padding:12px 14px; font-family:'Fira Code',monospace; font-size:0.95rem; background:#000; color:#0ff; border:1px solid rgba(0,255,255,0.3); border-radius:8px; outline:none;">

            <!-- Result overlay -->
            <div id="type-result-overlay"></div>

            <!-- Buttons -->
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="window._startTypeMode(${JSON.stringify(_typeMode).replace(/"/g, '&quot;')})"
                    style="flex:1; padding:10px; font-family:'Fira Code',monospace; font-size:0.72rem; font-weight:600; letter-spacing:1.5px; background:transparent; border:1px solid #444; color:#888; border-radius:6px; cursor:pointer;">
                    RESTART</button>
                <button onclick="startTypingTest()"
                    style="flex:1; padding:10px; font-family:'Fira Code',monospace; font-size:0.72rem; font-weight:600; letter-spacing:1.5px; background:transparent; border:1px solid #444; color:#888; border-radius:6px; cursor:pointer;">
                    CHANGE MODE</button>
            </div>
        </div>`;

    // Render initial phrase
    _renderTypePhrase('');

    // Focus input
    setTimeout(() => {
        const inp = document.getElementById('type-own-input');
        if (inp) {
            inp.value = '';
            inp.focus();
            inp.addEventListener('input', () => {
                if (!_typeStart) {
                    _typeStart = Date.now();
                    typeTimerInterval = setInterval(_tickTypeTimer, 100);
                }
                _checkTyping(inp.value);
            });
        }
    }, 50);
};

function _renderTypePhrase(typed) {
    const target = _typeTarget;
    let chars = '';
    for (let i = 0; i < Math.min(target.length, typed.length + 80); i++) {
        if (i < typed.length) {
            if (typed[i] === target[i]) {
                chars += `<span style="color:#0f0">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
            } else {
                chars += `<span style="color:#f55;text-decoration:underline">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
            }
        } else if (i === typed.length) {
            chars += `<span style="color:#0ff;border-left:2px solid #0ff">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        } else {
            chars += `<span style="color:#333">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        }
    }
    const el = document.getElementById('type-phrase-view');
    if (el) el.innerHTML = chars;
}

function _tickTypeTimer() {
    if (!typeTestActive || !_typeStart) return;
    const elapsed = (Date.now() - _typeStart) / 1000;
    const timerEl = document.getElementById('type-timer-val');
    const inp = document.getElementById('type-own-input');
    const typed = inp ? inp.value : '';

    if (_typeMode.type === 'time') {
        const remain = Math.max(0, _typeMode.seconds - elapsed);
        if (timerEl) timerEl.textContent = `${Math.ceil(remain)}s`;
        // Progress
        const pct = Math.min(100, (elapsed / _typeMode.seconds) * 100);
        const bar = document.getElementById('type-progress-bar');
        const pctEl = document.getElementById('type-progress-pct');
        if (bar) bar.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;

        if (remain <= 0) {
            _finishTyping(typed, elapsed);
            return;
        }
    } else {
        if (timerEl) timerEl.textContent = `${Math.round(elapsed)}s`;
    }

    // Live WPM
    const words = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = elapsed > 1 ? Math.round(words / (elapsed / 60)) : 0;
    const wpmEl = document.getElementById('type-wpm-val');
    if (wpmEl) wpmEl.textContent = wpm;

    // Live accuracy
    const accEl = document.getElementById('type-acc-val');
    if (accEl && typed.length > 0) {
        const correct = [...typed].filter((c, i) => c === _typeTarget[i]).length;
        const acc = Math.round((correct / typed.length) * 100);
        accEl.textContent = `${acc}%`;
        accEl.style.color = acc >= 95 ? '#0f0' : acc >= 80 ? '#ff0' : '#f55';
    }
}

function _checkTyping(typed) {
    if (!typeTestActive) return;
    _renderTypePhrase(typed);

    // Count errors
    _typeErrors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== _typeTarget[i]) _typeErrors++;
    }

    // Word count mode: check if finished
    if (_typeMode.type === 'words' && typed.length >= _typeTarget.length) {
        const elapsed = (Date.now() - _typeStart) / 1000;
        _finishTyping(typed, elapsed);
        return;
    }

    // Progress for word count mode
    if (_typeMode.type === 'words') {
        const pct = Math.min(100, (typed.length / _typeTarget.length) * 100);
        const bar = document.getElementById('type-progress-bar');
        const pctEl = document.getElementById('type-progress-pct');
        if (bar) bar.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    }
}

function _finishTyping(typed, elapsed) {
    clearInterval(typeTimerInterval);
    typeTestActive = false;

    const inp = document.getElementById('type-own-input');
    if (inp) inp.disabled = true;

    const words = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = elapsed > 1 ? Math.round(words / (elapsed / 60)) : 0;
    const correct = [...typed].filter((c, i) => c === _typeTarget[i]).length;
    const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 0;
    const adjustedWpm = Math.round(wpm * (accuracy / 100));

    // Rating
    let rating, ratingColor;
    if (adjustedWpm >= 120) { rating = 'LEGENDARY'; ratingColor = '#f0f'; }
    else if (adjustedWpm >= 80) { rating = 'ELITE'; ratingColor = '#0f0'; }
    else if (adjustedWpm >= 60) { rating = 'FAST'; ratingColor = '#0ff'; }
    else if (adjustedWpm >= 40) { rating = 'SOLID'; ratingColor = '#ff0'; }
    else if (adjustedWpm >= 25) { rating = 'AVERAGE'; ratingColor = '#fa0'; }
    else { rating = 'BEGINNER'; ratingColor = '#f55'; }

    const modeLabel = _typeMode.type === 'time' ? `${_typeMode.seconds}s` : `${_typeMode.count} words`;

    const overlay = document.getElementById('type-result-overlay');
    if (overlay) {
        overlay.innerHTML = `
            <div style="margin-top:14px; padding:16px; border:2px solid ${ratingColor}; border-radius:8px; text-align:center; background:rgba(0,0,0,0.5);">
                <div style="color:${ratingColor}; font-size:1.2rem; font-weight:800; letter-spacing:3px; text-shadow:0 0 10px ${ratingColor};">${rating}</div>
                <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                    <div>
                        <div style="font-size:1.6rem; font-weight:800; color:#0ff;">${wpm}</div>
                        <div style="font-size:0.55rem; color:#666; letter-spacing:1px;">RAW WPM</div>
                    </div>
                    <div>
                        <div style="font-size:1.6rem; font-weight:800; color:#0f0;">${adjustedWpm}</div>
                        <div style="font-size:0.55rem; color:#666; letter-spacing:1px;">ADJ WPM</div>
                    </div>
                    <div>
                        <div style="font-size:1.6rem; font-weight:800; color:${accuracy >= 95 ? '#0f0' : accuracy >= 80 ? '#ff0' : '#f55'};">${accuracy}%</div>
                        <div style="font-size:0.55rem; color:#666; letter-spacing:1px;">ACCURACY</div>
                    </div>
                </div>
                <div style="margin-top:8px; font-size:0.65rem; color:#555;">${modeLabel} · ${elapsed.toFixed(1)}s · ${words} words · ${_typeErrors} errors</div>
            </div>`;
    }

    // Update the main stats
    const wpmEl = document.getElementById('type-wpm-val');
    if (wpmEl) wpmEl.textContent = adjustedWpm;
    const timerEl = document.getElementById('type-timer-val');
    if (timerEl) timerEl.textContent = _typeMode.type === 'time' ? '0s' : `${elapsed.toFixed(1)}s`;

    // Submit to leaderboard
    if (typeof window.submitScore === 'function') {
        window.submitScore('typing', adjustedWpm);
    }

    // Print to terminal
    if (typeof printToTerminal === 'function') {
        printToTerminal(`Typing test (${modeLabel}): ${adjustedWpm} WPM adjusted · ${wpm} raw · ${accuracy}% accuracy · ${elapsed.toFixed(1)}s`, 'conn-ok');
    }

    // Restore terminal input
    if (typeof _restoreTerminalInputBar === 'function') _restoreTerminalInputBar();
}

// Restore terminal input bar when test ends/closes
function _restoreTerminalInputBar() {
    const w = document.querySelector('.terminal-input-wrapper');
    if (w) w.style.display = w._origDisplay || '';
    typeTestActive = false;
    clearInterval(typeTimerInterval);
}
window._restoreTerminalInputBar = _restoreTerminalInputBar;
