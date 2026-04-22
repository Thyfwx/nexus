// 📊 NEXUS STATS CORE v5.2.0
// Logic for CPU, Memory, and Network telemetry monitoring.

function connectStats() {
    console.log("[STATS] Monitoring service synchronized.");
}

function updateClientStats() {
    // Shared pointers from nexus_globals.js
    if (!window.cpuStat || !window.memStat) {
        window.cpuStat = document.getElementById("cpu-stat");
        window.memStat = document.getElementById("mem-stat");
    }
    
    // Simulate real-time logic
    const cpu = Math.floor(Math.random() * 15) + 5;
    const mem = Math.floor(Math.random() * 10) + 40;
    
    if (window.cpuStat) window.cpuStat.textContent = `${cpu}%`;
    if (window.memStat) window.memStat.textContent = `${mem}%`;
}

function startMonitor() {
    if (window.monitorInterval) clearInterval(window.monitorInterval);
    
    window.guiTitle.textContent = 'SYSTEM MONITOR';
    window.nexusCanvas.style.display = 'block';
    window.nexusCanvas.width = 400; window.nexusCanvas.height = 300;
    const ctx = window.nexusCanvas.getContext('2d');

    window.monitorInterval = setInterval(() => {
        const cpu = Math.random() * 100;
        const mem = 40 + Math.random() * 20;
        
        window.cpuHistory.push(cpu);
        window.memHistory.push(mem);
        if (window.cpuHistory.length > 50) window.cpuHistory.shift();
        if (window.memHistory.length > 50) window.memHistory.shift();

        drawMonitor(ctx);
    }, 1000);
}

function drawMonitor(ctx) {
    ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, 400, 300);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<400; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,300); ctx.stroke(); }
    for(let i=0; i<300; i+=30) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(400,i); ctx.stroke(); }

    // CPU Line
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    window.cpuHistory.forEach((val, i) => {
        const x = i * (400/50);
        const y = 300 - (val * 2.5) - 20;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // MEM Line
    ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
    ctx.beginPath();
    window.memHistory.forEach((val, i) => {
        const x = i * (400/50);
        const y = 300 - (val * 2.5) - 20;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
}
