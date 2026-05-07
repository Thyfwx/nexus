//  GOOGLE AUTHENTICATION v5.2.6
// =============================================================
let _googleClientID = '616205887439-s1l0out61vlu0l81307q9g64oai3gnur.apps.googleusercontent.com';
let _authInited = false;
let _termsScrolled = false;

async function initGoogleAuth() {
    if (_authInited) return;
    console.log("[AUTH] Initiating Identity Uplink...");
    // Only render the auth card if it isn't already in the DOM. Otherwise we wipe
    // the dropdown HTML mid-click on every 200ms/800ms/2000ms retry tick — which is
    // exactly what was making the dropdown disappear right after the user clicked it.
    if (!document.querySelector('#auth-section .auth-user-card, #auth-section #sidebar-g_id_signin')) {
        renderAuthSection();
    }

    // Show a placeholder spinner immediately so the user sees "loading" instead of empty space.
    const placeholder = document.getElementById('main-g_id_signin');
    if (placeholder && !placeholder.dataset.placeholded) {
        placeholder.dataset.placeholded = '1';
        placeholder.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:44px; color:#888; font-size:0.78rem; letter-spacing:1.5px;">⏳ loading Google…</div>';
    }

    const setupGoogle = () => {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
        if (_authInited) return true;

        try {
            google.accounts.id.initialize({
                client_id: _googleClientID,
                callback: window.handleCredentialResponse,
                ux_mode: 'popup',
                auto_select: false,
            });
            const renderBtn = (id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.innerHTML = ''; // clear loading placeholder
                el.style.minHeight = '44px';
                el.style.visibility = 'visible';
                google.accounts.id.renderButton(el, {
                    type: 'standard', shape: 'rectangular', theme: 'filled_blue', text: 'signin_with',
                    size: id.includes('main') ? 'large' : 'medium',
                    width: id.includes('main') ? 280 : 200,
                });
            };
            renderBtn('main-g_id_signin');
            renderBtn('sidebar-g_id_signin');
            _authInited = true;
            console.log("[AUTH] Google button rendered.");
            return true;
        } catch (e) {
            console.error("[AUTH] Google GSI Error:", e);
            return false;
        }
    };

    // Aggressive polling — check every 80ms for the first 4 seconds, then back off
    if (setupGoogle()) return;
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        if (setupGoogle() || attempts > 80) {
            clearInterval(poll);
            if (!_authInited) {
                console.warn("[AUTH] GSI library never loaded.");
                if (placeholder) placeholder.innerHTML = '<div style="color:#f55; font-size:0.78rem; padding:10px; text-align:center;">Google sign-in failed to load. Check network or refresh.</div>';
            }
        }
    }, 80);
}

// Bullet-proof init — fire from every possible event. First-reload reliability matters.
if (typeof window !== 'undefined') {
    const _kick = () => { try { initGoogleAuth(); } catch(_) {} };
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', _kick);
    } else {
        _kick(); // DOM already parsed
    }
    window.addEventListener('load', _kick);
    // Also retry whenever the GSI script finishes loading after our first try
    setTimeout(_kick, 200);
    setTimeout(_kick, 800);
    setTimeout(_kick, 2000);
}

function renderAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    const user = JSON.parse(localStorage.getItem('nexus_user_data') || 'null');
    const ownerEmail = 'lovexdgamer@gmail.com';
    const isOwner = user && user.email === ownerEmail;

    if (user && user.name) {
        const isGoogle = !!user.email && user.email !== 'guest@local';
        const avatarHtml = user.picture
            ? `<img src="${user.picture}" class="auth-avatar" alt="User">`
            : `<div class="auth-avatar-initials">${user.name[0].toUpperCase()}</div>`;
        // Async-fetch premium status and add badge if user is a supporter
        if (isGoogle) {
            fetch(`${window.API_BASE || ''}/api/me/premium`, { credentials: 'same-origin' })
                .then(r => r.json()).then(d => {
                    if (d.premium) {
                        const status = document.querySelector('.auth-status');
                        if (status) status.innerHTML += ' <span style="color:#fa0;">· ⭐ PREMIUM</span>';
                    }
                }).catch(() => {});
        }

        authSection.innerHTML = `
            <div class="auth-user-card" onclick="window.toggleUserMenu(event)" style="margin-bottom: 5px;">
                ${avatarHtml}
                <div class="auth-info">
                    <div class="auth-name">${user.name}</div>
                    <div class="auth-status" style="font-size: 0.5rem; margin-top: 2px;">[ ${isGoogle ? 'ACCOUNT_SYNCED' : 'EPHEMERAL_GUEST'} ]</div>
                </div>
                <div id="user-dropdown" class="user-dropdown">
                    ${isOwner ? '<div class="dropdown-item" data-tip="Owner-only: live diagnostics, key status, source viewer, crash log" onclick="event.stopPropagation(); window.toggleDevPanel()">DEV PANEL</div>' : ''}
                    <div class="dropdown-item" data-tip="Identity, persistent memory, mode and AI capabilities" onclick="event.stopPropagation(); window.toggleNeuralProfile()">AI PROFILE</div>
                    <div class="dropdown-item" data-tip="${isGoogle ? 'Your chats and generated images, kept for 30 days' : 'Your chats and images for THIS SESSION ONLY (cleared when tab closes)'}" onclick="event.stopPropagation(); window.showUserHistory()">HISTORY</div>
                    <div class="dropdown-item" data-tip="Visual, voice, memory and recovery settings" onclick="event.stopPropagation(); window.toggleA11yPanel()">SYSTEM SETTINGS</div>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-item" style="color:#fa0;" data-tip="Tip the dev — every $5 buys ~1,500 SFW image generations for the community. Keeps Nexus free for everyone." onclick="event.stopPropagation(); window.open('https://buymeacoffee.com/thyfwx', '_blank', 'noopener')">☕ SUPPORT NEXUS</div>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-item logout-item" data-tip="End your session and return to the lobby" onclick="event.stopPropagation(); window.logout()">LOGOUT</div>
                </div>
            </div>
        `;
    } else {
        authSection.innerHTML = `<div id="sidebar-g_id_signin"></div>`;
    }
}

window.toggleUserMenu = function(e) {
    // Clicks inside the dropdown ITEMS — let item handler fire AND auto-close the dropdown
    // so the user doesn't have to click anywhere else to dismiss it.
    if (e && e.target && e.target.closest('.dropdown-item')) {
        document.getElementById('user-dropdown')?.classList.remove('open');
        return;
    }
    // Dividers / dropdown-bg clicks: just no-op (don't toggle)
    if (e && e.target && e.target.closest('.dropdown-divider, #user-dropdown')) return;
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.toggle('open');
};

// Dropdown stays open until: user clicks the user-card again, presses Escape, picks an item,
// clicks anywhere outside the auth section, or opens any other panel.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('user-dropdown')?.classList.remove('open');
    }
});

// Click-outside dismissal — any click that's NOT on the auth user card or its dropdown closes it.
document.addEventListener('click', (e) => {
    const dd = document.getElementById('user-dropdown');
    if (!dd || !dd.classList.contains('open')) return;
    if (e.target.closest('.auth-user-card')) return; // click on the card itself — toggle handler runs
    dd.classList.remove('open');
}, true);

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
            // Owner is exempt from the adult gate (their own site, already 18+).
            // Other Google users see the 18+ confirmation modal once. After confirming,
            // it's stored locally and not re-shown unless they clear browser data.
            const ownerEmail = 'lovexdgamer@gmail.com';
            const isOwner = data.email === ownerEmail;
            const alreadyConfirmed = localStorage.getItem('nexus_adult_confirmed') === 'true';
            if (!isOwner && !alreadyConfirmed && document.getElementById('adult-gate-modal')) {
                // Stash the user data — only commit it to localStorage AFTER they confirm
                window._pendingGoogleUser = data;
                document.getElementById('adult-gate-modal').style.display = 'flex';
                if (statusMsg) statusMsg.textContent = "ONE MORE STEP — confirm adult gate";
                return;
            }
            localStorage.setItem('nexus_user_data', JSON.stringify(data));
            if (isOwner) localStorage.setItem('nexus_adult_confirmed', 'true');
            window.revealTerminal(data.name);
            renderAuthSection();
        } else {
            if (statusMsg) statusMsg.textContent = `IDENTITY MISMATCH: ${data.error}`;
        }
    } catch(e) {
        if (statusMsg) statusMsg.textContent = "CONNECTION FAILURE.";
    }
}

