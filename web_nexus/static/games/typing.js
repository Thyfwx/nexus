// NEXUS TYPING TEST v3.0 — MonkeyType-style
// Clean flowing words, no visible input, minimal stats, Nexus dark theme

const TYPE_WORDS = [
    'the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you',
    'do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my',
    'one','all','would','there','their','what','so','up','out','if','about','who','get','which',
    'go','me','when','make','can','like','time','no','just','him','know','take','people','into',
    'year','your','good','some','could','them','see','other','than','then','now','look','only',
    'come','its','over','think','also','back','after','use','two','how','our','work','first',
    'well','way','even','new','want','because','any','these','give','day','most','us','great',
    'server','network','system','code','debug','deploy','build','test','data','cloud','stack',
    'docker','linux','proxy','cache','query','token','route','parse','render','fetch','async',
    'socket','buffer','thread','kernel','driver','module','config','script','binary','compile',
    'runtime','process','daemon','shell','terminal','console','output','input','stream','packet',
    'firewall','gateway','router','switch','bridge','tunnel','cipher','encrypt','decrypt','hash',
    'protocol','header','payload','request','response','status','error','warning','timeout',
    'cpu','gpu','ram','disk','board','chip','wire','power','signal','clock','voltage','current',
    'solder','repair','diagnostic','component','capacitor','resistor','circuit','motherboard',
    'fast','slow','broken','clean','secure','stable','active','offline','online','live','dead',
    'fresh','stale','heavy','light','sharp','smooth','rough','quiet','loud','bright','dark',
    'simple','complex','basic','advanced','modern','legacy','custom','default','manual','auto',
    'run','stop','start','push','pull','send','load','save','read','write','copy','move',
    'delete','create','update','check','scan','mount','boot','sync','ping','trace','dump',
    'flash','wipe','clone','patch','lock','unlock','grant','revoke','block','allow','deny',
    'speed','quality','control','access','power','memory','storage','security','performance',
    'reliability','efficiency','bandwidth','latency','throughput','capacity','uptime','monitor',
];

let _typeMode = null;
let _typeWords = [];
let _typeWordIdx = 0;
let _typeCharIdx = 0;
let _typeStart = 0;
let _typeErrors = 0;
let _typeTotal = 0;
let _typeCorrect = 0;
let _typeWpmHistory = [];
let _typeKeyHandler = null;

function _genWords(count) {
    const w = [];
    for (let i = 0; i < count; i++) w.push(TYPE_WORDS[Math.floor(Math.random() * TYPE_WORDS.length)]);
    return w;
}

