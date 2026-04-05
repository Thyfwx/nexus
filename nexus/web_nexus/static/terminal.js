const statsWs = new WebSocket(`ws://${location.host}/ws/stats`);
const termWs = new WebSocket(`ws://${location.host}/ws/terminal`);

const cpuStat = document.getElementById('cpu-stat');
const memStat = document.getElementById('mem-stat');
const batStat = document.getElementById('bat-stat');
const output = document.getElementById('terminal-output');
const input = document.getElementById('terminal-input');

statsWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    cpuStat.textContent = data.cpu.toFixed(1);
    memStat.textContent = data.mem.toFixed(1);
    batStat.textContent = data.battery;
};

termWs.onmessage = (event) => {
    printToTerminal(event.data);
};

function printToTerminal(text, className="sys-msg") {
    const p = document.createElement('p');
    p.className = className;
    // Replace newlines with <br> and spaces with &nbsp; for ascii art preservation if needed
    p.innerHTML = text.replace(/\n/g, '<br>');
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
}

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
            if (cmd.toLowerCase() === 'clear') {
                output.innerHTML = '';
            } else {
                printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
                termWs.send(cmd);
            }
            input.value = '';
        }
    }
});

// Setup quick action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd === 'clear') {
            output.innerHTML = '';
        } else {
            printToTerminal(`root@nexus:~# ${cmd}`, 'user-cmd');
            termWs.send(cmd);
            input.focus();
        }
    });
});

// Geo-IP Fetch (Client-Side)
fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
        document.querySelector('.geo-stat').textContent = `LOC: ${data.city || 'Unknown'}, ${data.country || 'World'}`;
    }).catch(e => {
        document.querySelector('.geo-stat').textContent = 'LOC: Unknown';
    });

// Always focus the terminal input when clicking inside the window
document.querySelector('.terminal-container').addEventListener('click', () => {
    input.focus();
});
