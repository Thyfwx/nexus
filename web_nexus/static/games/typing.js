// Phrases for the typing test — extracted from the original games_core.js
const TYPE_PHRASES = [
    // Classic
    'the quick brown fox jumps over the lazy dog near the riverbank',
    'pack my box with five dozen liquor jugs and a small wax candle',
    'sphinx of black quartz judge my vow of vengeance against time',
    'how vexingly quick daft zebras jump across the moonlit field',
    'amazingly few discotheques provide jukeboxes for their patrons',

    // Network / sysadmin
    'packets travel across networks at the speed of light through fiber optic cables',
    'a clean network is a fast network and a fast network is a happy homelab',
    'every system has a vulnerability if you know exactly where to look for it',
    'security is not a product it is a process that never really ends',
    'the firewall is your friend until it is silently dropping the wrong port',
    'dns is the answer when nothing else makes sense and also the cause of every outage',
    'a server only goes down on a friday afternoon when you have plans for the weekend',
    'route flaps and bgp leaks ruin more sundays than any operator wants to admit',

    // Code / engineering
    'code is just instructions that tell machines what to do until they do it wrong',
    'debug twice deploy once or just push to prod and hope nothing catches fire',
    'the best way to learn something is to break it and then figure out how to fix it',
    'open source software runs most of the internet and nobody really talks about that',
    'trust the process unless the process is a shell script you wrote at midnight',
    'first make it work then make it right then make it fast in that order',
    'two hard problems in computer science are naming things and cache invalidation',
    'reading other peoples code is the fastest way to become a better engineer',
    'every refactor is a chance to break something that was already working fine',
    'a comment that says what instead of why is a comment that should not exist',

    // Aphorisms / wit
    'any sufficiently advanced technology is indistinguishable from magic',
    'the only winning move in a flame war is not to play in the first place',
    'patience is bitter but its fruit is sweet for those who wait long enough',
    'do not let perfect be the enemy of shipped this week before friday at five',
    'simplicity is the ultimate sophistication and also the hardest thing to ship',

    // Nexus / xavier flavor
    'xavier scott built this terminal so you could talk to an ai without a search bar',
    'nexus runs on coffee fastapi and a stubborn refusal to use a heavy framework',
    'the lobby loads in under two seconds because nobody likes waiting on a login page',
    'cloudflare pages is what happens when a cdn marries a build pipeline and they have a kid',
    'proxmox plus a noctua fan is the closest thing you can get to a quiet datacenter at home',

    // Long-form pangrams to push the test
    'jaded zombies acted quaintly but kept driving their oxen forward through the muddy fields',
    'the five boxing wizards jump quickly over the bridge while reciting ancient spells',
    'crazy fredrick bought many very exquisite opal jewels for the queen of the underworld',
];

let typePhrase = '', typeStart = 0;
let typeErrors = 0, typeCharsTyped = 0;

const TYPING_LIMIT_SEC = 60;

