// 🛠️ NEXUS COMMAND CORE v5.3.0
// Logic for terminal commands, processing, and routing.

function handleCommand(cmd) {
    const lc = cmd.toLowerCase().trim();
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    const pl = `${nexusUser.name.toLowerCase()}@nexus:~$`;

    // 1. Silent UI Commands
    const silent = ['clear', 'history', 'sudo hack', 'sudo override', 'telemetry', 'play wordle', 'play snake', 'play pong', 'play mines', 'play flappy', 'play breakout', 'play invaders', 'matrix', 'monitor', 'type test'];
    if (!silent.includes(lc)) {
        printToTerminal(`${pl} ${cmd}`, 'user-cmd');
    }

    // 2. Overrides & Privileged Commands
    if (lc === 'sudo hack' || lc === 'sudo override') {
        if (window.OWNER_MODE) {
            const menu = document.getElementById('hack-menu');
            if (menu) menu.style.display = 'flex';
            printToTerminal('[SEC] Owner Identity Confirmed. Neural Override Interface Engaged.', 'conn-ok');
            return;
        }

        const entry = prompt("ENTER ACCESS PIN:");
        const versionPin = window.NEXUS_VERSION.replace(/[^0-9]/g, '').padEnd(4, '0');
        if (entry === versionPin) {
            const menu = document.getElementById('hack-menu');
            if (menu) menu.style.display = 'flex';
            printToTerminal('[SYSTEM] Neural Override Interface Engaged.', 'conn-ok');
        } else {
            printToTerminal('[ERR] Authentication Failed.', 'conn-err');
        }
        return;
    }

    if (lc === 'telemetry') {
        if (!window.OWNER_MODE) {
            printToTerminal("[ERR] Permission Denied: Uplink Node Locked.", "conn-err");
            return;
        }
        printToTerminal("--- NODE TELEMETRY [TOP SECRET] ---", "conn-ok");
        printToTerminal(`UPLINK: ${window.PACIFIC_HUB}`, "sys-msg");
        printToTerminal(`BACKEND: ${window.BACKEND_URL}`, "sys-msg");
        printToTerminal(`SESSION ID: ${localStorage.getItem('nx_sid') || 'NONE'}`, "sys-msg");
        printToTerminal(`STEALTH: ${localStorage.getItem('nx_stealth') === '1' ? 'ACTIVE' : 'INACTIVE'}`, "sys-msg");
        printToTerminal("-----------------------------------", "sys-msg");
        return;
    }

    // 3. Core Utilities
    if (lc === 'clear') {
        window.output.innerHTML = '';
        window.messageHistory = [];
        // Re-print the boot tagline so the screen never feels empty after clear
        if (window.replayBootSummary) window.replayBootSummary();
        return;
    }
    if (lc === 'help') { showHelp(); return; }
    if (lc === 'tips' || lc === 'capabilities') { showTips(); return; }
    if (lc === 'export' || lc === 'save') { exportConversation(); return; }
    if (lc === 'forget' || lc === 'forget mode') { forgetMode(); return; }
    if (lc === 'forget all' || lc === 'wipe' || lc === 'wipe all') { forgetAll(); return; }
    if (lc === 'whoami') { runWhoami(); return; }
    if (lc === 'neofetch') { runNeofetch(); return; }
    if (lc === 'logout') { window.logout(); return; }
    if (lc === 'maint' || lc === 'maintenance' || lc === 'hub') { window.startMaintenanceHub(); return; }
    if (lc === 'speedtest' || lc === 'test') { window.startSpeedTest(); return; }
    if (lc === 'diag' || lc === 'diagnostic') {
        if (!window.OWNER_MODE) { printToTerminal("[ERROR] ACCESS DENIED. Privileged diagnostic restricted to OWNER.", "sys-msg-colored"); return; }
        showDiagnostics(); return;
    }
    if (lc === 'uplink' || lc === 'upload') { document.getElementById('neural-uplink')?.click(); return; }

    // 4. Games & Tools
    if (lc === 'play wordle')         { startWordle(); return; }
    if (lc === 'play snake')          { startSnake(); return; }
    if (lc === 'play pong')           { startPong(); return; }
    if (lc === 'play mines')          { startMinesweeper(); return; }
    if (lc === 'play flappy')         { startFlappy(); return; }
    if (lc === 'play breakout')       { startBreakout(); return; }
    if (lc === 'play invaders')       { startInvaders(); return; }
    if (lc === 'matrix')              { startMatrixSaver(); return; }
    if (lc === 'monitor')             { startMonitor(); return; }
    if (lc === 'type test')           { startTypingTest(); return; }

    // 5. AI Routing
    prompt_ai_proxy(cmd, null, window.currentMode);
}