// Adult gate handlers — bound to the modal's CONFIRM and SIGN OUT buttons in login.html
window._confirmAdultGate = function() {
    const data = window._pendingGoogleUser;
    if (!data) return;
    localStorage.setItem('nexus_adult_confirmed', 'true');
    localStorage.setItem('nexus_user_data', JSON.stringify(data));
    window._pendingGoogleUser = null;
    const modal = document.getElementById('adult-gate-modal');
    if (modal) modal.style.display = 'none';
    window.revealTerminal(data.name);
    renderAuthSection();
};

window._declineAdultGate = function() {
    // User declined 18+ confirmation — abort the sign-in entirely.
    window._pendingGoogleUser = null;
    localStorage.removeItem('nexus_user_data');
    localStorage.removeItem('nexus_adult_confirmed');
    const modal = document.getElementById('adult-gate-modal');
    if (modal) modal.style.display = 'none';
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg) statusMsg.textContent = "Sign-in cancelled. You can continue as a guest below.";
};

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
    // Show the agreement checkbox + ENTER AS GUEST button (this is the guest-signup path)
    const area    = document.getElementById('terms-agreement-area');
    const agreeBtn = document.getElementById('agree-btn');
    if (area)     area.style.display = '';
    if (agreeBtn) agreeBtn.style.display = '';
    setupTermsInteraction();
};

// Read-only view — no agreement gate, no guest signup. For people just wanting to read terms.
window.showTermsReadOnly = () => {
    const modal = document.getElementById('terms-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    // Hide the agreement checkbox area + the ENTER AS GUEST button. Just show terms + CANCEL.
    const area     = document.getElementById('terms-agreement-area');
    const agreeBtn = document.getElementById('agree-btn');
    const errEl    = document.getElementById('terms-error-msg');
    if (area)     area.style.display = 'none';
    if (agreeBtn) agreeBtn.style.display = 'none';
    if (errEl)    errEl.classList.remove('active');
};

window.hideTerms = () => {
    const modal = document.getElementById('terms-modal');
    if (!modal) return;
    modal.style.display = 'none';
    // Restore the agreement area visibility for next time the guest flow opens
    const area     = document.getElementById('terms-agreement-area');
    const agreeBtn = document.getElementById('agree-btn');
    if (area)     area.style.display = '';
    if (agreeBtn) agreeBtn.style.display = '';
};

function setupTermsInteraction() {
    const content = document.getElementById('terms-content');
    const check   = document.getElementById('terms-check');
    const area    = document.getElementById('terms-agreement-area');
    const errEl   = document.getElementById('terms-error-msg');

    if (!content || !check || !area) return;

    _termsScrolled = false;
    check.checked = false;
    // NOTE: don't set `disabled` — disabled inputs swallow click events in most browsers,
    // so the user wouldn't see the scroll warning. We block the toggle via JS instead.
    check.disabled = false;
    area.classList.remove('active');
    if (errEl) errEl.classList.remove('active');

    content.onscroll = () => {
        if (_termsScrolled) return;
        if (content.scrollTop + content.clientHeight >= content.scrollHeight - 24) {
            _termsScrolled = true;
            area.classList.add('active');
        }
    };

    // Only the checkbox itself fires the warning — label clicks silently block.
    check.onclick = (e) => {
        if (!_termsScrolled) {
            e.preventDefault();
            check.checked = false;
            showTermsError('Scroll to the bottom of the terms before agreeing.');
        }
    };
    area.onclick = (e) => {
        if (!_termsScrolled && e.target !== check) {
            e.preventDefault();
            e.stopPropagation();
            check.checked = false;
        }
    };
}

function showTermsError(msg) {
    const el = document.getElementById('terms-error-msg');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('active');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('active'), 3000);
}

async function submitGuestAuth() {
    if (!_termsScrolled) { showTermsError('Scroll to the bottom of the terms before agreeing.'); return; }
    const check = document.getElementById('terms-check');
    if (!check || !check.checked) { showTermsError('Check the box to confirm.'); return; }

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
