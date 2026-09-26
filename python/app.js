BridgeNavigation.init('python');

const API = window.BRIDGE_BASE_URL || '';
const editor = document.querySelector('[data-python-code]');
const runButton = document.querySelector('[data-action="run-python"]');
const output = document.querySelector('[data-python-output]');

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

function showResult(result) {
  const parts = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(result.stderr);
  if (result.timed_out) parts.push('\n[Proceso detenido por timeout]');
  if (result.truncated) parts.push('\n[Salida truncada]');
  parts.push(`\n[exit_code: ${result.exit_code ?? 'timeout'}]`);
  output.textContent = parts.join('') || '[sin salida]';
}

async function connect() {
  try {
    await api('/api/health');
    BridgeStatus.set('connected', 'Bridge conectado');
    editor.disabled = false;
    runButton.disabled = false;
    output.textContent = 'Listo para ejecutar en Hostinger.';
  } catch {
    BridgeStatus.unavailable();
    editor.disabled = true;
    runButton.disabled = true;
    output.textContent = 'Hostinger no disponible';
  }
}

runButton?.addEventListener('click', async () => {
  runButton.disabled = true;
  output.textContent = 'Ejecutando…';
  try {
    const response = await api('/api/python/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: editor.value }),
    });
    showResult(await response.json());
  } catch (error) {
    output.textContent = error.status === 401 ? 'Sesión requerida' : `Error: ${error.message}`;
  } finally {
    runButton.disabled = false;
  }
});

document.querySelector('.output-clear')?.addEventListener('click', () => {
  output.textContent = '';
});

connect();