function startTypingTest() {
    if (typeof stopAllGames === 'function') stopAllGames();
    typeTestActive = false;
    _typeMode = null;
    _typeStart = 0;
    _typeErrors = 0;
    _typeTotal = 0;
    _typeCorrect = 0;
    _typeWpmHistory = [];
    clearInterval(typeTimerInterval);
    if (_typeKeyHandler) { document.removeEventListener('keydown', _typeKeyHandler); _typeKeyHandler = null; }

    const termInputWrap = document.querySelector('.terminal-input-wrapper');
    if (termInputWrap) { termInputWrap._origDisplay = termInputWrap.style.display; termInputWrap.style.display = 'none'; }

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'TYPING TEST';
    nexusCanvas.style.display = 'none';

    // Mode select — clean tab style like MonkeyType
    guiContent.innerHTML = `
        <div style="padding:24px 16px; max-width:520px; margin:0 auto; text-align:center;">
            <!-- Mode tabs -->
            <div style="display:flex; gap:4px; justify-content:center; margin-bottom:8px;">
                <button class="tt-tab tt-tab-active" data-cat="time" style="padding:6px 14px; font-family:'Fira Code',monospace; font-size:0.68rem; font-weight:600; letter-spacing:1px; background:transparent; border:none; color:#0ff; cursor:pointer; border-bottom:2px solid #0ff;">time</button>
                <button class="tt-tab" data-cat="words" style="padding:6px 14px; font-family:'Fira Code',monospace; font-size:0.68rem; font-weight:600; letter-spacing:1px; background:transparent; border:none; color:#555; cursor:pointer; border-bottom:2px solid transparent;">words</button>
            </div>

            <!-- Time options -->
            <div id="tt-time-opts" style="display:flex; gap:6px; justify-content:center; margin-bottom:24px;">
                <button class="tt-opt" data-mode="time-15" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #333; color:#666; border-radius:4px; cursor:pointer;">15</button>
                <button class="tt-opt tt-opt-sel" data-mode="time-30" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #0ff; color:#0ff; border-radius:4px; cursor:pointer;">30</button>
                <button class="tt-opt" data-mode="time-60" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #333; color:#666; border-radius:4px; cursor:pointer;">60</button>
                <button class="tt-opt" data-mode="time-120" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #333; color:#666; border-radius:4px; cursor:pointer;">120</button>
            </div>
            <div id="tt-word-opts" style="display:none; gap:6px; justify-content:center; margin-bottom:24px;">
                <button class="tt-opt" data-mode="words-25" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #333; color:#666; border-radius:4px; cursor:pointer;">25</button>
                <button class="tt-opt tt-opt-sel" data-mode="words-50" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #0ff; color:#0ff; border-radius:4px; cursor:pointer;">50</button>
                <button class="tt-opt" data-mode="words-100" style="padding:6px 16px; font-family:'Fira Code',monospace; font-size:0.8rem; font-weight:700; background:transparent; border:1px solid #333; color:#666; border-radius:4px; cursor:pointer;">100</button>
            </div>

            <!-- Prompt -->
            <div style="color:#444; font-size:0.7rem; margin-bottom:20px;">click here or start typing</div>

            <!-- Word display area -->
            <div id="tt-words" style="font-family:'Fira Code',monospace; font-size:1.1rem; line-height:2; text-align:left; min-height:120px; color:#333; user-select:none; cursor:text;" tabindex="0"></div>

            <!-- Live stats bar -->
            <div id="tt-stats" style="display:flex; justify-content:center; gap:24px; margin-top:20px; font-family:'Fira Code',monospace; font-size:0.75rem; color:#444;">
                <span id="tt-wpm">0 wpm</span>
                <span id="tt-acc">100%</span>
                <span id="tt-timer">--</span>
            </div>

            <!-- Result area (hidden until done) -->
            <div id="tt-result" style="display:none;"></div>
        </div>`;

    // Default selection
    let selMode = 'time-30';

    // Tab switching
    document.querySelectorAll('.tt-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tt-tab').forEach(t => { t.style.color = '#555'; t.style.borderBottomColor = 'transparent'; t.classList.remove('tt-tab-active'); });
            tab.style.color = '#0ff'; tab.style.borderBottomColor = '#0ff'; tab.classList.add('tt-tab-active');
            const cat = tab.getAttribute('data-cat');
            document.getElementById('tt-time-opts').style.display = cat === 'time' ? 'flex' : 'none';
            document.getElementById('tt-word-opts').style.display = cat === 'words' ? 'flex' : 'none';
            // Select first in new category
            const firstOpt = document.querySelector(`#tt-${cat}-opts .tt-opt-sel`) || document.querySelector(`#tt-${cat}-opts .tt-opt`);
            if (firstOpt) { firstOpt.click(); }
        });
    });

    // Option selection
    document.querySelectorAll('.tt-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            const parent = opt.parentElement;
            parent.querySelectorAll('.tt-opt').forEach(o => { o.style.borderColor = '#333'; o.style.color = '#666'; o.classList.remove('tt-opt-sel'); });
            opt.style.borderColor = '#0ff'; opt.style.color = '#0ff'; opt.classList.add('tt-opt-sel');
            selMode = opt.getAttribute('data-mode');
            _prepareTest(selMode);
        });
    });

    // Prepare initial test
    _prepareTest(selMode);

    // Click word area to focus
    document.getElementById('tt-words')?.addEventListener('click', () => { _beginListening(selMode); });

    // Or just start typing
    const earlyHandler = (e) => {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            document.removeEventListener('keydown', earlyHandler);
            _beginListening(selMode);
            // Replay this keypress
            if (_typeKeyHandler) _typeKeyHandler(e);
        }
    };
    document.addEventListener('keydown', earlyHandler);
    // Store so we can clean up
    window._ttEarlyHandler = earlyHandler;
}

function _prepareTest(modeId) {
    const parts = modeId.split('-');
    const isTime = parts[0] === 'time';
    const val = parseInt(parts[1]);
    const count = isTime ? 150 : val;
    _typeWords = _genWords(count);
    _typeWordIdx = 0;
    _typeCharIdx = 0;
    _typeStart = 0;
    _typeErrors = 0;
    _typeTotal = 0;
    _typeCorrect = 0;
    _typeWpmHistory = [];
    typeTestActive = false;
    clearInterval(typeTimerInterval);

    // Reset stats
    const wpmEl = document.getElementById('tt-wpm'); if (wpmEl) wpmEl.textContent = '0 wpm';
    const accEl = document.getElementById('tt-acc'); if (accEl) { accEl.textContent = '100%'; accEl.style.color = '#444'; }
    const timerEl = document.getElementById('tt-timer');
    if (timerEl) timerEl.textContent = isTime ? `${val}s` : `0/${val}`;
    const resultEl = document.getElementById('tt-result'); if (resultEl) resultEl.style.display = 'none';

    _renderWords();
}

