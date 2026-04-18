/**
 * THYFWXIT.COM — Dynamic Status Sync
 * Add this script to your main site to show real-time Nexus status.
 */
(function() {
    const NEXUS_URL = "https://nexus-terminalnexus.onrender.com/ping";
    
    async function checkNexusStatus() {
        const statusEl = document.getElementById('nexus-status');
        if (!statusEl) return;

        try {
            const start = Date.now();
            const res = await fetch(NEXUS_URL, { mode: 'cors', cache: 'no-cache' });
            const latency = Date.now() - start;
            
            if (res.ok) {
                statusEl.innerHTML = `<span style="color:#0f0">●</span> NEXUS ONLINE (${latency}ms)`;
                statusEl.style.color = "#0f0";
            } else {
                throw new Error();
            }
        } catch (e) {
            statusEl.innerHTML = `<span style="color:#f00">●</span> NEXUS OFFLINE`;
            statusEl.style.color = "#f00";
        }
    }

    // Initial check
    document.addEventListener('DOMContentLoaded', checkNexusStatus);
    // Refresh every 60 seconds
    setInterval(checkNexusStatus, 60000);
})();
