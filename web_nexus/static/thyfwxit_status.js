/**
 * THYFWXIT.COM — Dynamic Status Sync v2.0
 * High-fidelity real-time Nexus health monitoring.
 */
(function() {
    const NEXUS_URL = "https://nexus-terminalnexus.onrender.com/ping";
    const TERMINAL_URL = "https://nexus-terminalnexus.onrender.com";
    
    async function checkNexusStatus() {
        const statusEl = document.getElementById('nexus-status');
        if (!statusEl) return;

        // Visual enhancement: Initial pulse
        if (!statusEl.dataset.initialized) {
            statusEl.innerHTML = `<span style="color:#aaa">📡 Establishing Handshake...</span>`;
            statusEl.dataset.initialized = "true";
        }

        try {
            const start = Date.now();
            // Use a short timeout to prevent long hanging pings
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const res = await fetch(NEXUS_URL, { 
                mode: 'cors', 
                cache: 'no-cache',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const latency = Date.now() - start;
            
            if (res.ok) {
                statusEl.innerHTML = `
                    <a href="${TERMINAL_URL}" style="text-decoration:none; color:#0f0; font-family:monospace; font-size:0.85rem;">
                        <span style="display:inline-block; width:8px; height:8px; background:#0f0; border-radius:50%; margin-right:6px; box-shadow:0 0 8px #0f0;"></span>
                        NEXUS ONLINE <span style="color:#555">(${latency}ms)</span>
                    </a>
                `;
            } else {
                throw new Error();
            }
        } catch (e) {
            statusEl.innerHTML = `
                <div style="color:#f55; font-family:monospace; font-size:0.85rem;">
                    <span style="display:inline-block; width:8px; height:8px; background:#f55; border-radius:50%; margin-right:6px; box-shadow:0 0 8px #f55;"></span>
                    NEXUS OFFLINE <span style="color:#555; display:block; font-size:0.65rem; margin-top:2px;">"This is my creation — Currently undergoing maintenance."</span>
                </div>
            `;
        }
    }

    // Initial check
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkNexusStatus);
    } else {
        checkNexusStatus();
    }
    
    // Refresh every 30 seconds for higher fidelity
    setInterval(checkNexusStatus, 30000);
})();