function startTypingTest() {
    if (typeof stopAllGames === 'function') stopAllGames();
    typeTestActive = true;
    typePhrase = TYPE_PHRASES[Math.floor(Math.random() * TYPE_PHRASES.length)];
    typeStart = 0;
    typeErrors = 0;
    typeCharsTyped = 0;

    // Hide the terminal input bar — typing happens INSIDE the modal so it doesn't
    // bleed into the chat or look like the user is typing in two places.
    const termInputWrap = document.querySelector('.terminal-input-wrapper');
    if (termInputWrap) { termInputWrap._origDisplay = termInputWrap.style.display; termInputWrap.style.display = 'none'; }

    guiContainer.classList.remove('gui-hidden');
    guiTitle.textContent = 'TYPING TEST';
    nexusCanvas.style.display = 'none';

    // Build the modal ONCE — separate sub-elements for phrase, stats, and input.
    // Subsequent updates only touch the inner spans, so the <input> is never destroyed
    // (which is what was killing focus/events after the first keystroke).
    guiContent.innerHTML = `
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:4px;">
                <span>PROGRESS</span><span id="type-progress-pct">0%</span>
            </div>
            <div style="height:3px;background:#111;border-radius:2px;">
                <div id="type-progress-bar" style="height:3px;width:0%;background:#0ff;border-radius:2px;transition:width 0.1s;"></div>
            </div>
        </div>
        <div id="type-phrase-view" style="font-size:0.88rem;line-height:1.9;letter-spacing:0.03em;word-break:break-word;margin-bottom:14px;font-family:'Fira Code',monospace;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-timer-val" style="font-size:1.4rem;font-weight:bold;color:#0ff;">${TYPING_LIMIT_SEC}s</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">TIME LEFT</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-wpm-val" style="font-size:1.4rem;font-weight:bold;color:#0ff;">0</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">WPM</div>
            </div>
            <div style="background:#0a0a1a;border:1px solid #1a1a2e;padding:8px;border-radius:4px;">
                <div id="type-err-val" style="font-size:1.4rem;font-weight:bold;color:#0f0;">0</div>
                <div style="font-size:0.62rem;color:#555;letter-spacing:1px;margin-top:2px;">ERRORS</div>
            </div>
        </div>
        <input id="type-own-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="start typing here…"
               style="width:100%; box-sizing:border-box; margin-top:14px; padding:10px 12px; font-family:'Fira Code',monospace; font-size:0.95rem; background:#000; color:#0ff; border:1px solid var(--accent); border-radius:6px; outline:none;">
        <div id="type-result-overlay"></div>
        <p style="font-size:0.7rem;color:#333;text-align:center;margin-top:8px;">${TYPING_LIMIT_SEC}s timer · close X to cancel</p>`;

    // Initial paint of the phrase view
    renderTypeTest('');

    // Wire up the input once + steal focus
    setTimeout(() => {
        const own = document.getElementById('type-own-input');
        if (own) {
            own.value = '';
            own.focus();
            own.addEventListener('input', () => {
                if (!typeStart) typeStart = Date.now();
                if (!typeTimerInterval) typeTimerInterval = setInterval(tickTypeTimer, 200);
                checkTypingTest(own.value);
            });
        }
    }, 50);
}

// Restore terminal input bar when test ends/closes
function _restoreTerminalInputBar() {
    const w = document.querySelector('.terminal-input-wrapper');
    if (w) w.style.display = w._origDisplay || '';
    typeTestActive = false;
    clearInterval(typeTimerInterval);
}
window._restoreTerminalInputBar = _restoreTerminalInputBar;

