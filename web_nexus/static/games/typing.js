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

    // Mode select screen
    const modeBtn = (label, sub, mode) => `
        <button onclick="window._startTypeMode(${JSON.stringify(mode).replace(/"/g, '&quot;')})"
            style="flex:1; min-width:120px; padding:16px 12px; background:rgba(0,255,255,0.04); border:1px solid rgba(0,255,255,0.2); border-radius:8px; cursor:pointer; font-family:'Fira Code',monospace; text-align:center; transition:0.15s; color:#ccc;"
            onmouseover="this.style.borderColor='#0ff'; this.style.background='rgba(0,255,255,0.1)';"
            onmouseout="this.style.borderColor='rgba(0,255,255,0.2)'; this.style.background='rgba(0,255,255,0.04)';">
            <div style="font-size:1.3rem; font-weight:800; color:#0ff;">${label}</div>
            <div style="font-size:0.6rem; color:#666; margin-top:4px; letter-spacing:1px;">${sub}</div>
        </button>`;

    guiContent.innerHTML = `
        <div style="padding:20px 16px; max-width:480px; margin:0 auto;">
            <div style="text-align:center; margin-bottom:20px;">
                <div style="font-size:0.7rem; color:#888; letter-spacing:2px; margin-bottom:6px;">CHOOSE A MODE</div>
            </div>

            <div style="font-size:0.62rem; color:#666; letter-spacing:1.5px; margin-bottom:8px;">TIMED</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                ${modeBtn('15s', 'SPRINT', {type:'time',seconds:15})}
                ${modeBtn('30s', 'SHORT', {type:'time',seconds:30})}
                ${modeBtn('60s', 'STANDARD', {type:'time',seconds:60})}
                ${modeBtn('120s', 'ENDURANCE', {type:'time',seconds:120})}
            </div>

            <div style="font-size:0.62rem; color:#666; letter-spacing:1.5px; margin-bottom:8px;">WORD COUNT</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${modeBtn('25', 'WORDS', {type:'words',count:25})}
                ${modeBtn('50', 'WORDS', {type:'words',count:50})}
                ${modeBtn('100', 'WORDS', {type:'words',count:100})}
            </div>

            <p style="font-size:0.6rem; color:#444; text-align:center; margin-top:16px; line-height:1.5;">
                Timed: type as many words as you can before time runs out.<br>
                Word count: finish the passage as fast as you can.
            </p>
        </div>`;
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
