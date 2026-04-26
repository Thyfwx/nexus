//  GOOGLE AUTHENTICATION v5.2.6
// =============================================================
let _googleClientID = '616205887439-s1l0out61vlu0l81307q9g64oai3gnur.apps.googleusercontent.com';
let _authInited = false;
let _termsScrolled = false;

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
                        width: id.includes('main') ? '280' : '200'
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

    // Keep header user display in sync
    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.textContent = user && user.name ? user.name.toUpperCase() : 'GUEST';

    if (user && user.name) {
        const isGoogle = !!user.email && user.email !== 'guest@local';
        const avatarHtml = user.picture 
            ? `<img src="${user.picture}" class="auth-avatar" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--accent); flex-shrink:0;" alt="User">`
            : `<div class="auth-avatar-initials" style="width:32px; height:32px; border-radius:50%; background:#111; border:1px solid var(--accent); display:flex; align-items:center; justify-content:center; font-size:0.6rem; color:var(--accent); flex-shrink:0;">${user.name[0].toUpperCase()}</div>`;
            
        authSection.innerHTML = `
            <div class="auth-user-card" style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid rgba(0,255,255,0.1); margin-bottom:15px;">
                ${avatarHtml}
                <div class="auth-info" style="flex:1; min-width:0;">
                    <div class="auth-name" style="color:#fff; font-size:0.65rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name}</div>
                    <div style="font-size:0.5rem; color:#555;">[ ${isGoogle ? 'VERIFIED' : 'GUEST'} ]</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.logout()" class="auth-logout-btn" title="Logout" style="background:none; border:1px solid #f55; color:#f55 !important; width:22px; height:22px; border-radius:4px; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;">X</button>
                </div>
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
    window.location.href = './login.html';
}

async function revealTerminal(name) {
    console.log("[AUTH] Neural link established for:", name);
    // On login.html — redirect to terminal
    if (document.getElementById('auth-screen')) {
        window.location.href = './';
        return;
    }
    // On terminal page — just refresh the sidebar user card
    renderAuthSection();
}

window.showTermsFromWall = () => {
    const modal = document.getElementById('terms-modal');
    modal.style.display = 'flex';
    setupTermsInteraction();
};

window.hideTerms = () => {
    document.getElementById('terms-modal').style.display = 'none';
};

function setupTermsInteraction() {
    const content = document.getElementById('terms-content');
    const check = document.getElementById('terms-check');
    const area = document.getElementById('terms-agreement-area');
    const box = document.getElementById('terms-box');

    if (!content || !check || !area || !box) return;

    // Reset state
    _termsScrolled = false;
    check.checked = false;
    area.classList.remove('active');

    // Scroll Monitoring
    content.onscroll = () => {
        if (_termsScrolled) return;
        const pad = 20;
        if (content.scrollTop + content.clientHeight >= content.scrollHeight - pad) {
            console.log("[TERMS] Bottom reached. Unlocking gate.");
            _termsScrolled = true;
            area.classList.add('active');
        }
    };

    // Capture clicks ONLY on the actual checkbox box
    check.onclick = (e) => {
        if (!_termsScrolled) {
            e.preventDefault();
            showScrollError();
        }
    };
    
    // Explicitly prevent the label from triggering the checkbox or the error
    area.onclick = (e) => {
        if (!_termsScrolled && e.target.tagName === 'LABEL') {
            e.preventDefault();
        }
    };
}

function showScrollError() {
    const el = document.getElementById('terms-error-msg');
    if (!el) return;

    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 3000);
}

async function submitGuestAuth() {
    if (!_termsScrolled) {
        console.warn("[AUTH] Gate Locked: Terms not fully read.");
        showScrollError();
        return;
    }

    const check = document.getElementById('terms-check');
    if (!check || !check.checked) {
        // If they scrolled but didn't check, show the error as well
        showScrollError();
        return;
    }

    const btn = document.getElementById('agree-btn');
    if (btn) {
        btn.textContent = 'LINKING...';
        btn.style.borderColor = 'var(--accent)';
    }
    // No more manual disabled here to allow the click-error logic to remain active if somehow reverted
    // Actually, keep it for the linking state
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
            if (btn) {
                btn.textContent = 'RETRY';
                btn.disabled = false;
            }
        }
    } catch(e) {
        if (btn) {
            btn.textContent = 'ERROR';
            btn.disabled = false;
        }
    }
}

// Exports
window.initGoogleAuth = initGoogleAuth;
window.handleCredentialResponse = handleCredentialResponse;
window.revealTerminal = revealTerminal;
window.logout = logout;
window.submitGuestAuth = submitGuestAuth;
window.renderAuthSection = renderAuthSection;

// Render user card immediately on terminal page (no Google script needed)
if (document.getElementById('auth-section')) renderAuthSection();