function renderTypeTest(typed) {
    const target = typePhrase;
    // Build character-by-character highlighted target
    let chars = '';
    for (let i = 0; i < target.length; i++) {
        if (i < typed.length) {
            if (typed[i] === target[i]) {
                chars += `<span style="color:#0f0">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
            } else {
                chars += `<span style="color:#f55;text-decoration:underline">${target[i] === ' ' ? '' : target[i]}</span>`;
            }
        } else if (i === typed.length) {
            chars += `<span style="color:#0ff;border-left:2px solid #0ff">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        } else {
            chars += `<span style="color:#444">${target[i] === ' ' ? '&nbsp;' : target[i]}</span>`;
        }
    }

    const elapsed = typeStart ? ((Date.now() - typeStart) / 1000) : 0;
    const remain = Math.max(0, TYPING_LIMIT_SEC - elapsed);
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = elapsed > 1 ? Math.round(wordsTyped / (elapsed / 60)) : 0;
    const pct = Math.min(100, Math.round((typed.length / Math.max(1, target.length)) * 100));

    // Update sub-elements only — never replace the whole guiContent (would destroy the input)
    const phraseEl = document.getElementById('type-phrase-view');
    if (phraseEl) phraseEl.innerHTML = chars;
    const pctTxt = document.getElementById('type-progress-pct');
    if (pctTxt) pctTxt.textContent = `${pct}%`;
    const pctBar = document.getElementById('type-progress-bar');
    if (pctBar) pctBar.style.width = `${pct}%`;
    const timerEl = document.getElementById('type-timer-val');
    if (timerEl) timerEl.textContent = `${Math.ceil(remain)}s`;
    const wpmEl = document.getElementById('type-wpm-val');
    if (wpmEl) wpmEl.textContent = wpm;
    const errEl = document.getElementById('type-err-val');
    if (errEl) {
        errEl.textContent = typeErrors;
        errEl.style.color = typeErrors > 0 ? '#f55' : '#0f0';
    }
}

function tickTypeTimer() {
    if (!typeTestActive || !typeStart) return;
    const secs = (Date.now() - typeStart) / 1000;
    const remain = Math.max(0, TYPING_LIMIT_SEC - secs);
    const el = document.getElementById('type-timer-val');
    if (el) el.textContent = `${Math.ceil(remain)}s`;
    const own = document.getElementById('type-own-input');
    const typed = own ? own.value : '';
    const wordsTyped = typed.trim().split(/\s+/).filter(w => w).length;
    const wpm = secs > 1 ? Math.round(wordsTyped / (secs / 60)) : 0;
    const wEl = document.getElementById('type-wpm-val');
    if (wEl) wEl.textContent = wpm;
    if (remain <= 0) {
        clearInterval(typeTimerInterval);
        typeTestActive = false;
        const acc = typed ? Math.round(((typed.length - typeErrors) / Math.max(1, typed.length)) * 100) : 0;
        const overlay = document.getElementById('type-result-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div style="margin-top:12px;padding:12px;border:2px solid #f55;text-align:center;background:#1a0a0a;">
                    <div style="color:#f55;font-size:1.05rem;font-weight:bold;letter-spacing:2px;">TIME UP</div>
                    <div style="margin-top:6px;font-size:0.85rem;color:#fff;">${wpm} WPM · ${acc}% accuracy</div>
                </div>`;
        }
        if (typeof _restoreTerminalInputBar === 'function') _restoreTerminalInputBar();
    }
}

function checkTypingTest(typed) {
    if (!typeTestActive) return false;
    if (typeStart === 0) {
        typeStart = Date.now();
        clearInterval(typeTimerInterval);
        typeTimerInterval = setInterval(tickTypeTimer, 100);
    }

    // Count errors
    typeErrors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== typePhrase[i]) typeErrors++;
    }

    renderTypeTest(typed);

    if (typed === typePhrase) {
        const elapsed = (Date.now() - typeStart) / 1000;
        const wpm = Math.round((typePhrase.split(' ').length) / (elapsed / 60));
        const accuracy = Math.round(((typePhrase.length - typeErrors) / typePhrase.length) * 100);
        clearInterval(typeTimerInterval);
        typeTestActive = false;

        // Show final result overlay in the dedicated overlay div (not by replacing guiContent)
        const overlay = document.getElementById('type-result-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div style="margin-top:12px;padding:12px;border:2px solid #0ff;text-align:center;background:#0a0f1a;">
                    <div style="color:#0ff;font-size:1.1rem;font-weight:bold;letter-spacing:2px;">COMPLETE</div>
                    <div style="margin-top:6px;font-size:0.85rem;color:#fff;">${wpm} WPM &nbsp;&nbsp; ${accuracy}% accuracy &nbsp;&nbsp; ${elapsed.toFixed(1)}s</div>
                    ${wpm > 80 ? '<div style="color:#0f0;font-size:0.75rem;margin-top:4px;">Elite typist</div>' : wpm > 50 ? '<div style="color:#ff0;font-size:0.75rem;margin-top:4px;">Nice speed!</div>' : '<div style="color:#888;font-size:0.75rem;margin-top:4px;">Keep practicing.</div>'}
                </div>`;
        }
        printToTerminal(`Typing test complete: ${wpm} WPM  ${accuracy}% accuracy  ${elapsed.toFixed(1)}s`, 'conn-ok');
        return true;
    }
    return false;
}

// Expose to global so commands_core.js startTypingTest call works + terminal.js typeof checks find them
window.startTypingTest  = startTypingTest;
window.renderTypeTest   = renderTypeTest;
window.checkTypingTest  = checkTypingTest;
window.tickTypeTimer    = tickTypeTimer;
