BridgeNavigation.init('terminal');

const API = window.BRIDGE_BASE_URL || '';
const command = document.querySelector('[data-terminal-command]');
const runButton = document.querySelector('[data-action="run-command"]');
const sessionButton = document.querySelector('[data-action="open-session"]');
const sessionStatus = document.querySelector('[data-terminal-session-status]');
const output = document.querySelector('[data-terminal-output]');
let socket = null;

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (API.includes('ngrok')) headers.set('ngrok-skip-browser-warning', 'true');
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.detail || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

function websocketUrl(path) {
  const url = new URL(path, API || window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

async function connect() {
  try {
    await api('/api/health');
    BridgeStatus.set('connected', 'Bridge conectado');
    command.disabled = false;
    runButton.disabled = false;
    sessionButton.disabled = false;
    output.textContent = 'Consola lista. Los comandos se ejecutarán en Hostinger.';
  } catch {
    BridgeStatus.unavailable();
    command.disabled = true;
    runButton.disabled = true;
    sessionButton.disabled = true;
    output.textContent = 'Hostinger no disponible';
  }
}

async function runCommand() {
  const value = command.value.trim();
  if (!value) return;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(`${value}\n`);
    return;
  }
  runButton.disabled = true;
  output.textContent = `$ ${value}\n`;
  try {
    const response = await api('/api/terminal/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: value }),
    });
    const result = await response.json();
    output.textContent += result.stdout || '';
    if (result.stderr) output.textContent += result.stderr;
    if (result.timed_out) output.textContent += '\n[Proceso detenido por timeout]';
    if (result.truncated) output.textContent += '\n[Salida truncada]';
    output.textContent += `\n[exit_code: ${result.exit_code ?? 'timeout'}]`;
  } catch (error) {
    output.textContent += error.status === 401 ? 'Sesión requerida' : `Error: ${error.message}`;
  } finally {
    runButton.disabled = false;
  }
}

function openSession() {
  if (socket) socket.close();
  output.textContent = '';
  sessionStatus.textContent = 'Conectando…';
  socket = new WebSocket(websocketUrl('/api/terminal/ws'));
  socket.addEventListener('open', () => {
    sessionStatus.textContent = 'Conectada';
    output.textContent += '[sesión interactiva abierta]\n';
  });
  socket.addEventListener('message', (event) => {
    output.textContent += event.data;
    output.scrollTop = output.scrollHeight;
  });
  socket.addEventListener('close', () => {
    sessionStatus.textContent = 'Desconectada';
    socket = null;
  });
  socket.addEventListener('error', () => {
    sessionStatus.textContent = 'Error';
  });
}

runButton?.addEventListener('click', runCommand);
sessionButton?.addEventListener('click', openSession);
command?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') runCommand();
});
document.querySelector('[data-action="clear-terminal"]')?.addEventListener('click', () => {
  output.textContent = '';
});
document.querySelector('[data-action="copy-terminal"]')?.addEventListener('click', async () => {
  if (navigator.clipboard) await navigator.clipboard.writeText(output.textContent);
});

connect();