function _renderWords() {
    const el = document.getElementById('tt-words');
    if (!el) return;
    let html = '';
    // Show ~3 lines worth of words (from current word)
    const start = Math.max(0, _typeWordIdx - 2);
    const end = Math.min(_typeWords.length, _typeWordIdx + 25);
    for (let w = start; w < end; w++) {
        const word = _typeWords[w];
        if (w < _typeWordIdx) {
            // Already typed
            html += `<span style="color:#0f06;">${word}</span> `;
        } else if (w === _typeWordIdx) {
            // Current word — character by character
            for (let c = 0; c < word.length; c++) {
                if (c < _typeCharIdx) {
                    // Check if correct
                    html += `<span style="color:#0f0;">${word[c]}</span>`;
                } else if (c === _typeCharIdx) {
                    html += `<span style="color:#fff; border-bottom:2px solid #0ff;">${word[c]}</span>`;
                } else {
                    html += `<span style="color:#555;">${word[c]}</span>`;
                }
            }
            html += ' ';
        } else {
            // Upcoming
            html += `<span style="color:#333;">${word}</span> `;
        }
    }
    el.innerHTML = html;
}

function _beginListening(modeId) {
    if (typeTestActive) return;
    const parts = modeId.split('-');
    _typeMode = { type: parts[0], value: parseInt(parts[1]) };
    typeTestActive = true;
    _typeStart = Date.now();

    // Timer tick
    typeTimerInterval = setInterval(() => _tickTest(), 200);

    // Keyboard handler
    if (_typeKeyHandler) document.removeEventListener('keydown', _typeKeyHandler);
    _typeKeyHandler = (e) => {
        if (!typeTestActive) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Tab+Enter = restart
        if (e.key === 'Tab') { e.preventDefault(); startTypingTest(); return; }

        const word = _typeWords[_typeWordIdx];
        if (!word) return;

        if (e.key === ' ') {
            e.preventDefault();
            // Move to next word
            // Count remaining chars as errors
            if (_typeCharIdx < word.length) {
                _typeErrors += (word.length - _typeCharIdx);
                _typeTotal += (word.length - _typeCharIdx);
            }
            _typeWordIdx++;
            _typeCharIdx = 0;

            // Check if word-count mode is done
            if (_typeMode.type === 'words' && _typeWordIdx >= _typeMode.value) {
                _finishTest();
                return;
            }
            _renderWords();
            return;
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            if (_typeCharIdx > 0) _typeCharIdx--;
            _renderWords();
            return;
        }

        if (e.key.length === 1) {
            e.preventDefault();
            _typeTotal++;
            if (e.key === word[_typeCharIdx]) {
                _typeCorrect++;
                _typeCharIdx++;
                // Auto-advance if word complete
                if (_typeCharIdx >= word.length) {
                    _typeWordIdx++;
                    _typeCharIdx = 0;
                    if (_typeMode.type === 'words' && _typeWordIdx >= _typeMode.value) {
                        _finishTest();
                        return;
                    }
                }
            } else {
                _typeErrors++;
                _typeCharIdx++; // move forward but it'll show as wrong on next render
            }
            _renderWords();
        }
    };
    document.addEventListener('keydown', _typeKeyHandler);
}

function _tickTest() {
    if (!typeTestActive || !_typeStart) return;
    const elapsed = (Date.now() - _typeStart) / 1000;

    // WPM = (correct chars / 5) / minutes
    const wpm = elapsed > 0.5 ? Math.round((_typeCorrect / 5) / (elapsed / 60)) : 0;
    const wpmEl = document.getElementById('tt-wpm');
    if (wpmEl) { wpmEl.textContent = `${wpm} wpm`; wpmEl.style.color = wpm > 0 ? '#0ff' : '#444'; }

    // Accuracy
    const acc = _typeTotal > 0 ? Math.round((_typeCorrect / _typeTotal) * 100) : 100;
    const accEl = document.getElementById('tt-acc');
    if (accEl) { accEl.textContent = `${acc}%`; accEl.style.color = acc >= 95 ? '#0f0' : acc >= 80 ? '#ff0' : '#f55'; }

    // Timer
    const timerEl = document.getElementById('tt-timer');
    if (_typeMode.type === 'time') {
        const remain = Math.max(0, _typeMode.value - elapsed);
        if (timerEl) timerEl.textContent = `${Math.ceil(remain)}s`;
        if (remain <= 0) { _finishTest(); return; }
    } else {
        if (timerEl) timerEl.textContent = `${_typeWordIdx}/${_typeMode.value}`;
    }

    // Track WPM over time (for potential graph later)
    _typeWpmHistory.push(wpm);
}