function forgetMode() {
    const m = (window.currentMode || 'nexus');
    if (window._modeHistories) window._modeHistories[m] = [];
    window.messageHistory = [];
    window.activeModelLabel = null;
    printToTerminal(`[FORGET] ${m.toUpperCase()} history cleared. Other modes still remember their threads.`, 'sys-msg-colored');
}

function forgetAll() {
    window._modeHistories = {};
    window.messageHistory = [];
    window.activeModelLabel = null;
    window.totalMessagesSent = 0;
    printToTerminal('[FORGET] All mode histories wiped. Every AI is a fresh slate.', 'sys-msg-colored');
}

function exportConversation() {
    const hist = window.messageHistory || [];
    if (!hist.length) { printToTerminal('[EXPORT] Nothing to save yet.', 'sys-msg'); return; }
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const ts = new Date().toISOString();
    const lines = [
        `# Nexus Conversation`,
        `**User:** ${u.name || 'Guest'}`,
        `**Date:** ${ts}`,
        `**Mode:** ${(window.currentMode || 'nexus').toUpperCase()}`,
        ``,
        `---`,
        ``,
    ];
    hist.forEach(m => {
        const tag = m.role === 'user' ? '🧑 USER' : '🤖 NEXUS';
        lines.push(`### ${tag}\n${m.content}\n`);
    });
    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-${(u.name || 'guest').replace(/\s+/g, '_')}-${ts.slice(0,16).replace(/[:T]/g,'-')}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    printToTerminal(`[EXPORT] Saved ${hist.length} messages as ${a.download}.`, 'sys-msg-colored');
}

function _box(title, lines, accent = false) {
    const cls = accent ? 'sys-msg-colored' : 'sys-msg';
    printToTerminal(`╭─ ${title} ${'─'.repeat(Math.max(0, 56 - title.length))}╮`, cls);
    for (const l of lines) printToTerminal(`│  ${l}`, 'sys-msg');
    printToTerminal(`╰${'─'.repeat(60)}╯`, cls);
}

function showHelp() {
    const lines = [
        "  help          this menu",
        "  tips          what you can ask the AI to do",
        "  export / save download this conversation as Markdown",
        "  forget        wipe THIS mode's chat history (others stay intact)",
        "  forget all    wipe every mode's history",
        "  clear         wipe terminal output (history is untouched)",
        "  whoami        show active identity",
        "  play <game>   wordle · snake · pong · invaders · flappy · breakout · mines",
        "  logout        end session",
    ];
    if (window.OWNER_MODE) lines.push("  diag          [OWNER] DEV PANEL — diagnostics + source viewer");
    lines.push("");
    lines.push("  Anything else → routed to the active AI mode (right sidebar).");
    lines.push("  Each mode keeps its OWN chat history; switching restores the other side.");
    _box("NEXUS · COMMAND MANIFEST", lines, true);
}

function showTips() {
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"you"}');
    const isGuest = !u.email || u.email === 'guest@local';
    _box(`HOW TO TALK TO NEXUS, ${u.name.toUpperCase()}`, [
        "  IMAGES — phrase your request with a verb + a subject:",
        '    "generate an image of a sunset"   "draw a cyberpunk city"   "show me a tiger"',
        "    or use the direct form:   \"image of: ...\"   \"picture of: ...\"",
        "",
        "  Just ask in plain words. Nexus invokes tools on its own.",
        "",
        "  CAPABILITIES BY MODE:",
        "    NEXUS      image · translate · summarize · sentiment · emotion · search · chart",
        "    CODER      image · translate · summarize · search · chart  (terse, complete code)",
        "    EDUCATION  image · translate · summarize · search · wiki · math · chart",
        "    UNFILTERED everything in NEXUS · NSFW image bypass · sign-in required",
        "",
        "  EXAMPLES:",
        "    • image of a neon Tokyo street at dusk         → renders inline",
        "    • translate \"good morning\" to Japanese       → inline result",
        "    • summarize this article: <paste text>         → condensed reply",
        "    • search for the latest FastAPI release notes  → top web results",
        "    • wiki: photosynthesis            (Education)  → encyclopedia summary",
        "    • solve x^2 + 5x + 6 = 0          (Education)  → algebraic solution",
        "    • bar chart: cats=12, dogs=7, fish=3           → renders chart",
        "    • write a Python script to dedupe a CSV (Coder)→ complete code block",
        "",
        "  COMMANDS:",
        "    help · tips · clear · export (saves chat) · logout",
        isGuest ? "  Guest: memory OFF, image gen + Unfiltered locked. Sign in for full access."
                : "  Memory: ON. Edit it in AI Profile.",
    ], true);
}

function runWhoami() {
    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    const status = window.OWNER_MODE ? 'OWNER (ROOT ACCESS)' : 'NEURAL LINK ACTIVE';
    printToTerminal(`IDENTITY: ${user.name}`, "conn-ok");
    printToTerminal(`EMAIL: ${user.email || "N/A"}`, "sys-msg");
    printToTerminal(`STATUS: ${status}`, "sys-msg");
}

