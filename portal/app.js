BridgeNavigation.init('portal');

const API = window.BRIDGE_BASE_URL || '';
const form = document.querySelector('[data-login-form]');
const user = document.querySelector('[data-login-user]');
const password = document.querySelector('[data-login-password]');
const message = document.querySelector('[data-login-message]');
const logout = document.querySelector('[data-action="logout"]');

const REMOTE_TARGETS = Object.freeze({
  files: '../remote/#files',
  python: '../remote/#python',
  terminal: '../remote/#terminal',
});

async function applyRemoteNavigationIfAuthenticated() {
  try {
    const session = await RemoteAuth.getSession();
    if (!session) return;
    document.querySelectorAll('[data-remote-target]').forEach((link) => {
      const target = link.dataset.remoteTarget;
      const href = REMOTE_TARGETS[target];
      if (href) link.setAttribute('href', href);
    });
  } catch {}
}

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

function setAuthenticated(authenticated) {
  form.querySelector('button[type="submit"]').hidden = authenticated;
  user.hidden = authenticated;
  password.hidden = authenticated;
  logout.hidden = !authenticated;
  message.textContent = authenticated ? 'Sesión iniciada' : 'Inicia sesión para usar las herramientas.';
}

async function checkSession() {
  try {
    await api('/api/health');
    BridgeStatus.set('connected', 'Bridge conectado');
    try {
      await api('/api/session');
      setAuthenticated(true);
    } catch (error) {
      if (error.status === 401) setAuthenticated(false);
      else throw error;
    }
  } catch {
    BridgeStatus.unavailable();
    setAuthenticated(false);
    message.textContent = 'Hostinger no disponible';
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Iniciando sesión…';
  try {
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.value, password: password.value }),
    });
    password.value = '';
    setAuthenticated(true);
    BridgeStatus.set('connected', 'Bridge conectado');
  } catch (error) {
    password.value = '';
    message.textContent = error.status === 401 ? 'Usuario o contraseña incorrectos' : `Error: ${error.message}`;
  }
});

logout?.addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  setAuthenticated(false);
});

applyRemoteNavigationIfAuthenticated();
checkSession();
