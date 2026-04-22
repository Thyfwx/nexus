//  GOOGLE AUTHENTICATION v5.2.0
// =============================================================
let _googleClientID = '616205887439-s1l0out61vlu0l81307q9g64oai3gnur.apps.googleusercontent.com';
let _authInited = false;

async function initGoogleAuth() {
    if (_authInited) return;
    console.log("[AUTH] Initiating Identity Uplink...");
    renderAuthSection();

    const setupGoogle = () => {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            return false;
        }
        if (_authInited) return true;

        try {
            console.log("[AUTH] Handshaking with Google GSI...");
            google.accounts.id.initialize({
                client_id: _googleClientID,
                callback: window.handleCredentialResponse,
                ux_mode: 'popup',
                auto_select: false
            });

            const renderBtn = (id) => {
                const el = document.getElementById(id);
                if (el) {
                    console.log(`[AUTH] Rendering Button in #${id}`);
                    el.style.minHeight = '44px';
                    el.style.visibility = 'visible';
                    google.accounts.id.renderButton(el, { 
                        type: 'standard', 
                        shape: 'rectangular', 
                        theme: 'filled_blue', 
                        text: 'signin_with', 
                        size: id.includes('main') ? 'large' : 'medium',
                        width: id.includes('main') ? '300' : '200'
                    });
                }
            };

            renderBtn('main-g_id_signin');
            renderBtn('sidebar-g_id_signin');

            _authInited = true;
            return true;
        } catch (e) {
            console.error("[AUTH] Google GSI Error:", e);
            return false;
        }
    };

    // Robust Polling
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        if (setupGoogle() || attempts > 50) {
            clearInterval(poll);
            if (!_authInited) console.warn("[AUTH] GSI Library not ready.");
        }
    }, 500);
}

function renderAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    const user = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    if (user && user.name) {
        authSection.innerHTML = `
            <div class="auth-user-card">
                <img src="${user.picture || 'https://thyfwxit.com/avatar.png'}" class="auth-avatar" alt="User">
                <div class="auth-info">
                    <div class="auth-name">${user.name}</div>
                    <div style="font-size:0.5rem; color:#555;">[ AUTHENTICATED ]</div>
                </div>
                <button onclick="window.logout()" class="auth-logout-btn" title="Logout">X</button>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <div class="auth-signin-wrapper">
                <div id="sidebar-g_id_signin"></div>
            </div>
        `;
    }
}

async function handleCredentialResponse(response) {
    if (!response || !response.credential) {
        console.error("[AUTH] Empty response.");
        return;
    }
    console.log("[AUTH] Validating token...");
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg) statusMsg.textContent = "SYNCHRONIZING IDENTITY...";

    try {
        const res = await fetch(`${window.API_BASE}/login/google/authorized`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.ok) {
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            window.revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (statusMsg) statusMsg.textContent = `IDENTITY MISMATCH: ${data.error}`;
        }
    } catch(e) { 
        if (statusMsg) statusMsg.textContent = "CONNECTION FAILURE.";
    }
}

function logout(force = false) {
    if (!force && !confirm("Terminate session?")) return;
    localStorage.removeItem('nexus_user_data');
    location.reload();
}

let terminalRevealed = false;
async function revealTerminal(name) {
    console.log("[AUTH] Revealing Terminal for:", name);
    if (terminalRevealed) return;
    terminalRevealed = true;

    const overlay = document.getElementById('auth-screen');
    const monitor = document.getElementById('main-monitor');
    const terms   = document.getElementById('terms-modal');
    
    if (overlay) overlay.style.display = 'none';
    if (terms)   terms.style.display   = 'none';
    if (monitor) {
        monitor.style.display = 'flex';
        monitor.offsetHeight; 
    }
    
    document.body.classList.remove('auth-locked');
    
    // Ensure core references are captured
    window.output = document.getElementById('terminal-output');
    window.input = document.getElementById('terminal-input');

    printToTerminal(`[AUTH] Identity Verified: ${name}.`, 'conn-ok');
    printToTerminal(`Nexus online. Type 'help' for command manifest.`, 'sys-msg');
}

window.showTermsFromWall = () => {
    document.getElementById('terms-modal').style.display = 'flex';
};

window.hideTerms = () => {
    document.getElementById('terms-modal').style.display = 'none';
};

async function submitGuestAuth() {
    const btn = document.getElementById('agree-btn');
    if (btn) btn.textContent = 'LINKING...';
    if (btn) btn.disabled = true;

    // Minimal delay for feedback
    await new Promise(r => setTimeout(r, 400));

    try {
        const res = await fetch(`${window.API_BASE}/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Guest' })
        });
        const data = await res.json();
        if (data.ok) {
            if (btn) btn.textContent = 'ESTABLISHED';
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            
            // Allow 500ms to see the 'ESTABLISHED' success state
            setTimeout(() => {
                revealTerminal(data.name);
                renderAuthSection();
            }, 500);
        } else {
            if (btn) btn.textContent = 'RETRY';
            if (btn) btn.disabled = false;
        }
    } catch(e) {
        if (btn) btn.textContent = 'ERROR';
        if (btn) btn.disabled = false;
    }
}

// Exports
window.initGoogleAuth = initGoogleAuth;
window.handleCredentialResponse = handleCredentialResponse;
window.revealTerminal = revealTerminal;
window.logout = logout;
window.submitGuestAuth = submitGuestAuth;