function runNeofetch() {
    printToTerminal(`Nexus Terminal · ${window.NEXUS_VERSION}`, "conn-ok");
    printToTerminal(`OS: Pacific OS v5.0.0`, "sys-msg");
    printToTerminal(`KERNEL: Xavier Scott Architect`, "sys-msg");
    printToTerminal(`UPTIME: ${Math.floor(performance.now()/60000)}m`, "sys-msg");
    printToTerminal(`CPU: ${document.getElementById('cpu-stat')?.textContent || '--'}`, "sys-msg");
    printToTerminal(`MEM: ${document.getElementById('mem-stat')?.textContent || '--'}`, "sys-msg");
}

function showDiagnostics() {
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const ownerEmail = 'lovexdgamer@gmail.com';
    if (nexusUser.email !== ownerEmail) {
        printToTerminal("[ERROR] ACCESS DENIED. Privileged diagnostic node restricted to OWNER.", "sys-msg-colored");
        return;
    }

    if (!window.guiContainer) return;
    window.guiTitle.textContent = "EXTENSIVE SYSTEM DIAGNOSTICS";
    window.guiContainer.classList.remove('gui-hidden');

    const uptime = (performance.now() / 1000).toFixed(2);

    window.guiContent.innerHTML = `
        <div style="font-family:'Fira Code',monospace; font-size:0.65rem; color:#0f0; line-height:1.6;">
            <div style="margin-bottom:10px; border-bottom:1px solid #141; padding-bottom:5px;">[ CORE KERNEL STATUS ]</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>VERSION: <span style="color:#fff;">${window.NEXUS_VERSION}</span></div>
                <div>UPTIME: <span style="color:#fff;">${uptime}s</span></div>
                <div>BACKEND: <span style="color:${window.backendReady ? '#0f0' : '#f00'};">${window.backendReady ? 'ONLINE' : 'OFFLINE'}</span></div>
                <div>WS_LINK: <span style="color:${window.termWs?.readyState === 1 ? '#0f0' : '#f00'};">${window.termWs?.readyState === 1 ? 'STABLE' : 'BROKEN'}</span></div>
            </div>

            <div style="margin:15px 0 10px; border-bottom:1px solid #141; padding-bottom:5px;">[ NEURAL ARCHITECTURE ]</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>MODE: <span style="color:${window.MODE_COLORS[window.currentMode]};">${window.currentMode.toUpperCase()}</span></div>
                <div>IDENTITY: <span style="color:#fff;">${nexusUser.name || 'GUEST'}</span></div>
                <div>OWNER: <span style="color:#fff;">${window.OWNER_MODE}</span></div>
                <div>CACHE: <span style="color:#fff;">${window.messageHistory.length} NODES</span></div>
            </div>

            <div style="margin:15px 0 10px; border-bottom:1px solid #141; padding-bottom:5px;">[ CLIENT ENVIRONMENT ]</div>
            <div>UA: <span style="color:#888; font-size:0.55rem;">${navigator.userAgent}</span></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:5px;">
                <div>RES: <span style="color:#fff;">${window.innerWidth}x${window.innerHeight}</span></div>
                <div>LANG: <span style="color:#fff;">${navigator.language}</span></div>
                <div>LOCAL: <span style="color:#fff;">${window.isLocal}</span></div>
                <div>HTTPS: <span style="color:#fff;">${window.location.protocol === 'https:'}</span></div>
            </div>

            <div style="margin:15px 0 10px; border-bottom:1px solid #141; padding-bottom:5px;">[ NETWORK TELEMETRY ]</div>
            <div>API_BASE: <span style="color:#4af;">${window.API_BASE || 'LOCAL'}</span></div>
            <div>WS_URL: <span style="color:#4af;">${window.WS_URL}</span></div>
            <div>MAINTENANCE: <span style="color:${window.MAINTENANCE_MODE ? '#ffb300' : '#0f0'};">${window.MAINTENANCE_MODE}</span></div>

            <div style="margin:15px 0 10px; border-bottom:1px solid #f55; color:#f55; padding-bottom:5px;">[ SYSTEM ERROR LOGS ]</div>
            <div id="diag-error-log" style="color:#f55; height:120px; overflow-y:auto; font-size:0.6rem; border:1px solid #411; padding:8px; background:rgba(20,0,0,0.5); white-space:pre-wrap; word-break:break-all;">
                ${window.nexusErrors?.length ? window.nexusErrors.slice().reverse().join('<br><br>') : '[ NO CRITICAL FAILURES DETECTED ]'}
            </div>

            <div style="margin-top:15px; font-size:0.55rem; color:#444; text-align:center;">
                DIAGNOSTIC DATA IS REAL-TIME AND AUTHENTICATED
            </div>
        </div>
    `;
}

// Attach to window
window.handleCommand = handleCommand;
window.showDiagnostics = showDiagnostics;
