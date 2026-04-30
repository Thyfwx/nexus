// 🛰️ NEXUS HARDWARE MODULE v5.3.0
// Real-time system monitoring and maintenance hub.

window.startMaintenanceHub = async function() {
    if (!window.guiContainer) return;
    
    stopAllGames();
    window.guiTitle.textContent = 'MAINTENANCE HUB // SYSTEM';
    window.guiContent.innerHTML = `
        <div style="padding:15px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; border:1px solid #333;">
                    <div style="font-size:0.6rem; color:#555; letter-spacing:1px; margin-bottom:5px;">CPU LOAD</div>
                    <div id="hub-cpu" style="font-size:1.5rem; color:#0f0; font-weight:bold;">--%</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; border:1px solid #333;">
                    <div style="font-size:0.6rem; color:#555; letter-spacing:1px; margin-bottom:5px;">MEM USAGE</div>
                    <div id="hub-mem" style="font-size:1.5rem; color:#0ff; font-weight:bold;">--%</div>
                </div>
            </div>
            
            <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:8px; border:1px solid #111;">
                <div style="font-size:0.7rem; color:var(--accent); letter-spacing:2px; margin-bottom:10px; border-bottom:1px solid #222; padding-bottom:5px;">STORAGE NODES</div>
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:5px;">
                    <span style="color:#888;">DISK TOTAL</span>
                    <span id="hub-disk-total" style="color:#fff;">-- GB</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                    <span style="color:#888;">DISK FREE</span>
                    <span id="hub-disk-free" style="color:#0f0;">-- GB</span>
                </div>
            </div>

            <div style="margin-top:20px;">
                <div style="font-size:0.7rem; color:var(--accent); letter-spacing:2px; margin-bottom:10px;">RECENT NEURAL LINKS</div>
                <div id="hub-logins" style="font-size:0.6rem; font-family:monospace; height:120px; overflow-y:auto; color:#555;">
                    SCANNING LOGS...
                </div>
            </div>
            
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button class="gui-btn-compact" onclick="startSpeedTest()">RUN SPEEDTEST</button>
                <button class="gui-btn-compact" onclick="startMaintenanceHub()" style="border-color:#555; color:#888;">REFRESH HUB</button>
            </div>
        </div>
    `;
    window.nexusCanvas.style.display = 'none';
    window.guiContainer.classList.remove('gui-hidden');

    updateHub();
};

async function updateHub() {
    try {
        const res = await fetch(`${window.API_BASE}/api/diagnostics`);
        const data = await res.json();
        
        if (data.status === 'HEALTHY' || data.system) {
            const sys = data.system;
            document.getElementById('hub-cpu').textContent = sys.cpu_percent.toFixed(1) + '%';
            document.getElementById('hub-mem').textContent = sys.mem_percent.toFixed(1) + '%';
            document.getElementById('hub-disk-total').textContent = (sys.disk_total / (1024**3)).toFixed(1) + ' GB';
            document.getElementById('hub-disk-free').textContent = (sys.disk_free / (1024**3)).toFixed(1) + ' GB';
            
            const logsEl = document.getElementById('hub-logins');
            if (data.recent_logins && data.recent_logins.length) {
                logsEl.innerHTML = data.recent_logins.reverse().map(l => `
                    <div style="border-bottom:1px solid #111; padding:4px 0;">
                        <span style="color:#0f0;">[OK]</span> ${l.name} <span style="color:#333;">(${l.ip})</span>
                    </div>
                `).join('');
            } else {
                logsEl.textContent = 'NO RECENT LOGINS DETECTED.';
            }
        }
    } catch (e) {
        console.error("[HUB] Refresh failed:", e);
    }
}