function _finishTest() {
    clearInterval(typeTimerInterval);
    typeTestActive = false;
    if (_typeKeyHandler) { document.removeEventListener('keydown', _typeKeyHandler); _typeKeyHandler = null; }
    if (window._ttEarlyHandler) { document.removeEventListener('keydown', window._ttEarlyHandler); window._ttEarlyHandler = null; }

    const elapsed = (Date.now() - _typeStart) / 1000;
    const wpm = elapsed > 0 ? Math.round((_typeCorrect / 5) / (elapsed / 60)) : 0;
    const acc = _typeTotal > 0 ? Math.round((_typeCorrect / _typeTotal) * 100) : 100;
    const rawWpm = elapsed > 0 ? Math.round(((_typeCorrect + _typeErrors) / 5) / (elapsed / 60)) : 0;

    // Rating
    let rating, ratingColor;
    if (wpm >= 120) { rating = 'LEGENDARY'; ratingColor = '#f0f'; }
    else if (wpm >= 80) { rating = 'ELITE'; ratingColor = '#0f0'; }
    else if (wpm >= 60) { rating = 'FAST'; ratingColor = '#0ff'; }
    else if (wpm >= 40) { rating = 'SOLID'; ratingColor = '#ff0'; }
    else if (wpm >= 25) { rating = 'AVERAGE'; ratingColor = '#fa0'; }
    else { rating = 'BEGINNER'; ratingColor = '#f55'; }

    const modeLabel = _typeMode.type === 'time' ? `${_typeMode.value}s` : `${_typeMode.value} words`;

    // Hide word area, show result
    const wordsEl = document.getElementById('tt-words');
    if (wordsEl) wordsEl.style.display = 'none';

    const resultEl = document.getElementById('tt-result');
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
            <div style="text-align:center; margin-top:10px;">
                <div style="color:${ratingColor}; font-size:1.1rem; font-weight:800; letter-spacing:3px; margin-bottom:16px; text-shadow:0 0 10px ${ratingColor};">${rating}</div>

                <div style="display:flex; justify-content:center; gap:30px; margin-bottom:16px;">
                    <div>
                        <div style="font-size:2.2rem; font-weight:800; color:#0ff;">${wpm}</div>
                        <div style="font-size:0.58rem; color:#555; letter-spacing:1px;">WPM</div>
                    </div>
                    <div>
                        <div style="font-size:2.2rem; font-weight:800; color:${acc >= 95 ? '#0f0' : acc >= 80 ? '#ff0' : '#f55'};">${acc}%</div>
                        <div style="font-size:0.58rem; color:#555; letter-spacing:1px;">ACCURACY</div>
                    </div>
                </div>

                <div style="font-size:0.68rem; color:#555; margin-bottom:16px;">
                    ${modeLabel} · ${elapsed.toFixed(1)}s · ${rawWpm} raw · ${_typeWordIdx} words · ${_typeErrors} errors
                </div>

                <div style="display:flex; gap:8px; justify-content:center;">
                    <button onclick="startTypingTest()" style="padding:10px 20px; font-family:'Fira Code',monospace; font-size:0.75rem; font-weight:600; letter-spacing:1px; background:transparent; border:1px solid #0ff; color:#0ff; border-radius:6px; cursor:pointer;">RESTART</button>
                </div>

                <div style="font-size:0.58rem; color:#333; margin-top:12px;">tab to restart</div>
            </div>`;
    }

    // Update stats bar
    const wpmStat = document.getElementById('tt-wpm');
    if (wpmStat) { wpmStat.textContent = `${wpm} wpm`; wpmStat.style.color = '#0ff'; }

    // Submit to leaderboard
    if (typeof window.submitScore === 'function') window.submitScore('typing', wpm);
    if (typeof printToTerminal === 'function') {
        printToTerminal(`Typing test (${modeLabel}): ${wpm} WPM · ${acc}% accuracy · ${elapsed.toFixed(1)}s · ${_typeErrors} errors`, 'conn-ok');
    }

    // Restore terminal input
    if (typeof _restoreTerminalInputBar === 'function') _restoreTerminalInputBar();

    // Tab to restart
    const restartHandler = (e) => {
        if (e.key === 'Tab') { e.preventDefault(); document.removeEventListener('keydown', restartHandler); startTypingTest(); }
    };
    document.addEventListener('keydown', restartHandler);
}

function _restoreTerminalInputBar() {
    const w = document.querySelector('.terminal-input-wrapper');
    if (w) w.style.display = w._origDisplay || '';
    typeTestActive = false;
    clearInterval(typeTimerInterval);
    if (_typeKeyHandler) { document.removeEventListener('keydown', _typeKeyHandler); _typeKeyHandler = null; }
    if (window._ttEarlyHandler) { document.removeEventListener('keydown', window._ttEarlyHandler); window._ttEarlyHandler = null; }
}
window._restoreTerminalInputBar = _restoreTerminalInputBar;
