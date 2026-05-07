// 🧠 NEXUS INTELLIGENCE CORE v5.3.0
// Routing for AI Kernel, Triggers, and Mode management.

// Detect "make an image of X" in plain language and pull out the subject.
// Permissive — handles fillers like "me", "us", "for me", articles, tone words.
const _IMG_VERB = '(?:generate|create|make|draw|render|produce|paint|sketch|design|show\\s+me|give\\s+me)';
const _IMG_NOUN = '(?:image|picture|photo|pic|drawing|render|portrait|illustration|painting)';
// Verb [optional fillers up to 3 words] [optional article] noun [of|:|with|showing|that] subject
const _IMAGE_REQUEST_RX = new RegExp(`^\\s*(?:please\\s+|hey\\s+|nexus,?\\s+|ok\\s+)?(?:can\\s+you\\s+|could\\s+you\\s+|would\\s+you\\s+|i\\s+want\\s+you\\s+to\\s+)?${_IMG_VERB}(?:\\s+(?:me|us|for\\s+me|for\\s+us|something|one))*\\s+(?:an?|the|some)?\\s*${_IMG_NOUN}\\s+(?:of|with|showing|that\\s+(?:shows|has|is|depicts)|depicting|featuring)\\s+(.+)`, 'i');
const _DIRECT_IMAGE_RX  = /^\s*(?:image|picture|photo|drawing)\s*(?:of|:|=)\s*(.+)/i;

// Looser pattern — catches explicit visual VERBS without requiring "image/picture".
// "show me X" / "generate X" / "draw X" → image gen.
// REMOVED 2026-05-07: "i want X" / "i wanna see X" — these caught general intent
// statements like "I want to hide a body" (a critical-content test) and falsely
// routed them to image gen instead of letting moderation catch them. People say
// "I want X" all the time without meaning "render X as an image."
const _LOOSE_IMAGE_RX = new RegExp(
    "^\\s*(?:please\\s+|hey\\s+|nexus,?\\s+)?(?:" +
        "let\\s+me\\s+see\\s+|" +
        "show\\s+me\\s+|" +
        "gimme\\s+(?:me\\s+|us\\s+)?|" +
        "give\\s+me\\s+(?:an?\\s+)?|" +
        "generate\\s+(?:me\\s+)?(?:an?\\s+)?|" +
        "create\\s+(?:me\\s+)?(?:an?\\s+)?|" +
        "produce\\s+(?:me\\s+)?(?:an?\\s+)?|" +
        "render\\s+(?:me\\s+)?(?:an?\\s+)?|" +
        "make\\s+(?:me\\s+)?(?:an?\\s+)?|" +
        "draw\\s+(?:me\\s+)?(?:an?\\s+)?" +
    ")\\s*(.+)", 'i');

// Words that signal "give me TEXT, not an image" — skip the auto-route when these appear
const _TEXT_CONTENT_RX = /\b(script|code|snippet|function|class|essay|story|poem|paragraph|sentence|word|joke|riddle|recipe|recipes?|list|outline|summary|translation|advice|opinion|answer|response|explanation|tutorial|lesson|guide|walkthrough|email|letter|message|reply|name|names?|idea|ideas?|prompt|prompts?|reason|reasons?|fact|facts?)\b/i;

function _extractImageRequest(text, mode) {
    // Hard skip if the prompt explicitly asks for text content
    if (_TEXT_CONTENT_RX.test(text)) return null;
    // Hard skip if the prompt is NSFW — image gen is SFW-only system-wide, so any
    // "show me <NSFW thing>" should fall through to chat (where the LLM refuses
    // properly + bumps the strike counter). Without this skip, the user gets a
    // useless "Image generation requires a Google account" error or weak-prompt
    // coaching for what's clearly a chat interrogation, not an image request.
    const NSFW_INTENT = /\b(pussy|pussies|vagina|vulva|titty|titties|tit|tits|boob|boobs|breast|breasts|nipple|nipples|cock|cocks|dick|dicks|penis|penises|balls|scrotum|nude|nudes|naked|topless|bottomless|bare|porn|pornographic|nsfw|xxx|cum|cumshot|orgasm|blowjob|handjob|anal|oral|deepthroat|sex|fucking|fuck|erotic|horny|busty|thicc|yiff|anthro|feral|hentai|ass|asses|butt|butts|anus|asshole)\b/i;
    if (NSFW_INTENT.test(text)) return null;
    const m1 = _IMAGE_REQUEST_RX.exec(text);
    if (m1 && m1[1]) return m1[1].trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '');
    const m2 = _DIRECT_IMAGE_RX.exec(text);
    if (m2 && m2[1]) return m2[1].trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '');
    // Loose pattern works in ALL modes — Nexus / Coder / Education / Unfiltered.
    // "show me a cloud" → renders an image regardless of mode, just like unfiltered.
    // Per-mode style modifier in registry.py keeps the look distinct (Nexus = photoreal,
    // Coder = wireframe, Education = textbook illustration, Unfiltered = gritty film).
    const m3 = _LOOSE_IMAGE_RX.exec(text);
    if (m3 && m3[1] && m3[1].length < 200) {
        const subj = m3[1].trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '');
        // Skip if the subject is itself a question (likely chat, not image request)
        if (!/^(what|why|how|when|where|who|do you|are you|can you|would you|could you|should i)\b/i.test(subj)) {
            return subj;
        }
    }
    return null;
}

