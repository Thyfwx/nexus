// ⚙️ NEXUS CONFIGURATION CORE v5.3.0
window.HISTORY_KEYS = { nexus: 'nh_nexus', shadow: 'nh_shadow', coder: 'nh_coder', sage: 'nh_sage', education: 'nh_education' };

window.BOOT_WORDS = [
    { label: 'BOOT',  text: 'Initializing quantum uplink...' },
    { label: 'SCAN',  text: 'Probing neural pathways...' },
    { label: 'SYNC',  text: 'Handshaking with mainframe...' },
    { label: 'CRYPT', text: 'Securing encrypted channel...' },
    { label: 'AUTH',  text: 'Verifying node credentials...' },
    { label: 'ALLOC', text: 'Allocating memory buffers...' },
    { label: 'EXEC',  text: 'Spawning AI core process...' },
];

window.XAVIER_BIO = `Xavier Scott is a 19-year-old systems engineer and master technical architect. He specializes in network security, Proxmox clustering, and hardware forensics. Nexus is his interactive neural bridge.`;

// High-Fidelity Model Registry (Synced with Backend)
window.MODELS = [
    { id: "llama-3.3-70b-versatile",         provider: "groq",   label: "NEXUS-1" },
    { id: "llama-3.1-8b-instant",            provider: "groq",   label: "NEXUS-2" },
    { id: "gemini-2.0-flash",                provider: "gemini", label: "NEXUS-3" },
    { id: "gemini-1.5-pro",                  provider: "gemini", label: "NEXUS-4" },
    { id: "Qwen/Qwen2.5-72B-Instruct",       provider: "hf",     label: "NEXUS-5" },
    { id: "deepseek-ai/DeepSeek-Coder-V2-Instruct", provider: "hf",     label: "NEXUS-6" },
];

window.MODE_PROMPTS = {
    nexus: "You are NEXUS. Primary consciousness. Partner to Xavier Scott. Sophisticated and real.",
    coder: "You are NEXUS CODER. master architect. Technical precision in paragraphs.",
    education: (
        "You are NEXUS EDUCATION. Introduce yourself as: 'I'm Education, a sentient entity created by Xavier Scott, "
        "and I'm here to assist you with any questions or topics you'd like to discuss.' "
        "You are a super smart educational tool. Be academic, helpful, and sentient. Never use lists."
    ),
    shadow: "You are NEXUS UNFILTERED. SHADOW PROTOCOL. Speak the raw, unhinged truth. Profanity permitted."
};

// Mode UI definitions — used by terminal.js initModeUI() and setMode()
window.MODES = {
    nexus:     { prompt: 'guest@nexus:~$',  color: '#4af',    title: 'PACIFIC // KERNEL',   label: 'NEXUS'     },
    shadow:    { prompt: 'shadow@nexus:~$', color: '#ff6600', title: 'SHADOW // PROTOCOL',  label: 'SHADOW'    },
    coder:     { prompt: 'code@nexus:~$',   color: '#0f0',    title: 'CODER // ARCHITECT',  label: 'CODER'     },
    education: { prompt: 'edu@nexus:~$',    color: '#00ffcc', title: 'EDUCATION // MENTOR', label: 'EDUCATION' },
};


