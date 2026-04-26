// 🛠️ NEXUS COMMAND CORE v5.3.0
// Logic for terminal commands, processing, and routing.

function handleCommand(cmd) {
    const lc = cmd.toLowerCase().trim();
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    const pl = `${nexusUser.name.toLowerCase()}@nexus:~$`;

    // 1. Silent UI Commands
    const silent = ['clear', 'history', 'sudo hack', 'sudo override', 'play wordle', 'play snake', 'play pong', 'play mines', 'play flappy', 'play breakout', 'play invaders', 'matrix', 'monitor', 'type test'];
    if (!silent.includes(lc)) {
        printToTerminal(`${pl} ${cmd}`, 'user-cmd');
    }

    // 2. Overrides
    if (lc === 'sudo hack' || lc === 'sudo override') {
        window.askForPin((entry) => {
            const versionPin = window.NEXUS_VERSION.replace(/[^0-9]/g, '').padEnd(4, '0');
            if (entry === versionPin) {
                document.getElementById('hack-menu').style.display = 'flex';
                printToTerminal('[SYSTEM] Neural Override Interface Engaged.', 'conn-ok');
            } else {
                printToTerminal('[ERR] Authentication Failed.', 'conn-err');
            }
        });
        return;
    }

    // 3. Core Utilities
    if (lc === 'clear') {
        window.output.innerHTML = '';
        window.messageHistory = [];
        return;
    }
    if (lc === 'help') { showHelp(); return; }
    if (lc === 'whoami') { runWhoami(); return; }
    if (lc === 'neofetch') { runNeofetch(); return; }
    if (lc === 'logout') { window.logout(); return; }
    if (lc === 'maint' || lc === 'maintenance' || lc === 'hub') { window.startMaintenanceHub(); return; }
    if (lc === 'speedtest' || lc === 'test') { window.startSpeedTest(); return; }

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

function showHelp() {
    printToTerminal("--- NEXUS COMMAND MANIFEST ---", "sys-msg");
    printToTerminal(" help       : Show this menu", "sys-msg");
    printToTerminal(" clear      : Wipe terminal output", "sys-msg");
    printToTerminal(" whoami     : Display active identity", "sys-msg");
    printToTerminal(" neofetch   : Show system statistics", "sys-msg");
    printToTerminal(" play <game>: wordle, snake, pong, mines, flappy, breakout, invaders", "sys-msg");
    printToTerminal(" tools      : monitor, type test", "sys-msg");
    printToTerminal(" logout     : Sever neural link", "sys-msg");
    printToTerminal("------------------------------", "sys-msg");
}

function runWhoami() {
    const user = JSON.parse(localStorage.getItem('nexus_user_data') || '{"name":"Guest"}');
    printToTerminal(`IDENTITY: ${user.name}`, "conn-ok");
    printToTerminal(`EMAIL: ${user.email || "N/A"}`, "sys-msg");
    printToTerminal(`STATUS: NEURAL LINK ACTIVE`, "sys-msg");
}

function runNeofetch() {
    printToTerminal(`NEXUS AI v${window.NEXUS_VERSION}`, "conn-ok");
    printToTerminal(`OS: Pacific OS v5.0.0`, "sys-msg");
    printToTerminal(`KERNEL: Xavier Scott Architect`, "sys-msg");
    printToTerminal(`UPTIME: ${Math.floor(performance.now()/60000)}m`, "sys-msg");
    printToTerminal(`CPU: ${document.getElementById('cpu-stat')?.textContent || '--'}`, "sys-msg");
    printToTerminal(`MEM: ${document.getElementById('mem-stat')?.textContent || '--'}`, "sys-msg");
}

// Attach to window
window.handleCommand = handleCommand;
