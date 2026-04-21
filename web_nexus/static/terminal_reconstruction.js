/** 
 * NEXUS MASTER TYPE DEFINITIONS
 */
window.NEXUS_BOOT_START = window.NEXUS_BOOT_START || Date.now();

function renderAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;
    
    const nexusUser = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    
    if (nexusUser && nexusUser.name) {
        const isGoogle = !!nexusUser.email && nexusUser.email !== 'guest@local';
        const avatarHtml = nexusUser.picture 
            ? `<img src="${nexusUser.picture}" class="auth-avatar" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--accent); flex-shrink:0;" alt="User">`
            : `<div class="auth-avatar-initials" style="width:32px; height:32px; border-radius:50%; background:#111; border:1px solid var(--accent); display:flex; align-items:center; justify-content:center; font-size:0.6rem; color:var(--accent); flex-shrink:0;">${nexusUser.name[0].toUpperCase()}</div>`;
            
        authSection.innerHTML = `
            <div class="auth-user-card" style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(0,255,255,0.1); margin-bottom:10px;">
                ${avatarHtml}
                <div class="auth-info" style="flex:1; min-width:0;">
                    <div class="auth-name" style="color:#fff; font-size:0.65rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nexusUser.name}</div>
                    <div class="auth-email" style="color:#444; font-size:0.55rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${isGoogle ? nexusUser.email : 'LOCAL'}</div>
                </div>
                <div style="display:flex; gap:4px; align-items:center;">
                    <button class="auth-logout-btn" style="background:rgba(0,255,255,0.05); border:1px solid rgba(0,255,255,0.2); color:#0ff; font-size:9px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="clearAllHistory()" title="Memory">M</button>
                    <button class="auth-logout-btn" onclick="logout()" title="Logout" style="background:none; border:1px solid #f55; color:#f55 !important; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:3px; font-size:16px; font-weight:bold;">×</button>
                </div>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <div class="auth-signin-wrapper">
                <div class="auth-signin-label">MEMBER ACCESS</div>
                <div id="sidebar-g_id_signin" style="display:flex; justify-content:center;"></div>
            </div>
        `;
    }
}

// Global Boot
window.onload = async () => {
    try {
        cpuStat      = document.getElementById("cpu-stat");
        memStat      = document.getElementById("mem-stat");
        output       = document.getElementById("terminal-output");
        input        = document.getElementById("terminal-input");
        guiContainer = document.getElementById("game-gui-container");
        guiContent   = document.getElementById("gui-content");
        guiTitle     = document.getElementById("gui-title");
        nexusCanvas  = document.getElementById("nexus-canvas");

        let isBackendOnline = false;
        const startWake = Date.now();
        const MAX_WAKE_TIME = 30000; 

        console.log("[BOOT] Initializing Neural Uplink...");
        
        // SYNCING BAR LOGIC
        if (output) output.innerHTML = `<div class="sys-msg" id="boot-sync-msg">[ SYNCING NEURAL LINK: 0s ]</div>`;

        while (Date.now() - startWake < MAX_WAKE_TIME) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const pingRes = await fetch(`${API_BASE}/ping`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (pingRes.ok) { isBackendOnline = true; break; }
            } catch (e) {}
            
            const elapsed = Math.round((Date.now() - startWake)/1000);
            const syncMsg = document.getElementById('boot-sync-msg');
            if (syncMsg) syncMsg.textContent = `[ SYNCING NEURAL LINK: ${elapsed}s ]`;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!isBackendOnline) {
            const maint = document.createElement("div");
            maint.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,15,0.98);color:#f55;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Fira Code',monospace;text-align:center;padding:20px;";
            maint.innerHTML = `
                <div style="width:12px;height:12px;background:#f55;border-radius:50%;margin-bottom:15px;box-shadow:0 0 10px #f55;animation:pulse 2s infinite;"></div>
                <h1 style="color:#fff;font-size:1.5rem;letter-spacing:2px;margin:0 0 10px 0;">SYSTEM OFFLINE</h1>
                <p style="color:#aaa;max-width:400px;line-height:1.6;font-size:0.85rem;">The Nexus Core is currently undergoing maintenance.</p>
                <button onclick="location.reload()" style="margin-top:20px;background:none;border:1px solid #555;color:#888;padding:8px 16px;cursor:pointer;font-family:monospace;">[ INITIATE PING REFRESH ]</button>
            `;
            document.body.appendChild(maint);
            return; 
        }

        // CLEAR SYNC MSG BEFORE REVEAL
        if (output) output.innerHTML = '';

        let authedName = null;
        try {
            const meRes = await fetch(`${API_BASE}/api/me`);
            const meData = await meRes.json();
            if (meData.authenticated) authedName = meData.name;
        } catch(e) {}

        if (!authedName) {
            const nexusUser = JSON.parse(localStorage.getItem("nexus_user_data") || "null");
            if (nexusUser && nexusUser.name) authedName = nexusUser.name;
        }

        messageHistory = loadHistory(currentMode);
        initGoogleAuth();

        if (authedName) {
            revealTerminal(authedName);
        } else {
            console.log("[NEXUS] Awaiting Authorization...");
        }
        console.log(`[NEXUS] Boot sequence complete in ${Date.now() - window.NEXUS_BOOT_START}ms`);
    } catch (e) {
        console.error("[CRITICAL] Boot sequence failed:", e);
    }
};