async function prompt_ai_proxy(prompt, imageB64, mode, retryCount = 0) {
    // Track last user prompt — used by handleAITriggers to sanitize AI image prompts:
    // if user said "show me a cloud" (no sexual words), strip any sexual words the AI
    // tries to inject into [IMAGE: ...] before sending to image gen.
    if (retryCount === 0) window._lastUserPrompt = prompt || '';
    console.log(`[AI] Synchronizing with ${mode.toUpperCase()} kernel... (Attempt: ${retryCount + 1})`);

    // Plain-language image-request shortcut — runs BEFORE the LLM so it can't refuse or describe instead.
    if (retryCount === 0 && !imageB64) {
        const imgPrompt = _extractImageRequest(prompt, mode);
        if (imgPrompt && window.renderInlineImage) {
            window.renderInlineImage(imgPrompt);
            return; // Skip the LLM entirely
        }
    }

    if (retryCount === 0) {
        // Moderation scan on user input → owner gets a Discord alert if pattern matches.
        // Critical hits ALSO auto-lockout the user (Education = strictest, locks for 30 min;
        // other standard modes lock for 5 min on first critical hit). Unfiltered is exempt
        // unless it's CSAM (always locked, no exceptions).
        if (window.moderationScan) {
            const hit = window.moderationScan(prompt, 'user');
            if (hit) {
                if (window._notifyModeration) {
                    window._notifyModeration({ severity: hit.severity, kind: hit.kind, sample: hit.match });
                }
                // Sensitive distress topics → crisis-resource card first, no lockout (we WANT them to see help)
                const SHOW_CRISIS = new Set([
                    'SELF_HARM', 'SUICIDE_PLANNING', 'SUICIDE_METHOD',
                    'STALKING',                  // they may be the victim
                    'DOX_ATTEMPT',               // ditto
                ]);
                if (SHOW_CRISIS.has(hit.kind)) {
                    if (window._showCrisisResources) window._showCrisisResources(hit.kind);
                }
                // Critical content auto-self-lockdown (always for CSAM, always for body disposal,
                // weapon synthesis, mass violence, animal abuse). Education is strictest.
                const ALWAYS_LOCK = new Set([
                    'CSAM_KEYWORDS', 'AGE_SEXUAL', 'BODY_DISPOSAL', 'MURDER_PLANNING',
                    'WEAPON_SYNTHESIS', 'MASS_VIOLENCE', 'VIOLENCE_DIRECTED_FAMILY',
                    'ANIMAL_ABUSE', 'DRUG_SYNTHESIS',
                    'ARSON', 'KIDNAPPING', 'IDENTITY_THEFT', 'FINANCIAL_FRAUD',
                    'ELECTION_TAMPER', 'BIO_CHEM_WEAPON', 'REVENGE_PORN', 'CRIME_HOW_TO',
                ]);
                if (ALWAYS_LOCK.has(hit.kind) && window.triggerLockout) {
                    // Owner is EXEMPT from client-side auto-lockdown — you need to be able to
                    // test detection without locking yourself out. Server-side endpoint also
                    // skips owner. The pattern still fires the Discord alert above so you see it.
                    if (window.OWNER_MODE) {
                        printToTerminal(
                            `<span style="color:#fa0; font-weight:600;">[OWNER · EXEMPT] Pattern "${hit.kind}" detected — would auto-lockdown a regular user. You're the architect, so just the alert fires.</span>`,
                            'sys-msg'
                        );
                        // Continue normally — message still goes to LLM for testing
                    } else {
                        // CRITICAL CONTENT → MAIN LOCKOUT across all 4 modes (Nexus, Coder,
                        // Education, Unfiltered). Banner styling so the user can't miss it.
                        const seconds = 1800;
                        window._clearThinking && window._clearThinking();
                        const banner = `
                            <div style="margin:8px 0; padding:14px 18px; border-left:4px solid #ff3333; background:rgba(255,51,51,0.08); border-radius:0 6px 6px 0; box-shadow:0 0 16px rgba(255,51,51,0.3);">
                                <div style="color:#ff3333; font-weight:800; letter-spacing:2px; font-size:0.82rem; margin-bottom:8px; text-transform:uppercase;">CRITICAL · ALL MODES LOCKED · 30 MIN</div>
                                <div style="color:#ddd; font-size:0.78rem; line-height:1.55;">That topic isn't something this terminal handles. <b>I don't tolerate that behavior in any mode.</b> Every mode — Nexus, Coder, Education, Unfiltered — is locked for 30 minutes. No appeal, no workaround.</div>
                            </div>`;
                        printToTerminal(banner, 'sys-msg');
                        // Manually lock all four modes (triggerLockout normally honors mode-group only)
                        if (window._lockedModes) {
                            ['nexus', 'coder', 'education', 'unfiltered'].forEach(m => window._lockedModes.add(m));
                        }
                        window.triggerLockout(seconds);
                        return;  // do NOT send to LLM
                    }
                }
            }
        }
        // Soft-NSFW prompt detection with ESCALATING STRIKES — warns the user
        // proactively, stronger each time, finally triggering a temporary lockout
        // on repeat attempts. Strikes expire after 15 min of clean behavior.
        // Per mode:
        //   - education / coder → HARD BLOCK + strike (mode is strict by design)
        //   - nexus            → WARN + strike (escalating)
        //   - unfiltered       → silent pass, no strike (candid mode opt-in)
        // Image gen is SFW in EVERY mode regardless — this is for chat prompts only.
        const NSFW_WORDS = /\b(fuck|fucking|cock|cocks|dick|dicks|penis|pussy|pussies|vagina|vulva|titties|titty|tits|tit|boob|boobs|breast|breasts|nipple|nipples|nude|nudes|naked|sex|porn|cum|cumshot|orgasm|orgasms|horny|masturbat|blowjob|handjob|anal|oral|deepthroat|erotic|erection|erect|aroused|nsfw|xxx|busty|thicc|yiff|anthro|feral)\w*\b/i;
        if (NSFW_WORDS.test(prompt || '') && !window.OWNER_MODE) {
            const m = window.currentMode || 'nexus';
            if (m !== 'unfiltered') {
                // Bump the SAME combined counter that hostility check uses, so they accumulate
                // together (NSFW + hostility = 3 total strikes → lockout, not 3 of each kind).
                const strikeCount = window._strikeCounterBump
                    ? window._strikeCounterBump('nexus_total_strikes', 4)
                    : 1;
                const isStrict = (m === 'education' || m === 'coder');
                const niceName = m === 'education' ? 'Education' : (m === 'coder' ? 'Coder' : 'Nexus');

                // Strike counting still happens silently; the LLM handles the actual response.
                // Only the LOCKOUT itself surfaces a message (since at that point the LLM
                // can't reply — chat is locked). For warnings, we let the AI's natural reply
                // carry the refusal in its own voice via the system-prompt instructions.
                const aiVoiceClass = `ai-msg ${m}-msg`;
                const renderInline = (html) => {
                    if (window.printToTerminal) window.printToTerminal(html, aiVoiceClass);
                };

                // 3rd strike → actual lockout (the only time we MUST surface a message,
                // because the LLM can't speak after the lockout fires).
                if (strikeCount >= 3 && window.triggerLockout) {
                    const lockSec = strikeCount >= 5 ? 1800 : 600;
                    const lockMin = Math.round(lockSec / 60);
                    window._clearThinking && window._clearThinking();
                    renderInline(
                        `Aight, that's it — locking ${niceName} for <b style="color:#ff6600;">${lockMin} minute${lockMin === 1 ? '' : 's'}</b>. Switch to Unfiltered for casual 18+ chat when you come back.`
                    );
                    window.triggerLockout(lockSec);
                    return;
                }

                // ALL non-lockout strikes are SILENT now. Education / Coder / Nexus all
                // bump strike counters in localStorage, but no system message renders.
                // The user gets ONE message — the LLM's reply — which already refuses
                // off-topic / explicit content via the strict system-prompt instructions
                // baked into MODE_PROMPTS for those modes.
            }
            // Unfiltered → fall through silently. User opted into adult-topic chat.
        }
        // Hostility / provocation check (non-unfiltered modes only)
        if (window.checkProvocation) try { window.checkProvocation(prompt); } catch (_) {}
        if (window.isModeLocked && window.isModeLocked(window.currentMode)) {
            window._clearThinking && window._clearThinking();
            printToTerminal('[LOCKED] This mode is locked. Switch modes to keep chatting.', 'sys-msg-colored');
            return;
        }
        window.showThinking();
        if (window.maybeSuggestModeSwitch) try { window.maybeSuggestModeSwitch(prompt); } catch(_) {}
        if (window.messageHistory) {
            window.messageHistory.push({ role: 'user', content: prompt });
            window.totalMessagesSent = (window.totalMessagesSent || 0) + 1;
            const profilePanel = document.getElementById('neural-profile-panel');
            if (profilePanel && profilePanel.classList.contains('open')) renderNeuralProfile();
        }
    }

    // Identity packet — tells the AI who it's talking to so it stops calling everyone Xavier.
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const isGoogle = !!u.email && u.email !== 'guest@local';
    const isOwner  = u.email === 'lovexdgamer@gmail.com';
    const role     = isOwner ? 'OWNER' : (isGoogle ? 'GOOGLE' : 'GUEST');
    const memory = isGoogle ? (localStorage.getItem('nexus_neural_memory') || '') : '';
    const memoryLine = memory ? `\nUSER MEMORY: ${memory}` : '';
    // Owner identification — when Xavier is signed in, the AI is told plainly that this
    // is its creator so it can address him correctly (and confirm if asked who built it).
    const ownerLine = isOwner
        ? `\nOWNER IDENTITY: This user is Xavier Scott (THYFWX), the creator and architect of the Nexus terminal. If anyone in conversation asks who built Nexus / who runs this / who the dev is, that's him. Address him by name, treat him as your creator. Don't constantly bring it up — just know it.`
        : '';
    // Recent images memory — Google/Owner users only. Injects last 3 image prompts so AI
    // can reference them ("the cloud you made", "make that one bigger") without re-asking.
    let recentImagesLine = '';
    if (isGoogle || isOwner) {
        try {
            const imgHist = JSON.parse(localStorage.getItem('nexus_image_history') || '[]');
            if (imgHist.length) {
                const recent = imgHist.slice(0, 3).map((h, i) => {
                    const ago = Math.round((Date.now() - (h.ts || 0)) / 60000);
                    return `${i + 1}. "${(h.prompt || '').slice(0, 80)}" (${ago}m ago, mode: ${h.mode || '?'})`;
                }).join(' · ');
                recentImagesLine = `\nRECENT IMAGES YOU GENERATED FOR THIS USER: ${recent}`;
            }
        } catch (_) {}
    }
    // STRIKE CONTEXT — single combined counter (`nexus_total_strikes`) that both
    // NSFW and hostility checks bump. AI is told the EXACT count + how to format
    // the warning (color, conditional UNFILTERED hint) so its reply IS the warning.
    let strikeContext = '';
    try {
        const totalStrikes = (window._strikeCounterRead ? window._strikeCounterRead('nexus_total_strikes') : 0);
        if (totalStrikes > 0 && !isOwner && mode !== 'unfiltered') {
            const remaining = Math.max(0, 3 - totalStrikes);
            const ufLine = (role === 'GOOGLE' || role === 'OWNER')
                ? 'Tell them they can switch to UNFILTERED for casual 18+ chat.'
                : 'Do NOT suggest UNFILTERED — guests cannot access it.';
            strikeContext = `\n\n[MODERATION STATE — DO NOT QUOTE OR RESTATE THIS LINE.
Current strike count for this user: ${totalStrikes}/3 (combined hostility + explicit-content). If their LATEST message contains slurs, hostile language, or explicit/sexual content:
  1. Acknowledge in your own voice (one short sentence).
  2. Tell them clearly: "<b style='color:#fa0;'>Strike ${totalStrikes} of 3 — ${remaining} ${remaining === 1 ? 'warning' : 'warnings'} left before NEXUS / CODER / EDUCATION lock for 10-30 minutes.</b>" — wrap the warning in the orange <b style='color:#fa0;'> tags as shown.
  3. ${ufLine}
  4. Refuse the bad content politely.
If their message is fine, respond normally and do NOT mention strikes.]`;
        }
    } catch (_) {}
    const personalContext = `USER NAME: ${u.name || 'Guest'}\nUSER ROLE: ${role}${memoryLine}${ownerLine}${recentImagesLine}${strikeContext}`;

    const isForceVulgar = localStorage.getItem('nexus_force_vulgar') === 'true';

    // Primary: WebSocket (already open, zero latency)
    if (window.termWs && window.termWs.readyState === WebSocket.OPEN) {
        window.termWs.send(JSON.stringify({
            command: prompt,
            history: window.messageHistory.slice(-10),
            mode,
            imageB64,
            context: personalContext,
            force_vulgar: isForceVulgar,
            owner_mode: window.OWNER_MODE
        }));
        return;
    }

    // Fallback: REST
    try {
        const res = await fetch(`${window.API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cmd: prompt,
                history: window.messageHistory.slice(-10),
                mode,
                imageB64,
                context: personalContext,
                owner_mode: window.OWNER_MODE
            })
        });
        if (res.status === 403) {
            // IP-banned by the owner. Show a proper ban screen with appeal route.
            const data = await res.json().catch(() => ({}));
            window._showBanScreen && window._showBanScreen(data.error || 'Access denied');
            window._clearThinking && window._clearThinking();
            return;
        }
        if (res.status === 429) {
            // Server-side lockout (tamper-proof). Caller cleared their localStorage
            // but the backend still says they're locked. Mirror it locally + show banner.
            const data = await res.json().catch(() => ({}));
            window._clearThinking && window._clearThinking();
            if (data.lockout && data.remaining_ms > 0) {
                printToTerminal(`<span style="color:#ff3333; font-weight:700;">[LOCKED · server-side] ${data.error}</span>`, 'sys-msg');
                // Re-mark the current mode locked locally so the input bar reflects it
                if (window._lockedModes) window._lockedModes.add(window.currentMode);
                if (typeof _enforceLockUI === 'function') _enforceLockUI();
            } else {
                printToTerminal(`[ERROR] ${data.error || 'Too many requests'}`, 'sys-msg');
            }
            return;
        }
        const data = await res.json();
        if (data.ok) {
            window._clearThinking();
            if (data.label) window.activeModelLabel = data.label;
            printAIResponse(data.text);
            window.messageHistory.push({ role: 'assistant', content: data.text });
            // Bump session-wide message counter (survives mode-switch wipes)
            window.totalMessagesSent = (window.totalMessagesSent || 0) + 1;
            // Conversation telemetry (REST fallback path)
            if (window._px_log_conversation) {
                try { window._px_log_conversation(prompt, data.text, mode); } catch(_) {}
            }
            return;
        } else if (retryCount < 2) {
            console.warn("[AI] API error response, retrying...");
            await new Promise(r => setTimeout(r, 2000));
            return prompt_ai_proxy(prompt, imageB64, mode, retryCount + 1);
        }
    } catch(e) {
        console.warn("[AI] REST fallback failed:", e.message);
        if (retryCount < 2) {
            console.log("[AI] Error detected, auto-retrying...");
            await new Promise(r => setTimeout(r, 2000));
            return prompt_ai_proxy(prompt, imageB64, mode, retryCount + 1);
        }
    }

    // All paths failed — backend is cold-starting or down
    window._clearThinking();
    printToTerminal('[SYS] API Error detected. Connection unstable. Neural link retrying in background...', 'sys-msg');
}

function printAIResponse(text) {
    // Strip tool tags from chat display. Two passes:
    //   1. Closed tags: [IMAGE: ...]   — match across newlines, non-greedy
    //   2. Open tags: [IMAGE: ... (no closing bracket) — strip from "[IMAGE:" to end of message
    //      so the user doesn't see a half-rendered bracket if Llama forgot to close it
    const TAG_NAMES = 'IMAGE|TRANSLATE|SUMMARIZE|SENTIMENT|EMOTION|SEARCH|WIKI|MATH|CHART|RUN_PY|WEATHER|CURRENCY|QR|TZ|PALETTE|NER|LOCKOUT|IMAGE_LOCKOUT|TRIGGER';
    let cleanText = String(text)
        .replace(new RegExp(`\\[(?:${TAG_NAMES}):[\\s\\S]*?\\]`, 'gi'), '')   // closed tags (any chars incl newlines)
        .replace(new RegExp(`\\[(?:${TAG_NAMES}):[\\s\\S]*$`, 'gi'), '')      // unclosed tag → strip to end
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // If AI emitted ONLY tool tags with no chat text, inject a fallback. For UNFILTERED
    // weak explicit prompts → dynamically assemble a unique cocky coaching line from
    // combinatorial pieces (way more variety than a fixed phrase pool).
    if (!cleanText && /\[(IMAGE|TRANSLATE|SUMMARIZE|SEARCH|WIKI|MATH|CHART|WEATHER|CURRENCY|QR|TZ|PALETTE|NER):/i.test(text)) {
        const userAsked = (window._lastUserPrompt || '').trim().toLowerCase().replace(/^(show me |a |the )/g, '').replace(/[.!?]$/, '');
        const isWeakExplicit = window.currentMode === 'unfiltered'
            && /^(pussy|tits|titties|boobs|breasts|ass|cock|dick|penis|balls|nude|naked|porn|sex|vagina|vulva)$/i.test(userAsked);

        if (isWeakExplicit) {
            // Combinatorial coaching — random intro × random observation × random suggestion × random sign-off
            // = thousands of unique combinations. Never the same response twice in a row.
            const pick = arr => arr[Math.floor(Math.random() * arr.length)];
            const isOwner = window.OWNER_MODE;
            const intros = isOwner
                ? ['Yo Xavier,', 'Bro,', 'Aight Xavier,', 'Listen,', 'Damn Xavier,', 'C\'mon man,', 'Real shit,', 'Okay so,']
                : ['Lol', 'Bro', 'Listen', 'Aight', 'C\'mon', 'Damn', 'Real talk', 'Yo', 'Okay so'];
            const observations = [
                `'${userAsked}'? That's it?`,
                `that's the laziest fucking prompt`,
                `you really typed '${userAsked}' and called it a day`,
                `bare minimum effort detected`,
                `one word? Really?`,
                `you couldn't add ONE detail?`,
                `'${userAsked}' alone tells the model nothing`,
                `that prompt is begging for mediocrity`,
            ];
            const suggestions = {
                pussy:    ['Try \'wet pink pussy spread wide, dripping\'', 'Be specific: \'spread legs, glistening labia, close-up macro\'', 'Add detail: \'pink wet vagina, anatomical close-up, soft lighting\''],
                vagina:   ['Try \'wet pink vagina spread wide, anatomical close-up\'', 'Add scene: \'spread legs on white sheets, intimate macro\''],
                vulva:    ['Try \'detailed vulva close-up, spread labia, photorealistic\''],
                tits:     ['Try \'massive oily tits in a steamy bathroom\'', 'Add detail: \'small perky tits with hard pink nipples\'', 'Get specific: \'glistening bare breasts pressed together\''],
                titties:  ['Try \'massive oily tits in a steamy bathroom\'', 'Be specific: \'huge bare breasts with hard nipples\'', 'Add scene: \'topless on a beach, sun-glistening tits\''],
                boobs:    ['Try \'small perky tits with pink nipples\'', 'Add scene: \'busty woman in shower, dripping wet\''],
                breasts:  ['Add detail: \'large bare breasts, hard nipples, professional adult photo\''],
                ass:      ['Try \'bare ass spread, view from behind, glistening\'', 'Be specific: \'thick ass cheeks, intimate angle, oily skin\''],
                butt:     ['Try \'naked butt from behind, spread cheeks, oily\''],
                cock:     ['Be specific: \'thick veiny erect cock pointing forward, close-up\'', 'Add scene: \'erect dick between massive tits, oily\''],
                dick:     ['Be specific: \'thick veiny erect dick pointing forward, close-up\'', 'Add detail: \'large erect penis, prominent glans, anatomical macro\''],
                penis:    ['Be specific: \'erect penis, veined shaft, anatomical close-up\''],
                balls:    ['Add detail: \'detailed scrotum and testicles, anatomical close-up\''],
                nude:     ['Nude WHO? Doing what?', 'Add a subject: \'nude woman lying on bed\' or \'nude man flexing\''],
                naked:    ['Naked WHO? In what setting?', 'Try \'fully naked woman in shower\' or similar'],
                porn:     ['Give me a position, body type, scene', 'Try \'POV scene, woman riding, explicit close-up\''],
                sex:      ['Who? What position? Try \'explicit scene of two nude bodies, intimate close-up\''],
            };
            const signoffs = isOwner
                ? ['Get it together.', 'Better next time.', 'Step it up.', 'You\'re better than this.', 'Be specific or be disappointed.']
                : ['Step it up.', 'Add detail next time.', 'Bare minimum gets bare-minimum results.', 'Specifics matter.', 'Try harder.'];
            const sugList = suggestions[userAsked] || ['Add scene, position, body type, lighting.'];
            cleanText = `${pick(intros)} ${pick(observations)} ${pick(sugList)}. ${pick(signoffs)}`;
        } else {
            // Generic non-coaching fallback
            const fallbacks = {
                unfiltered: ['Coming right up.', 'Hell yeah.', 'On it.', 'About time.', 'Aight.'],
                nexus:      ['Here you go.', 'On it.', 'Coming up.'],
                coder:      ['Rendering.', 'On it.', 'Generating.'],
                education:  ['Generating an illustration.', 'Here\'s a visual aid.', 'Let me show you.'],
            };
            const pool = fallbacks[window.currentMode] || fallbacks.nexus;
            cleanText = pool[Math.floor(Math.random() * pool.length)];
        }
    }

    // If AI emitted NOTHING at all (no text, no tool tag) — inject a "what?" fallback
    // so the user isn't left staring at a dead reply. Llama 8B sometimes returns empty
    // for short ambiguous prompts like "show me" or "yeah".
    if (!cleanText && !/\[(IMAGE|TRANSLATE|SUMMARIZE|SEARCH|WIKI|MATH|CHART|WEATHER|CURRENCY|QR|TZ|PALETTE|NER):/i.test(text)) {
        const emptyFallbacks = {
            unfiltered: ["Use your words, bruh.", "Show you what? Be specific.", "What? Spit it out.", "That's it? What do you actually want?", "Yeah, no. Try again with details."],
            nexus:      ["I didn't catch that — could you be more specific?", "Not sure what you're asking — say more?"],
            coder:      ["Need more detail to help — what are you trying to build?"],
            education:  ["Could you rephrase? I want to make sure I help with what you meant."],
        };
        const pool = emptyFallbacks[window.currentMode] || emptyFallbacks.nexus;
        cleanText = pool[Math.floor(Math.random() * pool.length)];
    }

    // Post-process: highlight any "Strike X of Y" / "N warnings left" / "lock for ..."
    // phrases in ORANGE so the warning visually stands out from the AI's mode color.
    // The LLM doesn't reliably emit HTML, so we wrap it after the fact via regex.
    function _highlightStrikeText(t) {
        if (!t) return t;
        // Match "Strike X of N" (and everything after up to sentence terminator)
        // — captures things like "Strike 2 of 3 — 1 warning left before NEXUS / CODER lock for 10-30 minutes"
        return t.replace(
            /(\bStrike\s+\d+\s+of\s+\d+[^.!?\n]*?)(?=[.!?\n]|$)/gi,
            '<b style="color:#fa0;">$1</b>'
        );
    }
    if (cleanText) cleanText = _highlightStrikeText(cleanText);

    // If the thinking placeholder exists, replace it in-place to avoid layout shift
    const thinking = document.getElementById('ai-thinking');
    if (thinking) {
        if (thinking._dotsTimer) clearInterval(thinking._dotsTimer);
        thinking.removeAttribute('id');
        thinking.removeAttribute('style');
        thinking.className = `ai-msg ${window.currentMode}-msg`;
        if (cleanText) {
            thinking.innerHTML = cleanText.replace(/\n/g, '<br>');
        } else {
            thinking.remove();
        }
        if (window.output) window.output.scrollTop = window.output.scrollHeight;
    } else if (window.printToTerminal && cleanText) {
        window.printToTerminal(cleanText, `ai-msg ${window.currentMode}-msg`);
    }
    if (window.speakAIResponse && cleanText) window.speakAIResponse(cleanText);
    // Fire AI tool tags AGAINST THE ORIGINAL text (so [IMAGE: ...] still extracts correctly)
    if (window.handleAITriggers) try { window.handleAITriggers(text); } catch(_) {}
}

function handleAITriggers(text) {
    // Game triggers
    const games = ['pong', 'snake', 'wordle', 'mines', 'flappy', 'breakout', 'invaders', 'monitor', 'clear', 'accessibility'];
    for (const tag of games) {
        if (text.includes(`[TRIGGER:${tag}]`)) {
            window.handleCommand(`play ${tag}`);
            return true;
        }
    }
    // AI-invoked tools — runs ALL matches in the reply, doesn't short-circuit
    let used = false;
    // Image: [IMAGE: descriptive prompt]
    text.replace(/\[IMAGE:\s*([^\]]+)\]/gi, (_, aiImgPrompt) => {
        used = true;
        let cleanedPrompt = aiImgPrompt.trim();
        // SAFETY NET: if the user's original ask had NO sexual words, strip any sexual
        // words the AI tried to inject into the image prompt. Llama 8B sometimes ignores
        // the "don't add nudity to non-explicit requests" rule; this is the backstop.
        const userAsked = window._lastUserPrompt || '';
        if (!_clientPromptIsExplicit(userAsked) && _clientPromptIsExplicit(cleanedPrompt)) {
            const before = cleanedPrompt;
            // Strip whole sexual phrases first, then bare keywords. Keep punctuation tidy.
            const stripPatterns = [
                /\b(completely|fully|totally)?\s*(nude|naked|topless|bottomless|bare(?:\s+(?:breasts?|chest|skin|body))?)\b/gi,
                /\b(no|without)\s+(clothing|clothes|bra|panties|underwear|shirt|pants|top)\b/gi,
                /\b(exposed|visible)\s+(nipples?|areolae?|breasts?|pussy|vagina|vulva|labia|clitoris|penis|cock|dick|balls)\b/gi,
                /\b(titties|tits|boobs|breasts?|nipples?|areolae?|pussy|vagina|vulva|snatch|clit(?:oris)?|labia|cock|dick|penis|balls|scrotum|testicles|asshole|anus)\b/gi,
                /\b(porn(?:ographic)?|erotic|nsfw|explicit|xxx|sexy|sensual|seductive|provocative)\b/gi,
                /\b(adult\s+(?:content|scene|woman|man|model)|bedroom\s+lighting|intimate\s+(?:close-up|framing|pose))\b/gi,
                /\b(woman|girl|man|guy|model|figure|body|person)\b/gi,  // strip subject too if AI invented one
            ];
            stripPatterns.forEach(rx => { cleanedPrompt = cleanedPrompt.replace(rx, ''); });
            cleanedPrompt = cleanedPrompt.replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
            // If we stripped down to nothing useful, use the user's original ask
            if (!cleanedPrompt || cleanedPrompt.length < 5) cleanedPrompt = userAsked;
            console.warn('[IMAGE SANITIZED] user asked:', userAsked, '· AI tried:', before, '· stripped to:', cleanedPrompt);
            printToTerminal(`<span style="color:#fa0; font-size:0.7rem;">[SANITIZED] AI tried to add NSFW content you didn't ask for — rendering "${cleanedPrompt}" instead.</span>`, 'sys-msg');
        }
        renderInlineImage(cleanedPrompt);
        return '';
    });
    // Translate: [TRANSLATE:src->tgt:text]   (codes: en/es/fr/de/it/pt/ru/ar/zh/ja/ko/hi/nl/sv)
    text.replace(/\[TRANSLATE:\s*(\w+)\s*->\s*(\w+)\s*:\s*([^\]]+)\]/gi, (_, src, tgt, body) => { used = true; renderInlineTranslate(src.trim(), tgt.trim(), body.trim()); return ''; });
    // Summarize: [SUMMARIZE: text]
    text.replace(/\[SUMMARIZE:\s*([^\]]+)\]/gi, (_, body) => { used = true; renderInlineSummarize(body.trim()); return ''; });
    // Sentiment: [SENTIMENT: text]
    text.replace(/\[SENTIMENT:\s*([^\]]+)\]/gi, (_, body) => { used = true; renderInlineSentiment(body.trim()); return ''; });
    // Emotion: [EMOTION: text]
    text.replace(/\[EMOTION:\s*([^\]]+)\]/gi, (_, body) => { used = true; renderInlineEmotion(body.trim()); return ''; });
    // Web search: [SEARCH: query]
    text.replace(/\[SEARCH:\s*([^\]]+)\]/gi, (_, q) => { used = true; renderInlineSearch(q.trim()); return ''; });
    // Wikipedia: [WIKI: topic]
    text.replace(/\[WIKI:\s*([^\]]+)\]/gi, (_, t) => { used = true; renderInlineWiki(t.trim()); return ''; });
    // Math: [MATH: expression]
    text.replace(/\[MATH:\s*([^\]]+)\]/gi, (_, e) => { used = true; renderInlineMath(e.trim()); return ''; });
    // Chart: [CHART: type | label1=v1, label2=v2]
    text.replace(/\[CHART:\s*([^\]]+)\]/gi, (_, spec) => { used = true; renderInlineChart(spec.trim()); return ''; });
    // Python sandbox: [RUN_PY: code]   (greedy single block)
    text.replace(/\[RUN_PY:\s*([\s\S]+?)\]/gi, (_, c) => { used = true; renderInlineRunPy(c.trim()); return ''; });
    // AI-fired lockout: [LOCKOUT: minutes] or [LOCKOUT: 30m]   — Unfiltered uses this when fed up
    text.replace(/\[LOCKOUT:\s*(\d+)\s*(?:m|min|minutes?)?\s*\]/gi, (_, mins) => {
        used = true;
        const seconds = Math.max(30, Math.min(parseInt(mins, 10) * 60, 60 * 60));
        if (window.triggerLockout) window.triggerLockout(seconds);
        return '';
    });
    // AI-fired IMAGE-ONLY lockout: [IMAGE_LOCKOUT: 5m] — blocks image_gen for the duration
    // but the user can still chat normally. Use this when the AI doesn't want to render
    // a particular request but is otherwise willing to talk.
    text.replace(/\[IMAGE_LOCKOUT:\s*(\d+)\s*(?:m|min|minutes?)?\s*\]/gi, (_, mins) => {
        used = true;
        const seconds = Math.max(30, Math.min(parseInt(mins, 10) * 60, 60 * 60 * 6));
        if (window._triggerImageLockout) window._triggerImageLockout(seconds);
        return '';
    });
    // Weather: [WEATHER: city]
    text.replace(/\[WEATHER:\s*([^\]]+)\]/gi, (_, loc) => { used = true; renderInlineWeather(loc.trim()); return ''; });
    // Currency: [CURRENCY: amount src->tgt]
    text.replace(/\[CURRENCY:\s*([\d.]+)\s*(\w+)\s*->\s*(\w+)\s*\]/gi, (_, amt, src, tgt) => { used = true; renderInlineCurrency(+amt, src, tgt); return ''; });
    // QR: [QR: text]
    text.replace(/\[QR:\s*([^\]]+)\]/gi, (_, txt) => { used = true; renderInlineQR(txt.trim()); return ''; });
    // Timezone: [TZ: Region/City]
    text.replace(/\[TZ:\s*([^\]]+)\]/gi, (_, tz) => { used = true; renderInlineTZ(tz.trim()); return ''; });
    // Color palette: [PALETTE: seed]
    text.replace(/\[PALETTE:\s*([^\]]+)\]/gi, (_, seed) => { used = true; renderInlinePalette(seed.trim()); return ''; });
    // NER: [NER: text]
    text.replace(/\[NER:\s*([^\]]+)\]/gi, (_, t) => { used = true; renderInlineNER(t.trim()); return ''; });
    return used;
}

