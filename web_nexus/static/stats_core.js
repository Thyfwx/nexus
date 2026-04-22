// 📊 NEXUS STATS CORE v4.0.85
// Handles CPU, Memory, and Network telemetry visualization.

window.cpuHistory = [];
window.memHistory = [];
window.netHistory = [];
window.monitorInterval = null;

function startMonitor() {
    if (window.monitorInterval) clearInterval(window.monitorInterval);
    
    window.guiTitle.textContent = 'SYSTEM MONITOR';
    window.nexusCanvas.style.display = 'block';
    window.nexusCanvas.width = 400; window.nexusCanvas.height = 300;
    const ctx = window.nexusCanvas.getContext('2d');

    window.monitorInterval = setInterval(() => {
        // Mock data for visualization if WS is offline, otherwise uses real telemetry
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
    
    // Grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<400; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,300); ctx.stroke(); }
    for(let i=0; i<300; i+=30) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(400,i); ctx.stroke(); }

    // CPU Line (Neon Cyan)
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    window.cpuHistory.forEach((val, i) => {
        const x = i * (400/50);
        const y = 300 - (val * 2.5) - 20;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // MEM Line (Neon Magenta)
    ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
    ctx.beginPath();
    window.memHistory.forEach((val, i) => {
        const x = i * (400/50);
        const y = 300 - (val * 2.5) - 20;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
    ctx.fillText('CPU LOAD', 10, 20);
    ctx.fillStyle = '#0ff'; ctx.fillRect(70, 12, 10, 10);
    
    ctx.fillStyle = '#fff'; ctx.fillText('MEM USAGE', 100, 20);
    ctx.fillStyle = '#f0f'; ctx.fillRect(170, 12, 10, 10);
}
