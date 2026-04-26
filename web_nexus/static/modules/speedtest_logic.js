// 🚀 NEXUS SPEEDTEST MODULE v5.3.0
// High-fidelity network diagnostics and visualization.

window.startSpeedTest = async function() {
    if (!window.guiContainer) return;
    
    stopAllGames();
    window.guiTitle.textContent = 'NETWORK UPLINK: SPEEDTEST';
    window.guiContent.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div id="speed-meter" style="width:120px; height:120px; border-radius:50%; border:4px solid #111; border-top-color:var(--accent); margin:0 auto; animation: spin 2s infinite linear;"></div>
            <h2 id="speed-status" style="color:var(--accent); margin-top:20px; letter-spacing:2px;">INITIATING PING...</h2>
            <div id="speed-results" style="margin-top:20px; text-align:left; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px; display:none;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="color:#555;">DOWNLOAD</span>
                    <span id="speed-down" style="color:#0f0; font-weight:bold;">-- Mbps</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#555;">UPLOAD</span>
                    <span id="speed-up" style="color:#0ff; font-weight:bold;">-- Mbps</span>
                </div>
            </div>
            <button id="speed-retry" class="gui-btn-compact" style="margin-top:20px; display:none;" onclick="startSpeedTest()">RE-RUN TEST</button>
        </div>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    `;
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    printToTerminal("[SYSTEM] Running server-side network diagnostic...", "sys-msg");

    try {
        if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
            window.termWs.send(JSON.stringify({ command: 'speedtest' }));
            
            const handleSpeedMsg = (e) => {
                if (e.data.includes("Download:")) {
                    const status = document.getElementById('speed-status');
                    const results = document.getElementById('speed-results');
                    const down = document.getElementById('speed-down');
                    const up = document.getElementById('speed-up');
                    const meter = document.getElementById('speed-meter');
                    const retry = document.getElementById('speed-retry');

                    if (status) status.textContent = 'TEST COMPLETE';
                    if (results) results.style.display = 'block';
                    if (meter) meter.style.animation = 'none';
                    if (retry) retry.style.display = 'block';

                    const parts = e.data.split('|');
                    if (down) down.textContent = parts[0].split(':')[1].trim();
                    if (up) up.textContent = parts[1].split(':')[1].trim();

                    window.termWs.removeEventListener('message', handleSpeedMsg);
                }
            };
            window.termWs.addEventListener('message', handleSpeedMsg);
        }
    } catch (e) {
        document.getElementById('speed-status').textContent = 'TEST FAILED';
        printToTerminal("[ERR] Speedtest uplink severed.", "conn-err");
    }
};