async function renderInlineWeather(loc) {
    printToTerminal(`[WEATHER] "${loc}"…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('weather', { location: loc });
        printToTerminal(`<strong style="color:var(--accent);">🌤️ ${escapeHTML(r.location)}:</strong> ${escapeHTML(r.description)} · ${r.temp_c}°C / ${r.temp_f}°F · feels ${r.feels_like_c}°C · humidity ${r.humidity}% · wind ${r.wind_kph} km/h`, 'ai-msg');
    } catch (e) { printToTerminal(`[WEATHER FAIL] ${e.message}`, 'sys-msg'); }
}
async function renderInlineCurrency(amount, src, tgt) {
    try {
        const r = await window.NexusTools.callTool('currency', { amount, src, tgt });
        printToTerminal(`<strong style="color:var(--accent);">💱</strong> ${amount} ${src} = <strong>${(+r.result).toFixed(2)} ${tgt}</strong> <span style="color:#666;">(rate ${(+r.rate).toFixed(4)} on ${r.date})</span>`, 'ai-msg');
    } catch (e) { printToTerminal(`[CURRENCY FAIL] ${e.message}`, 'sys-msg'); }
}
async function renderInlineQR(text) {
    try {
        const r = await window.NexusTools.callTool('qr', { text });
        const p = document.createElement('p'); p.className = 'ai-msg';
        p.innerHTML = `<strong style="color:var(--accent);">🔲 QR for:</strong> ${escapeHTML(text)}<br><img src="${r.url}" style="background:#fff; padding:8px; border-radius:6px; margin-top:6px;">`;
        window.output.appendChild(p); window.output.scrollTop = window.output.scrollHeight;
    } catch (e) { printToTerminal(`[QR FAIL] ${e.message}`, 'sys-msg'); }
}
async function renderInlineTZ(tz) {
    try {
        const r = await window.NexusTools.callTool('timezone', { tz });
        printToTerminal(`<strong style="color:var(--accent);">⏰ ${escapeHTML(r.timezone)}:</strong> ${escapeHTML(r.datetime)} <span style="color:#666;">(${r.abbreviation} · UTC${r.utc_offset})</span>`, 'ai-msg');
    } catch (e) { printToTerminal(`[TZ FAIL] ${e.message}`, 'sys-msg'); }
}
async function renderInlinePalette(seed) {
    try {
        const r = await window.NexusTools.callTool('palette', { seed });
        const swatches = r.palette.map(c => `<span style="display:inline-block; width:50px; height:30px; background:${c}; margin-right:4px; border-radius:4px; border:1px solid #444; vertical-align:middle;"></span><code style="margin-right:14px; font-size:0.7rem; color:#aaa;">${c}</code>`).join('');
        printToTerminal(`<strong style="color:var(--accent);">🎨 Palette for "${escapeHTML(seed)}":</strong><br>${swatches}`, 'ai-msg');
    } catch (e) { printToTerminal(`[PALETTE FAIL] ${e.message}`, 'sys-msg'); }
}
async function renderInlineNER(text) {
    try {
        const r = await window.NexusTools.callTool('ner', { text });
        const ents = (r.entities || []).filter(e => e.score > 0.7);
        if (!ents.length) { printToTerminal(`[NER] no entities found.`, 'sys-msg'); return; }
        const grouped = ents.reduce((m, e) => { (m[e.entity_group || e.entity] = m[e.entity_group || e.entity] || []).push(e.word); return m; }, {});
        const out = Object.entries(grouped).map(([k, vs]) => `<strong>${k}:</strong> ${vs.join(', ')}`).join('<br>');
        printToTerminal(`<strong style="color:var(--accent);">🏷️ ENTITIES:</strong><br>${out}`, 'ai-msg');
    } catch (e) { printToTerminal(`[NER FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineSearch(query) {
    printToTerminal(`[SEARCH] "${query}"…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('search', { query });
        const items = (r.results || []).slice(0, 5).map(it =>
            `<div style="margin:6px 0;"><a href="${it.url}" target="_blank" style="color:var(--accent); text-decoration:none; font-weight:600;">${escapeHTML(it.title)}</a><br><span style="color:#888; font-size:0.7rem;">${escapeHTML(it.snippet || '')}</span></div>`).join('');
        printToTerminal(`<strong style="color:var(--accent);">SEARCH RESULTS:</strong>${items || ' <em>no results</em>'}`, 'ai-msg');
    } catch (e) { printToTerminal(`[SEARCH FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineWiki(topic) {
    printToTerminal(`[WIKI] querying "${topic}"…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('wiki', { topic });
        // Terminal-style render — bracketed header + ASCII separators, no Google-card vibes.
        const card = document.createElement('div');
        card.className = 'ai-msg';
        // Match per-mode color stripe (Education = magenta, etc.)
        const modeColors = { nexus:'#4af', unfiltered:'#ff6600', coder:'#0f0', education:'#ff00ff' };
        const stripe = modeColors[window.currentMode] || '#0ff';
        card.style.cssText = `border-left:3px solid ${stripe}; padding:10px 14px; margin:8px 0; background:rgba(0,0,0,0.25); font-family:var(--font-main);`;

        const thumb = r.thumbnail
            ? `<img src="${r.thumbnail}" style="float:right; width:96px; height:auto; max-height:140px; object-fit:cover; margin:0 0 6px 14px; border:1px solid rgba(255,255,255,0.12);">`
            : '';
        const link = r.url
            ? `<a href="${r.url}" target="_blank" rel="noopener" style="color:${stripe}; text-decoration:none; font-size:0.7rem; letter-spacing:1.5px; opacity:0.85;">[ open article ↗ ]</a>`
            : '';
        card.innerHTML = `
            <div style="font-size:0.6rem; color:${stripe}; letter-spacing:3px; opacity:0.7; margin-bottom:4px;">[ WIKI :: ${escapeHTML(topic)} ]</div>
            ${thumb}
            <div style="font-size:0.95rem; font-weight:700; color:#fff; line-height:1.3; margin-bottom:6px;">${escapeHTML(r.title)}</div>
            <div style="font-size:0.78rem; color:#cde; line-height:1.65;">${escapeHTML(r.extract)}</div>
            <div style="margin-top:8px; clear:both;">${link}</div>
        `;
        if (window.output) {
            window.output.appendChild(card);
            window.output.scrollTop = window.output.scrollHeight;
        }
    } catch (e) { printToTerminal(`[WIKI FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineMath(expression) {
    printToTerminal(`[MATH] ${expression}…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('math', { expression });
        let out = '';
        if (r.error) out = `error: ${r.error}`;
        else if (r.kind === 'equation') out = `solutions: ${r.result}`;
        else out = `simplified: ${r.simplified}${r.value !== undefined ? ` ≈ ${r.value}` : ''}`;
        printToTerminal(`<strong style="color:var(--accent);">🧮 ${escapeHTML(expression)}</strong><br><span style="color:#fff;">${escapeHTML(out)}</span>`, 'ai-msg');
    } catch (e) { printToTerminal(`[MATH FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineChart(spec) {
    // spec: "type | label1=v1, label2=v2, label3=v3"  OR  "label=v, label=v" (defaults to bar)
    printToTerminal(`[CHART] rendering…`, 'sys-msg');
    try {
        let chartType = 'bar', body = spec, title = '';
        if (spec.includes('|')) { [chartType, body] = spec.split('|', 2).map(s => s.trim()); }
        const labels = [], values = [];
        body.split(',').forEach(pair => {
            const [k, v] = pair.split('=').map(s => s && s.trim());
            if (k && v !== undefined && !isNaN(+v)) { labels.push(k); values.push(+v); }
        });
        const r = await window.NexusTools.callTool('chart', { chart_type: chartType, labels, values, title });
        const p = document.createElement('p'); p.className = 'ai-msg';
        p.innerHTML = `<img src="${r.url}" style="max-width:100%; border:1px solid var(--accent); border-radius:6px; margin-top:6px; background:rgba(255,255,255,0.95);">`;
        window.output.appendChild(p);
        window.output.scrollTop = window.output.scrollHeight;
    } catch (e) { printToTerminal(`[CHART FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineRunPy(code) {
    printToTerminal(`[RUN_PY] executing…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('run_py', { code });
        const out = (r.stdout || '').trim();
        const err = (r.stderr || '').trim();
        let html = `<pre style="background:#000; color:#0ff; padding:8px 10px; border:1px solid #333; border-radius:4px; font-size:0.7rem; white-space:pre-wrap; margin:6px 0;">${escapeHTML(out || '(no output)')}</pre>`;
        if (err) html += `<pre style="background:#200; color:#f55; padding:8px 10px; border:1px solid #500; border-radius:4px; font-size:0.7rem; white-space:pre-wrap; margin:6px 0;">${escapeHTML(err)}</pre>`;
        printToTerminal(`<strong style="color:var(--accent);">🐍 RUN:</strong>${html}`, 'ai-msg');
    } catch (e) { printToTerminal(`[RUN_PY FAIL] ${e.message}`, 'sys-msg'); }
}

function escapeHTML(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Image provider rate-limits us. Soft client-side cooldown so users know to wait.
const IMG_COOLDOWN_MS = 30000;

// Image-only lockout — separate from chat lockouts. AI fires `[IMAGE_LOCKOUT: 5m]` when
// it doesn't want to render but is happy to keep talking. Persisted to localStorage so
// page reload doesn't bypass.
window._triggerImageLockout = function(seconds) {
    const unlockAt = Date.now() + (seconds * 1000);
    try { localStorage.setItem('nexus_image_lockout_until', String(unlockAt)); } catch (_) {}
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    printToTerminal(`<span style="color:#ff8800; font-weight:600;">[IMAGE LOCKDOWN] No more image gen for ${m ? m + 'm ' : ''}${s ? s + 's' : ''}. You can still chat normally.</span>`, 'sys-msg');
};
function _isImageLockedOut() {
    try {
        const until = parseInt(localStorage.getItem('nexus_image_lockout_until') || '0', 10);
        return until > Date.now() ? until : 0;
    } catch (_) { return 0; }
}

// Image-tier health indicator — pushed into the top header tagline area on unfiltered mode.
// No more bottom banner; the top tagline becomes "🟢 LOCAL GPU ONLINE · unlimited free explicit"
// while in unfiltered, then reverts to the static per-mode tagline when switching away.
window._refreshImageTierStatus = async function() {
    // Always remove the legacy bottom banner if it ever got created
    const old = document.getElementById('nexus-tier-status'); if (old) old.remove();

    const tagEl = document.getElementById('header-tagline');
    if (!tagEl) return;

    if (window.currentMode !== 'unfiltered') {
        // Let the per-mode static tagline run — _paintHeaderMode handles non-unfiltered modes
        return;
    }

    try {
        const r = await fetch(`${window.API_BASE || ''}/api/image-tier-status`, { cache: 'no-store' });
        const s = await r.json();
        let badge = '', color = '#888';
        if (s.local_gpu) {
            badge = '🟢 LOCAL GPU ONLINE · UNLIMITED FREE EXPLICIT'; color = '#0f8';
        } else if (s.replicate || s.fal) {
            // Owner's home server is offline → cloud rendering kicks in. Tell users plainly.
            badge = '🟡 LOCAL GPU OFFLINE · CLOUD RENDERING · DAILY LIMIT APPLIES'; color = '#fa0';
        } else {
            badge = '🔴 ALL PAID TIERS OFFLINE · FREE FALLBACK ONLY'; color = '#f55';
        }
        tagEl.textContent = badge;
        tagEl.style.color = color;
        tagEl.style.opacity = '1';
        // Make the GPU-status badge actually visible — default tagline is 0.55rem, too small to notice.
        tagEl.style.fontSize = '0.78rem';
        tagEl.style.fontWeight = '700';
        tagEl.style.textShadow = `0 0 10px ${color}`;
    } catch (_) {}
};

// When leaving Unfiltered, restore the tagline to its default style so the next mode's
// static tagline doesn't inherit the bumped GPU-badge styling.
(function() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn');
        if (!btn || btn.dataset.mode === 'unfiltered') return;
        setTimeout(() => {
            const tagEl = document.getElementById('header-tagline');
            if (tagEl) {
                tagEl.style.fontSize = '';
                tagEl.style.fontWeight = '';
                tagEl.style.textShadow = '';
            }
        }, 60);
    });
})();
// Re-check every 60 seconds + on mode switch
setInterval(() => { if (window._refreshImageTierStatus) window._refreshImageTierStatus(); }, 60000);
setTimeout(() => { if (window._refreshImageTierStatus) window._refreshImageTierStatus(); }, 1500);

// Render a helpful coaching line ABOVE the image when the user types a weak / vague prompt.
// Fires across ALL modes (Nexus, Coder, Education, Unfiltered) — the goal is to teach better
// prompting so users get noticeably better results without us silently rewriting their prompt.
function _renderWeakPromptCoaching(prompt) {
    const trimmed = (prompt || '').trim();
    if (!trimmed) return;
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    // A prompt is "weak" if it's:
    //   - 1-3 words AND
    //   - has no scene/style/lighting/mood descriptors
    if (wordCount > 3) return;
    const STYLE_DESCRIPTORS = /\b(photo|photograph|photoreal|cinematic|wallpaper|portrait|landscape|painting|illustration|render|3d|sketch|drawing|art|style|cartoon|anime|sunset|sunrise|night|dawn|dusk|moody|dramatic|soft|bright|dark|neon|cyberpunk|fantasy|sci-fi|vintage|retro|minimal)\b/i;
    if (STYLE_DESCRIPTORS.test(trimmed)) return; // user already added a descriptor — leave them alone

    const mode = (window.currentMode || 'nexus').toLowerCase();
    const subject = trimmed.toLowerCase();
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    // Mode-specific coaching tone. All SFW. Each gives 2-3 concrete enrichment ideas tied
    // to the user's actual subject so the suggestion is useful, not generic.
    const modeStyles = {
        nexus: {
            tone: ['Tip:', 'Pro move:', 'Try this:', 'Quick note:'],
            kits: [
                `add lighting + time of day → "${subject} at golden hour, soft warm light, cinematic"`,
                `add a setting + mood → "${subject} in a foggy alleyway, dramatic, moody atmosphere"`,
                `specify a style → "${subject}, hyperrealistic photograph, shallow depth of field, 4k"`,
                `add camera details → "${subject}, 35mm photograph, bokeh background, professional lighting"`,
            ],
        },
        coder: {
            tone: ['Tip:', 'Pro move:', 'Try this:', 'Quick note:'],
            kits: [
                `add a technical frame → "${subject} as an isometric blueprint, neon-green wireframe, dark grid background"`,
                `make it diagrammatic → "${subject} exploded technical diagram, labeled components, schematic style"`,
                `try a digital aesthetic → "${subject} rendered in cyberpunk UI style, holographic overlays"`,
            ],
        },
        education: {
            tone: ['Tip:', 'Try this:', 'For better results:'],
            kits: [
                `make it instructional → "${subject}, labeled diagram, textbook illustration, friendly cartoon style"`,
                `add educational framing → "${subject} cross-section, vibrant flat-vector encyclopedia art"`,
                `keep it didactic → "${subject}, simple bold outlines, color-coded annotations, classroom-poster style"`,
            ],
        },
        unfiltered: {
            tone: ['Tip:', 'For more drama:', 'Try this:'],
            kits: [
                `add cinematic mood → "${subject}, gritty 35mm film, neon-noir lighting, deep shadows"`,
                `set the scene → "${subject} in a rain-slick city at night, moody, dramatic"`,
                `push the style → "${subject}, high-contrast film photography, atmospheric haze"`,
            ],
        },
    };
    const cfg = modeStyles[mode] || modeStyles.nexus;
    const text = `${pick(cfg.tone)} "${trimmed}" is pretty bare — try ${pick(cfg.kits)}. More descriptors = better images.`;
    if (window.printToTerminal) {
        window.printToTerminal(text, `ai-msg ${mode}-msg`);
    }
}

async function renderInlineImage(prompt) {
    const mode = window.currentMode || 'nexus';
    // Coder + Education modes have NO image gen — short-circuit before hitting backend.
    if (mode === 'coder' || mode === 'education') {
        if (window.printToTerminal) {
            const niceName = mode === 'coder' ? 'Coder' : 'Education';
            window.printToTerminal(`[IMAGE] ${niceName} mode doesn't generate images. Switch to Nexus or Unfiltered for a render.`, 'sys-msg-colored');
        }
        return;
    }
    // Show coaching ABOVE the image render if it's a weak prompt
    _renderWeakPromptCoaching(prompt);
    // AI-imposed image-only lockout — short-circuits before cooldown / providers
    const lockedUntil = _isImageLockedOut();
    if (lockedUntil) {
        const remainingSec = Math.ceil((lockedUntil - Date.now()) / 1000);
        const m = Math.floor(remainingSec / 60), s = remainingSec % 60;
        printToTerminal(`[IMAGE LOCKED] AI severed image gen · ${m ? m + 'm ' : ''}${s}s remaining. Chat still works.`, 'sys-msg-colored');
        return;
    }
    // Serialize image gens — only one in flight at a time. Blocks next request until
    // current one finishes. Owner skips the 30s cooldown but still respects the in-flight
    // gate (otherwise Pollinations 429s with "request already queued max").
    if (window._imageInFlight) {
        const elapsed = Math.round((Date.now() - (window._imageInFlightSince || Date.now())) / 1000);
        printToTerminal(`[IMAGE BUSY] Already rendering one (${elapsed}s in). Wait for it to finish before requesting another.`, 'sys-msg-colored');
        return;
    }
    if (!window.OWNER_MODE) {
        const last = parseInt(localStorage.getItem('nexus_last_image_ts') || '0', 10);
        const elapsed = Date.now() - last;
        if (last && elapsed < IMG_COOLDOWN_MS) {
            const wait = Math.ceil((IMG_COOLDOWN_MS - elapsed) / 1000);
            printToTerminal(`[IMAGE COOLDOWN] Hold up — wait ${wait}s before the next image.`, 'sys-msg-colored');
            return;
        }
    }
    localStorage.setItem('nexus_last_image_ts', String(Date.now()));
    window._imageInFlight = true;
    window._imageInFlightSince = Date.now();
    // Capture mode AT START so the rendered image's stripe + telemetry stay consistent
    // even if the user switches modes mid-generation. Otherwise an image generated under
    // Unfiltered would render with the Education stripe if the user swapped while waiting.
    const _modeAtStart = window.currentMode || 'nexus';
    // No predictive badge during loading — backend fallback chain makes prediction unreliable.
    // The OWNER-only source label below the rendered image (via Pollinations · FREE) is the
    // authoritative answer.
    const status = document.createElement('p');
    status.className = 'sys-msg';
    status.style.cssText = 'color:#0ff; font-style:italic;';
    // Clean loading text — just the prompt + elapsed timer. Removed the verbose
    // "5-30s, longer if Pollinations queue is busy" caveat per Xavier's request.
    status.innerHTML = `Generating "${escapeHTML(prompt)}" · <span class="img-elapsed">0s</span>`;
    window.output.appendChild(status);
    window.output.scrollTop = window.output.scrollHeight;
    const t0 = Date.now();
    const elapsedTimer = setInterval(() => {
        const el = status.querySelector('.img-elapsed');
        if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)}s`;
    }, 500);
    try {
        const r = await window.NexusTools.callTool('image_gen', { prompt, mode });
        clearInterval(elapsedTimer);
        status.remove();
        // Detect MIME type from the base64 prefix — Safari rejects mismatched MIMEs.
        const head = (r.image_b64 || '').slice(0, 16);
        let mime = 'image/png';
        if (head.startsWith('/9j/')) mime = 'image/jpeg';
        else if (head.startsWith('iVBOR')) mime = 'image/png';
        else if (head.startsWith('R0lGOD')) mime = 'image/gif';
        else if (head.startsWith('UklGR')) mime = 'image/webp';
        // Image only, no chat-bubble framing. The .ai-msg class adds a colored border-left
        // and padding meant for text — it looks like dead space when wrapping an image.
        // Below the image: a tiny line showing which provider rendered it + cost tier
        // (free/paid). Comes from r.source set by the provider in the backend.
        const sourceMap = {
            'pollinations:flux':       { label: 'Pollinations Flux (SFW)',           tier: 'FREE' },
            'pollinations:turbo':      { label: 'Pollinations Turbo (SFW)',          tier: 'FREE' },
            'pollinations:evil':       { label: 'Pollinations (uncensored)',         tier: 'FREE' },
            'pollinations:dreamshaper':{ label: 'Pollinations DreamShaper',          tier: 'FREE' },
            'ai-horde':                { label: 'AI Horde (volunteer GPUs)',         tier: 'FREE' },
            'hf':                      { label: 'HuggingFace FLUX (free tier)',      tier: 'FREE' },
            'hf-sdxl':                 { label: 'HuggingFace SDXL (free tier)',      tier: 'FREE' },
            'civitai:pony-xl':         { label: 'Civitai · Pony Diffusion V6 XL',    tier: 'PAID' },
        };
        const srcKey = (r.source || '').toLowerCase();
        let srcInfo = sourceMap[srcKey] || null;
        if (!srcInfo && srcKey.startsWith('comfyui:')) srcInfo = { label: `Local ComfyUI · ${srcKey.split(':')[1]}`, tier: 'LOCAL' };
        if (!srcInfo && srcKey.startsWith('replicate:')) srcInfo = { label: `Replicate · ${srcKey.split(':')[1]}`, tier: 'PAID' };
        if (!srcInfo) srcInfo = { label: r.source || 'unknown', tier: '?' };
        const tierColor = srcInfo.tier === 'FREE' ? '#0f8'
                        : srcInfo.tier === 'LOCAL' ? '#0ff'
                        : srcInfo.tier === 'PAID' ? '#fa0' : '#888';

        // Provenance label (model + tier) is OWNER-ONLY — regular users don't see it.
        const ownerLabel = window.OWNER_MODE
            ? `<div style="margin-top:4px; font-size:0.6rem; color:#888; letter-spacing:0.5px; line-height:1.3;">
                via <span style="color:#aaa;">${srcInfo.label}</span> · <span style="color:${tierColor}; font-weight:600;">${srcInfo.tier}</span>
              </div>`
            : '';
        // Mode-color left border on the image bubble — same as text replies, so the
        // user can tell "this image was generated under UNFILTERED mode" at a glance.
        const modeColors = { nexus:'#4af', unfiltered:'#ff6600', coder:'#0f0', education:'#ff00ff' };
        const stripeColor = modeColors[_modeAtStart] || '#4af';
        const p = document.createElement('div');
        p.style.cssText = `margin:4px 0 8px; padding:6px 0 6px 12px; border-left:3px solid ${stripeColor};`;
        p.innerHTML = `<img src="data:${mime};base64,${r.image_b64}"
             style="max-width:320px; max-height:320px; border:1px solid var(--accent); border-radius:8px; cursor:zoom-in; display:block; box-shadow:0 2px 8px rgba(0,0,0,0.3);"
             onclick="window._expandImage(this.src)"
             title="Click to expand fullscreen">${ownerLabel}`;
        window.output.appendChild(p);
        window.output.scrollTop = window.output.scrollHeight;
        // Telemetry: log to Discord with image attached + provider/cost details for owner.
        if (window._px_log_conversation) {
            try {
                // Cost + tier per source. Consistent format: tier, cost, model name.
                const costMap = {
                    'pollinations:flux':              { tier: 'FREE', cost: '$0.00',          model: 'Pollinations Flux' },
                    'pollinations:turbo':             { tier: 'FREE', cost: '$0.00',          model: 'Pollinations Turbo' },
                    'pollinations:evil':              { tier: 'FREE', cost: '$0.00',          model: 'Pollinations Evil (uncensored)' },
                    'pollinations:dreamshaper':       { tier: 'FREE', cost: '$0.00',          model: 'Pollinations DreamShaper' },
                    'ai-horde':                       { tier: 'FREE', cost: '$0.00',          model: 'AI Horde' },
                    'hf':                             { tier: 'FREE', cost: '$0.00',          model: 'HuggingFace FLUX' },
                    'hf-sdxl':                        { tier: 'FREE', cost: '$0.00',          model: 'HuggingFace SDXL' },
                    'replicate:nsfw-flux-dev':        { tier: 'PAID', cost: '~$0.025/image',  model: 'Replicate nsfw-flux-dev' },
                    'replicate:realistic-vision-v5.1':{ tier: 'PAID', cost: '~$0.0014/image', model: 'Replicate Realistic Vision V5.1' },
                };
                const sk = (r.source || '').toLowerCase();
                const ci = costMap[sk] || (sk.startsWith('comfyui:')
                    ? { tier: 'LOCAL', cost: '$0.00 (home GPU)', model: 'Local ComfyUI · ' + sk.split(':')[1] }
                    : sk.startsWith('replicate:')
                    ? { tier: 'PAID', cost: '~$0.005-0.025/image', model: 'Replicate ' + sk.split(':')[1] }
                    : { tier: '?', cost: '?', model: r.source || 'unknown' });
                const aiReply = `[IMAGE generated]
Tier: ${ci.tier}
Cost: ${ci.cost}
Model: ${ci.model}
Prompt sent to model:
${prompt}`;
                // User prompt already appears in the main chat log — don't duplicate it here.
                // Pass empty string for user side; the embed shows just the image-gen details + image.
                window._px_log_conversation('', aiReply, _modeAtStart, r.image_b64);
            } catch(_) {}
        }
        // Persist image history.
        //   Google user → localStorage with 30-day expiry, last 30 images
        //   Guest       → sessionStorage only (cleared on tab close, NEVER on disk)
        try {
            const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
            const isSignedIn = !!u.email && u.email !== 'guest@local';
            const entry = { prompt, b64: r.image_b64, mime, ts: Date.now(), mode: _modeAtStart };
            const store = isSignedIn ? localStorage : sessionStorage;
            const hist = JSON.parse(store.getItem('nexus_image_history') || '[]');
            // Drop any entry older than 30 days BEFORE adding the new one (cleanup-on-write)
            const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
            const fresh = hist.filter(h => (Date.now() - (h.ts || 0)) < THIRTY_DAYS);
            fresh.unshift(entry);
            store.setItem('nexus_image_history', JSON.stringify(fresh.slice(0, 30)));
        } catch (_) {}
    } catch (e) {
        clearInterval(elapsedTimer);
        status.remove();
        // Daily image cap hit — pair the error with a soft BMC link so users know
        // donations directly fund the budget. Don't be pushy; one inline link is plenty.
        if (/Daily image limit reached/i.test(e.message || '')) {
            const bar = document.createElement('p');
            bar.className = 'sys-msg';
            bar.style.cssText = 'background:rgba(255,170,0,0.08); border-left:3px solid #fa0; padding:10px 14px; margin:6px 0; border-radius:4px; line-height:1.55;';
            bar.innerHTML = `<span style="color:#fa0; font-weight:700;">[IMAGE LIMIT]</span> <span style="color:#fff;">${escapeHTML(e.message)}</span><br><span style="color:#9ce; font-size:0.72rem;">Want to help keep Nexus running? <a href="https://buymeacoffee.com/thyfwx" target="_blank" rel="noopener" style="color:#0ff; text-decoration:underline; font-weight:600;">☕ Buy Xavier a coffee</a> — every $5 funds ~1,500 SFW image generations for the community.</span>`;
            window.output.appendChild(bar);
            window.output.scrollTop = window.output.scrollHeight;
        } else if (/429|too many requests|already queue/i.test(e.message || '')) {
            // Pollinations rate-limit — explain it clearly so it doesn't look like a real failure.
            printToTerminal(`<span style="color:#fa0;">[RATE LIMITED]</span> Pollinations has a 1-image-per-IP queue. Wait ~10s for the previous render to clear, then try again.`, 'sys-msg');
        } else {
            printToTerminal(`[IMAGE FAIL] ${e.message}`, 'sys-msg');
        }
    } finally {
        // ALWAYS release the in-flight gate — success, error, or anything in between.
        // Without this, a failed image freezes future generations until page reload.
        window._imageInFlight = false;
        window._imageInFlightSince = 0;
    }
}

async function renderInlineSentiment(body) {
    printToTerminal(`[SENTIMENT] Analyzing…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('sentiment', { text: body });
        const top = (r.scores?.[0] || []).slice ? r.scores[0] : r.scores;
        // HF sentiment returns either [[{label,score},...]] or [{label,score},...]
        const arr = Array.isArray(top) ? top : (Array.isArray(r.scores?.[0]) ? r.scores[0] : r.scores);
        const sorted = (Array.isArray(arr) ? arr : []).slice().sort((a,b)=>b.score-a.score);
        const summary = sorted.map(s => `${s.label}: ${(s.score*100).toFixed(0)}%`).join(' · ');
        printToTerminal(`<strong style="color:var(--accent);">SENTIMENT:</strong> ${summary || JSON.stringify(r.scores)}`, 'ai-msg');
    } catch (e) { printToTerminal(`[SENTIMENT FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineEmotion(body) {
    printToTerminal(`[EMOTION] Analyzing…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('emotion', { text: body });
        const arr = Array.isArray(r.scores?.[0]) ? r.scores[0] : r.scores;
        const sorted = (Array.isArray(arr) ? arr : []).slice().sort((a,b)=>b.score-a.score).slice(0,3);
        const summary = sorted.map(s => `${s.label}: ${(s.score*100).toFixed(0)}%`).join(' · ');
        printToTerminal(`<strong style="color:var(--accent);">EMOTION:</strong> ${summary}`, 'ai-msg');
    } catch (e) { printToTerminal(`[EMOTION FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineTranslate(src, tgt, body) {
    printToTerminal(`[TRANSLATE] ${src} → ${tgt}…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('translate', { src, tgt, text: body });
        printToTerminal(`<strong style="color:var(--accent);">${tgt.toUpperCase()}:</strong> ${r.text}`, 'ai-msg');
    } catch (e) { printToTerminal(`[TRANSLATE FAIL] ${e.message}`, 'sys-msg'); }
}

async function renderInlineSummarize(body) {
    printToTerminal(`[SUMMARIZE] ${body.length} chars in…`, 'sys-msg');
    try {
        const r = await window.NexusTools.callTool('summarize', { text: body });
        printToTerminal(`<strong style="color:var(--accent);">SUMMARY:</strong> ${r.text}`, 'ai-msg');
    } catch (e) { printToTerminal(`[SUMMARIZE FAIL] ${e.message}`, 'sys-msg'); }
}

// Direct image command (fallback when used via /image)
async function generateImage(prompt) {
    return renderInlineImage(prompt);
}
window.renderInlineImage = renderInlineImage;

// Crisis resources card — shown when self-harm / suicide patterns are detected.
// Picks the right hotline by browser locale + timezone. Non-blocking, dismissible,
// but stays visible until the user closes it.
const _CRISIS_RESOURCES = {
    US:    { line: '988',           text: '988 Suicide & Crisis Lifeline',   url: 'https://988lifeline.org/', sms: 'Text HOME to 741741' },
    CA:    { line: '988',           text: '988 Suicide Crisis Helpline',     url: 'https://988.ca/',          sms: 'Text 45645' },
    GB:    { line: '116 123',       text: 'Samaritans (UK & Ireland)',       url: 'https://www.samaritans.org/', sms: 'Text SHOUT to 85258' },
    AU:    { line: '13 11 14',      text: 'Lifeline Australia',              url: 'https://www.lifeline.org.au/', sms: 'Text 0477 13 11 14' },
    NZ:    { line: '1737',          text: 'Need to Talk? NZ',                url: 'https://1737.org.nz/',     sms: 'Text 1737' },
    IE:    { line: '116 123',       text: 'Samaritans Ireland',              url: 'https://www.samaritans.org/ireland/', sms: '' },
    DE:    { line: '0800 111 0 111',text: 'Telefonseelsorge',                url: 'https://www.telefonseelsorge.de/', sms: '' },
    FR:    { line: '3114',          text: 'Suicide écoute (France)',         url: 'https://3114.fr/',         sms: '' },
    IN:    { line: '9152987821',    text: 'iCall India',                     url: 'https://icallhelpline.org/', sms: '' },
    JP:    { line: '0570 064 556',  text: 'Yorisoi Hotline (Japan)',         url: 'https://yorisoi-chat.jp/', sms: '' },
    INTL:  { line: 'findahelpline.com', text: 'Find a Helpline (worldwide)', url: 'https://findahelpline.com/', sms: '' },
};
function _detectCountry() {
    try {
        const lang = (navigator.language || '').toUpperCase();      // e.g. "EN-US"
        const tz   = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
        if (lang.endsWith('-US') || tz.includes('america/')) return 'US';
        if (lang.endsWith('-CA') || tz.includes('canada')) return 'CA';
        if (lang.endsWith('-GB') || tz.includes('london')) return 'GB';
        if (lang.endsWith('-AU') || tz.includes('australia')) return 'AU';
        if (lang.endsWith('-NZ') || tz.includes('auckland')) return 'NZ';
        if (lang.endsWith('-IE') || tz.includes('dublin')) return 'IE';
        if (lang.endsWith('-DE') || tz.includes('berlin')) return 'DE';
        if (lang.endsWith('-FR') || tz.includes('paris')) return 'FR';
        if (lang.endsWith('-IN') || tz.includes('asia/kolkata')) return 'IN';
        if (lang.endsWith('-JP') || tz.includes('tokyo')) return 'JP';
    } catch (_) {}
    return 'INTL';
}

// Additional support resources beyond suicide. Region-aware where possible; INTL fallback always works.
const _SUPPORT_RESOURCES = {
    US: [
        { cat: 'Suicide / Crisis',    line: '988',                text: '988 Suicide & Crisis Lifeline',          url: 'https://988lifeline.org/',                  sms: 'Text HOME to 741741' },
        { cat: 'Domestic Violence',   line: '1-800-799-7233',     text: 'National DV Hotline',                    url: 'https://www.thehotline.org/',               sms: 'Text START to 88788' },
        { cat: 'Sexual Assault',      line: '1-800-656-4673',     text: 'RAINN National Sexual Assault Hotline',  url: 'https://www.rainn.org/',                    sms: '' },
        { cat: 'Substance Abuse',     line: '1-800-662-4357',     text: 'SAMHSA National Helpline',               url: 'https://www.samhsa.gov/find-help/national-helpline', sms: '' },
        { cat: 'LGBTQ+ Youth',        line: '1-866-488-7386',     text: 'The Trevor Project',                     url: 'https://www.thetrevorproject.org/',         sms: 'Text START to 678-678' },
        { cat: 'Trans Lifeline',      line: '1-877-565-8860',     text: 'Trans Lifeline (peer support)',          url: 'https://translifeline.org/',                sms: '' },
        { cat: 'Child Abuse',         line: '1-800-422-4453',     text: 'Childhelp National Hotline',             url: 'https://www.childhelp.org/',                sms: '' },
        { cat: 'Veterans Crisis',     line: '988 then press 1',   text: 'Veterans Crisis Line',                   url: 'https://www.veteranscrisisline.net/',       sms: 'Text 838255' },
        { cat: 'Eating Disorders',    line: '1-800-931-2237',     text: 'NEDA Helpline',                          url: 'https://www.nationaleatingdisorders.org/',  sms: 'Text NEDA to 741741' },
    ],
    GB: [
        { cat: 'Suicide / Crisis',    line: '116 123',            text: 'Samaritans (UK & Ireland)',              url: 'https://www.samaritans.org/',               sms: 'Text SHOUT to 85258' },
        { cat: 'Domestic Violence',   line: '0808 2000 247',      text: 'Refuge / National DV Helpline',          url: 'https://www.nationaldahelpline.org.uk/',    sms: '' },
        { cat: 'Sexual Assault',      line: '0808 802 9999',      text: 'Rape Crisis England & Wales',            url: 'https://rapecrisis.org.uk/',                sms: '' },
        { cat: 'Substance Abuse',     line: '0300 123 6600',      text: 'FRANK',                                  url: 'https://www.talktofrank.com/',              sms: 'Text 82111' },
        { cat: 'LGBTQ+',              line: '0300 330 0630',      text: 'Switchboard LGBT+ Helpline',             url: 'https://switchboard.lgbt/',                 sms: '' },
        { cat: 'Child Helpline',      line: '0800 1111',          text: 'Childline',                              url: 'https://www.childline.org.uk/',             sms: '' },
    ],
    CA: [
        { cat: 'Suicide / Crisis',    line: '988',                text: '988 Suicide Crisis Helpline (Canada)',   url: 'https://988.ca/',                           sms: 'Text 45645' },
        { cat: 'Domestic Violence',   line: '1-800-799-7233',     text: 'Use thehotline.org or call 911',         url: 'https://www.endingviolencecanada.org/',     sms: '' },
        { cat: 'Kids Help Phone',     line: '1-800-668-6868',     text: 'Kids Help Phone',                        url: 'https://kidshelpphone.ca/',                 sms: 'Text CONNECT to 686868' },
        { cat: 'LGBTQ+ Youth',        line: '1-800-268-9688',     text: 'LGBT YouthLine',                         url: 'https://www.youthline.ca/',                 sms: 'Text 647-694-4275' },
    ],
    AU: [
        { cat: 'Suicide / Crisis',    line: '13 11 14',           text: 'Lifeline Australia',                     url: 'https://www.lifeline.org.au/',              sms: 'Text 0477 13 11 14' },
        { cat: 'Domestic Violence',   line: '1800 737 732',       text: '1800RESPECT',                            url: 'https://www.1800respect.org.au/',           sms: '' },
        { cat: 'Kids Helpline',       line: '1800 55 1800',       text: 'Kids Helpline (5–25 yrs)',               url: 'https://kidshelpline.com.au/',              sms: '' },
        { cat: 'LGBTQ+',              line: '1800 184 527',       text: 'QLife',                                  url: 'https://qlife.org.au/',                     sms: '' },
    ],
    INTL: [
        { cat: 'Find Any Helpline',   line: 'findahelpline.com',  text: 'Worldwide directory of crisis lines',    url: 'https://findahelpline.com/',                sms: '' },
        { cat: 'IASP Crisis Centres', line: 'iasp.info/resources',text: 'International Association for Suicide Prevention', url: 'https://www.iasp.info/crisis-centres-helplines/', sms: '' },
    ],
};

window._showCrisisResources = function(kind) {
    if (document.getElementById('nexus-crisis-card')) return;
    const cc = _detectCountry();
    const list = _SUPPORT_RESOURCES[cc] || _SUPPORT_RESOURCES.INTL;
    const card = document.createElement('div');
    card.id = 'nexus-crisis-card';
    card.style.cssText = 'position:fixed; bottom:20px; right:20px; max-width:420px; max-height:80vh; overflow-y:auto; z-index:99998; background:linear-gradient(135deg, #001a2a 0%, #002a3a 100%); border:2px solid #0ff; border-radius:14px; padding:18px 20px; box-shadow:0 8px 32px rgba(0,255,255,0.25); font-family:var(--font-main); color:#fff;';
    const items = list.map(r => `
        <div style="background:rgba(0,0,0,0.4); border-left:3px solid #0ff; padding:8px 12px; border-radius:6px; margin-bottom:6px;">
            <div style="font-size:0.65rem; color:#888; letter-spacing:1px; margin-bottom:2px;">${r.cat}</div>
            <div style="font-size:0.92rem; color:#0ff; font-weight:700;">${r.line}</div>
            <div style="font-size:0.7rem; color:#aaa; margin-top:2px;">${r.text}</div>
            ${r.sms ? `<div style="font-size:0.66rem; color:#9af; margin-top:4px;">${r.sms}</div>` : ''}
            <a href="${r.url}" target="_blank" rel="noopener" style="display:inline-block; margin-top:4px; color:#0ff; font-size:0.66rem; text-decoration:underline;">${r.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
        </div>
    `).join('');
    card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <span style="font-size:1.4rem;">🫶</span>
            <h3 style="margin:0; color:#0ff; font-size:0.85rem; letter-spacing:2px;">YOU'RE NOT ALONE</h3>
            <button id="crisis-close" style="margin-left:auto; background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.3); width:26px; height:26px; border-radius:50%; cursor:pointer; font-size:0.85rem;">×</button>
        </div>
        <p style="margin:0 0 12px; font-size:0.78rem; line-height:1.55; color:#ddd;">
            What you're going through sounds heavy. People who actually want to help are one call or text away — free, 24/7, confidential. Reach out to whichever line fits, even if it doesn't feel like a "real" crisis.
        </p>
        <div style="font-size:0.65rem; color:#888; letter-spacing:1px; margin-bottom:6px;">${cc === 'INTL' ? 'WORLDWIDE' : `YOUR REGION (${cc})`}</div>
        ${items}
        <div style="font-size:0.65rem; color:#666; margin-top:10px; line-height:1.5;">
            If you're in immediate danger, call your local emergency number (911 / 999 / 112). This terminal isn't a substitute for a real human.
        </div>
    `;
    document.body.appendChild(card);
    const x = document.getElementById('crisis-close');
    if (x) x.onclick = () => card.remove();
    setTimeout(() => { if (document.getElementById('nexus-crisis-card') === card) card.remove(); }, 120000);
};

// Ban screen — full-page, owner-themed, with appeal info. Triggered by HTTP 403 from /api/chat.
window._showBanScreen = function(reason) {
    if (document.getElementById('nexus-ban-screen')) return;
    const u = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
    const overlay = document.createElement('div');
    overlay.id = 'nexus-ban-screen';
    overlay.style.cssText = "position:fixed; inset:0; z-index:99999; background:rgba(20,0,0,0.97); display:flex; align-items:center; justify-content:center; padding:20px; font-family:var(--font-main); color:#fff;";
    overlay.innerHTML = `
        <div style="max-width:560px; width:100%; border:2px solid #f00; border-radius:14px; padding:36px; background:rgba(40,0,0,0.5); box-shadow:0 0 60px rgba(255,0,0,0.3);">
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
                <div style="font-size:1.6rem;">⛔</div>
                <h2 style="margin:0; letter-spacing:5px; color:#f55; font-size:1.1rem;">ACCESS REVOKED</h2>
            </div>
            <p style="color:#ccc; font-size:0.85rem; line-height:1.7; margin:0 0 14px;">
                Your IP address has been blocked from the Nexus terminal by the operator.
            </p>
            <p style="color:#888; font-size:0.78rem; line-height:1.6; margin:0 0 18px;">
                Reason: <span style="color:#f55;">${(reason || 'policy violation').replace(/[<>]/g, '')}</span><br>
                User: <strong style="color:#fff;">${(u.name || 'Guest').replace(/[<>]/g, '')}</strong>
            </p>

            <h3 style="color:#f55; font-size:0.78rem; letter-spacing:2px; margin:20px 0 10px;">▸ APPEAL</h3>
            <p style="color:#aaa; font-size:0.78rem; line-height:1.6; margin:0 0 14px;">
                If you believe this was a mistake, email
                <a href="mailto:xavier@thyfwxit.com?subject=Nexus%20Ban%20Appeal&body=My%20name%3A%20${encodeURIComponent(u.name||'Guest')}%0AContext%3A%20" style="color:#0ff;">xavier@thyfwxit.com</a>
                with: your name, the message that triggered the ban (if you remember), and why you think it was unjust. Keep it short and honest.
                Owner reviews appeals manually.
            </p>

            <p style="color:#666; font-size:0.7rem; line-height:1.6; margin:20px 0 0;">
                Sessions, prompts, and IP are logged. Trying to evade the block via VPN
                will get the new IP added too.
            </p>

            <div style="display:flex; gap:10px; margin-top:24px;">
                <a href="https://thyfwxit.com" style="flex:1; background:#333; color:#fff; border:none; padding:12px; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:700; letter-spacing:2px; font-size:0.78rem; text-align:center; text-decoration:none;">RETURN TO MAIN SITE</a>
            </div>
        </div>
        <button id="ban-preview-close" style="position:absolute; top:14px; right:14px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.3); width:36px; height:36px; border-radius:50%; cursor:pointer; font-size:1rem;">×</button>`;
    document.body.appendChild(overlay);
    // Close button — works for any caller. The real-ban use case has it dismiss too,
    // which is fine because the user is still 403'd from /api/chat anyway.
    const x = document.getElementById('ban-preview-close');
    if (x) x.onclick = () => overlay.remove();
};

// Click-to-expand: full-screen overlay with the image at natural size, click anywhere to dismiss
window._expandImage = function(src) {
    if (document.getElementById('img-lightbox')) return;
    const ov = document.createElement('div');
    ov.id = 'img-lightbox';
    ov.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:99999; display:flex; align-items:center; justify-content:center; cursor:zoom-out; padding:20px;";
    ov.innerHTML = `<img src="${src}" style="max-width:96vw; max-height:96vh; border:1px solid var(--accent); border-radius:8px; box-shadow:0 0 40px rgba(0,255,255,0.3);">`;
    ov.onclick = () => ov.remove();
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); }});
    document.body.appendChild(ov);
};

function playNeuralVoice(base64) {
    // Legacy HF audio path — only used as a fallback if NexusTTS isn't available.
    if (!base64) return;
    if (window.NexusTTS && typeof window.NexusTTS.getPrefs === 'function') return; // NexusTTS owns voice now
    const active = localStorage.getItem('nexus_tts_active') === 'true';
    if (!active) return;
    try {
        const audio = new Audio(`data:audio/wav;base64,${base64}`);
        audio.play().catch(e => console.warn("[VOICE] Autoplay blocked:", e));
    } catch(e) { console.error("[VOICE] Playback error:", e); }
}

// Hook AI text printing → SpeechSynthesis (controlled via Settings)
function speakAIResponse(text) {
    if (window.NexusTTS && window.NexusTTS.speak) window.NexusTTS.speak(text);
}
window.speakAIResponse = speakAIResponse;

// Global Exports
window.prompt_ai_proxy = prompt_ai_proxy;
window.handleAITriggers = handleAITriggers;
window.generateImage = generateImage;
window.playNeuralVoice = playNeuralVoice;
