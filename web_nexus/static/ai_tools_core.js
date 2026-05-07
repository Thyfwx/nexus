/**
 * 🛰️ NEXUS AI TOOLS CORE v5.4.9
 * Owns: TOOLS manifest fetch, sidebar render, per-tool modal UIs, mic recorder.
 * Each tool routes through POST /api/tool/{id} on the backend.
 *
 * Loads BEFORE commands_core.js per Nexus arch.
 */

(function () {
    let TOOLS = [];
    let NLLB_LANGS = {};
    let IS_OWNER = false;
    let MEDIA = null; // active MediaRecorder for STT mic

    // ---------- helpers ----------
    function $(id) { return document.getElementById(id); }
    function el(tag, attrs = {}, html = '') {
        const e = document.createElement(tag);
        for (const k in attrs) {
            if (k === 'style') e.style.cssText = attrs[k];
            else if (k === 'on') for (const evt in attrs.on) e.addEventListener(evt, attrs.on[evt]);
            else e.setAttribute(k, attrs[k]);
        }
        if (html) e.innerHTML = html;
        return e;
    }

    async function callTool(id, payload) {
        const res = await fetch(`${window.API_BASE || ''}/api/tool/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload || {})
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            const err = data.error || `HTTP ${res.status}`;
            throw new Error(err);
        }
        return data.result;
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1] || '');
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    }

    function fileToBase64(file) { return blobToBase64(file); }

    // ---------- modal shell (uses existing #game-gui-container) ----------
    function openModal(title, bodyHTML, footerHTML = '') {
        const gui = $('game-gui-container');
        const content = $('gui-content');
        const titleEl = $('gui-title');
        const canvas = $('nexus-canvas');
        if (!gui || !content || !titleEl) return;
        if (canvas) canvas.style.display = 'none';
        titleEl.textContent = title;
        content.innerHTML = `
            <div class="tool-shell">
                ${bodyHTML}
                ${footerHTML ? `<div class="tool-footer">${footerHTML}</div>` : ''}
            </div>
        `;
        gui.classList.remove('gui-hidden');
        const closeBtn = $('gui-close');
        if (closeBtn) closeBtn.onclick = () => gui.classList.add('gui-hidden');
        return content;
    }

    function setBusy(btn, on, busyText = 'WORKING…') {
        if (!btn) return;
        if (on) {
            btn._origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = busyText;
        } else {
            btn.disabled = false;
            btn.textContent = btn._origText || 'RUN';
        }
    }

    function statusLine(state, msg) {
        const colors = { info: '#0ff', ok: '#0f0', warn: '#fa0', err: '#f55' };
        return `<p class="tool-status" style="color:${colors[state] || '#888'}; font-size:0.7rem; margin:8px 0;">${msg}</p>`;
    }

    // ---------- per-tool UIs ----------
    const HANDLERS = {
        image_gen: () => openModal('🎨 IMAGE GENERATOR', `
            <label class="tool-label">Prompt</label>
            <textarea id="img-prompt" rows="3" class="tool-input" placeholder="A cyberpunk neon city at midnight, ultra detailed…"></textarea>
            <button id="img-go" class="tool-btn-primary">GENERATE</button>
            <div id="img-status"></div>
            <div id="img-result"></div>
        `, '<small style="color:#666;">FLUX.1-schnell via HF · falls back to Pollinations</small>') && (() => {
            $('img-go').onclick = async () => {
                const prompt = $('img-prompt').value.trim();
                if (!prompt) return;
                setBusy($('img-go'), true, 'GENERATING…');
                $('img-status').innerHTML = statusLine('info', 'Calling neural canvas… (~5–20s)');
                $('img-result').innerHTML = '';
                try {
                    const r = await callTool('image_gen', { prompt });
                    $('img-status').innerHTML = statusLine('ok', `Rendered via ${r.source}.`);
                    $('img-result').innerHTML = `
                        <img src="data:image/png;base64,${r.image_b64}" style="max-width:100%; margin-top:10px; border:1px solid var(--accent); border-radius:6px;">
                        <a href="data:image/png;base64,${r.image_b64}" download="nexus_image.png" class="tool-btn-secondary" style="display:inline-block; margin-top:8px;">DOWNLOAD</a>
                    `;
                    if (window.printToTerminal) window.printToTerminal(`[IMAGE] Rendered "${prompt}" via ${r.source}.`, 'sys-msg');
                } catch (e) { $('img-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('img-go'), false);
            };
        })(),

        stt: () => openModal('🎙️ VOICE TRANSCRIBE', `
            <label class="tool-label">Audio file (wav / m4a / webm / mp3)</label>
            <input type="file" id="stt-file" accept="audio/*" class="tool-input">
            <button id="stt-go" class="tool-btn-primary">TRANSCRIBE</button>
            <div id="stt-status"></div>
            <textarea id="stt-out" rows="6" class="tool-input" placeholder="Transcript will appear here…" readonly></textarea>
        `, '<small style="color:#666;">Whisper-large-v3 via HF</small>') && (() => {
            $('stt-go').onclick = async () => {
                const f = $('stt-file').files?.[0];
                if (!f) { $('stt-status').innerHTML = statusLine('warn', 'Pick an audio file first.'); return; }
                setBusy($('stt-go'), true, 'TRANSCRIBING…');
                $('stt-status').innerHTML = statusLine('info', `Uploading ${(f.size / 1024).toFixed(0)} KB…`);
                try {
                    const audio_b64 = await fileToBase64(f);
                    const r = await callTool('stt', { audio_b64 });
                    $('stt-out').value = r.text;
                    $('stt-status').innerHTML = statusLine('ok', 'Transcribed.');
                } catch (e) { $('stt-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('stt-go'), false);
            };
        })(),

        tts: () => openModal('🔊 TEXT → SPEECH', `
            <label class="tool-label">Text to speak</label>
            <textarea id="tts-in" rows="4" class="tool-input" placeholder="Hello, I am Nexus."></textarea>
            <button id="tts-go" class="tool-btn-primary">SYNTHESIZE</button>
            <div id="tts-status"></div>
            <audio id="tts-audio" controls style="width:100%; margin-top:10px; display:none;"></audio>
        `, '<small style="color:#666;">MMS-TTS-eng via HF</small>') && (() => {
            $('tts-go').onclick = async () => {
                const text = $('tts-in').value.trim();
                if (!text) return;
                setBusy($('tts-go'), true, 'SYNTHESIZING…');
                $('tts-status').innerHTML = statusLine('info', 'Generating audio…');
                try {
                    const r = await callTool('tts', { text });
                    if (!r.audio_b64) throw new Error('Empty audio response (HF tier may be cold-starting)');
                    const audio = $('tts-audio');
                    audio.src = `data:audio/wav;base64,${r.audio_b64}`;
                    audio.style.display = 'block';
                    audio.play().catch(() => {});
                    $('tts-status').innerHTML = statusLine('ok', 'Done.');
                } catch (e) { $('tts-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('tts-go'), false);
            };
        })(),

        translate: () => {
            const opts = Object.entries(NLLB_LANGS).map(([n, c]) => `<option value="${c}">${n}</option>`).join('');
            openModal('🌐 TRANSLATOR', `
                <label class="tool-label">Source text</label>
                <textarea id="tr-text" rows="4" class="tool-input"></textarea>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <div style="flex:1;">
                        <label class="tool-label">From</label>
                        <select id="tr-src" class="tool-input">${opts}</select>
                    </div>
                    <div style="flex:1;">
                        <label class="tool-label">To</label>
                        <select id="tr-tgt" class="tool-input">${opts}</select>
                    </div>
                </div>
                <button id="tr-go" class="tool-btn-primary">TRANSLATE</button>
                <div id="tr-status"></div>
                <textarea id="tr-out" rows="4" class="tool-input" placeholder="Translation…" readonly></textarea>
            `, '<small style="color:#666;">NLLB-200-distilled-600M via HF</small>');
            $('tr-src').value = 'eng_Latn';
            $('tr-tgt').value = 'spa_Latn';
            $('tr-go').onclick = async () => {
                const text = $('tr-text').value.trim();
                const src = $('tr-src').value;
                const tgt = $('tr-tgt').value;
                if (!text) return;
                setBusy($('tr-go'), true);
                $('tr-status').innerHTML = statusLine('info', 'Translating…');
                try {
                    const r = await callTool('translate', { text, src, tgt });
                    $('tr-out').value = r.text;
                    $('tr-status').innerHTML = statusLine('ok', `${src} → ${tgt}`);
                } catch (e) { $('tr-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('tr-go'), false);
            };
        },

        summarize: () => openModal('📝 SUMMARIZER', `
            <label class="tool-label">Long text</label>
            <textarea id="sum-text" rows="8" class="tool-input" placeholder="Paste an article, document, or transcript…"></textarea>
            <div style="display:flex; gap:8px;">
                <label class="tool-label" style="flex:1;">Min length<input type="number" id="sum-min" value="30" class="tool-input"></label>
                <label class="tool-label" style="flex:1;">Max length<input type="number" id="sum-max" value="200" class="tool-input"></label>
            </div>
            <button id="sum-go" class="tool-btn-primary">SUMMARIZE</button>
            <div id="sum-status"></div>
            <textarea id="sum-out" rows="6" class="tool-input" readonly></textarea>
        `, '<small style="color:#666;">BART-large-CNN via HF</small>') && (() => {
            $('sum-go').onclick = async () => {
                const text = $('sum-text').value.trim();
                if (!text) return;
                setBusy($('sum-go'), true);
                $('sum-status').innerHTML = statusLine('info', 'Summarizing…');
                try {
                    const r = await callTool('summarize', { text, min_length: +$('sum-min').value, max_length: +$('sum-max').value });
                    $('sum-out').value = r.text;
                    $('sum-status').innerHTML = statusLine('ok', 'Done.');
                } catch (e) { $('sum-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('sum-go'), false);
            };
        })(),

        classify: () => openModal('🏷️ ZERO-SHOT CLASSIFIER', `
            <label class="tool-label">Text</label>
            <textarea id="cl-text" rows="3" class="tool-input"></textarea>
            <label class="tool-label">Candidate labels (comma-separated)</label>
            <input type="text" id="cl-labels" class="tool-input" placeholder="positive, negative, neutral">
            <button id="cl-go" class="tool-btn-primary">CLASSIFY</button>
            <div id="cl-status"></div>
            <div id="cl-out"></div>
        `, '<small style="color:#666;">BART-MNLI via HF</small>') && (() => {
            $('cl-go').onclick = async () => {
                const text = $('cl-text').value.trim();
                const labels = $('cl-labels').value.split(',').map(s => s.trim()).filter(Boolean);
                if (!text || labels.length === 0) { $('cl-status').innerHTML = statusLine('warn', 'Need text + labels.'); return; }
                setBusy($('cl-go'), true);
                $('cl-status').innerHTML = statusLine('info', 'Classifying…');
                try {
                    const r = await callTool('classify', { text, labels });
                    const rows = (r.labels || []).map((lab, i) => {
                        const pct = ((r.scores[i] || 0) * 100).toFixed(1);
                        return `<div style="display:flex; gap:10px; align-items:center; margin:4px 0;">
                            <span style="flex:0 0 120px;">${lab}</span>
                            <div style="flex:1; background:#111; height:14px; border:1px solid #333;"><div style="background:var(--accent); height:100%; width:${pct}%;"></div></div>
                            <span style="flex:0 0 50px; text-align:right;">${pct}%</span>
                        </div>`;
                    }).join('');
                    $('cl-out').innerHTML = rows;
                    $('cl-status').innerHTML = statusLine('ok', 'Done.');
                } catch (e) { $('cl-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('cl-go'), false);
            };
        })(),

        ocr: () => openModal('👁️ OCR — READ IMAGE', `
            <label class="tool-label">Image with printed text</label>
            <input type="file" id="ocr-file" accept="image/*" class="tool-input">
            <button id="ocr-go" class="tool-btn-primary">EXTRACT TEXT</button>
            <div id="ocr-status"></div>
            <textarea id="ocr-out" rows="6" class="tool-input" readonly></textarea>
        `, '<small style="color:#666;">TrOCR-base-printed via HF</small>') && (() => {
            $('ocr-go').onclick = async () => {
                const f = $('ocr-file').files?.[0];
                if (!f) return;
                setBusy($('ocr-go'), true);
                $('ocr-status').innerHTML = statusLine('info', 'Reading…');
                try {
                    const image_b64 = await fileToBase64(f);
                    const r = await callTool('ocr', { image_b64 });
                    $('ocr-out').value = r.text;
                    $('ocr-status').innerHTML = statusLine('ok', 'Extracted.');
                } catch (e) { $('ocr-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('ocr-go'), false);
            };
        })(),

        embed: () => openModal('🧬 EMBEDDINGS [OWNER]', `
            <label class="tool-label">Text (or one per line for batch)</label>
            <textarea id="emb-text" rows="5" class="tool-input"></textarea>
            <button id="emb-go" class="tool-btn-primary">EMBED</button>
            <div id="emb-status"></div>
            <pre id="emb-out" style="max-height:240px; overflow:auto; background:#000; color:#0ff; padding:10px; border:1px solid #333; font-size:0.65rem;"></pre>
        `, '<small style="color:#666;">all-MiniLM-L6-v2 (384-dim) via HF</small>') && (() => {
            $('emb-go').onclick = async () => {
                const raw = $('emb-text').value.trim();
                if (!raw) return;
                const text = raw.includes('\n') ? raw.split('\n').filter(Boolean) : raw;
                setBusy($('emb-go'), true);
                $('emb-status').innerHTML = statusLine('info', 'Embedding…');
                try {
                    const r = await callTool('embed', { text });
                    const v = r.vector;
                    const dims = Array.isArray(v[0]) ? `${v.length}×${v[0].length}` : v.length;
                    $('emb-out').textContent = `dims: ${dims}\n\nfirst 16 values:\n${JSON.stringify((Array.isArray(v[0]) ? v[0] : v).slice(0, 16), null, 2)}`;
                    $('emb-status').innerHTML = statusLine('ok', 'Done.');
                } catch (e) { $('emb-status').innerHTML = statusLine('err', `FAILED: ${e.message}`); }
                setBusy($('emb-go'), false);
            };
        })(),
    };

    // ---------- boot ----------
    // No sidebar render, no mic button. Tools are invoked by:
    //   1. The AI emitting a tool tag in its reply (handled by ai_core.js handleAITriggers)
    //   2. The user typing slash-commands like /image, /translate (commands_core.js)
    //   3. The Owner DEV PANEL (deep-link via window.NexusTools.open(id))
    window.NexusTools = {
        open(id) { if (HANDLERS[id]) HANDLERS[id](); },
        callTool,                  // exposed so other modules can dispatch without their own fetch boilerplate
        list() { return TOOLS; },
        isOwner() { return IS_OWNER; },
        nllbLangs() { return NLLB_LANGS; },
        async refresh() {
            try {
                const r = await fetch(`${window.API_BASE || ''}/api/tools/manifest`, { credentials: 'same-origin' });
                const data = await r.json();
                TOOLS = data.tools || [];
                NLLB_LANGS = data.nllb_langs || {};
                IS_OWNER = !!data.owner;
                console.log(`[TOOLS] ${TOOLS.length} tools available (owner=${IS_OWNER}).`);
            } catch (e) {
                console.warn('[TOOLS] Manifest fetch failed:', e);
            }
        }
    };

    window.addEventListener('load', () => setTimeout(() => window.NexusTools.refresh(), 800));
})();
