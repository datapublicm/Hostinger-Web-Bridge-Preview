BridgeNavigation.init('portal');

const loginPanel = document.querySelector('[data-remote-login]');
const workspace = document.querySelector('[data-remote-workspace]');
const sessionUser = document.querySelector('[data-session-user]');
const headerStatus = document.querySelector('[data-remote-header-status]');
const statusNode = document.querySelector('[data-remote-status]');
const resultNode = document.querySelector('[data-remote-result]');
const loginButton = document.querySelector('[data-action="github-login"]');
const logoutButton = document.querySelector('[data-action="logout"]');
const tabs = [...document.querySelectorAll('[data-mode]')];
const panels = [...document.querySelectorAll('[data-panel]')];
const moduleLinks = [...document.querySelectorAll('.nav-item[data-module]')];
const remoteModes = new Set(['files', 'python', 'terminal']);

function setHeader(state, text) {
  headerStatus.dataset.state = state;
  headerStatus.textContent = text;
}

function setStatus(text) {
  statusNode.textContent = text;
}

function showResult(value) {
  resultNode.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function modeFromHash() {
  const mode = window.location.hash.replace(/^#/, '');
  return remoteModes.has(mode) ? mode : 'files';
}

function activateMode(mode) {
  const selected = remoteModes.has(mode) ? mode : 'files';
  tabs.forEach((item) => item.classList.toggle('active', item.dataset.mode === selected));
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== selected; });
  moduleLinks.forEach((link) => {
    const module = link.dataset.module;
    link.classList.toggle('active', remoteModes.has(module) && module === selected);
  });
}

function setAuthenticated(session) {
  const authenticated = Boolean(session);
  loginPanel.hidden = authenticated;
  workspace.hidden = !authenticated;
  if (authenticated) {
    const meta = session.user?.user_metadata || {};
    sessionUser.textContent = meta.user_name || meta.preferred_username || session.user?.email || 'GitHub autorizado';
    setHeader('connected', 'GitHub Remote conectado');
  } else {
    setHeader('checking', 'Inicia sesión con GitHub');
  }
}

async function refreshSession() {
  try {
    const session = await RemoteAuth.getSession();
    setAuthenticated(session);
  } catch (error) {
    setAuthenticated(null);
    setStatus('No se pudo comprobar la sesión');
    showResult(error.message || String(error));
  }
}

async function executeRemote(payload) {
  setStatus('Enviando a GitHub Remote…');
  showResult({ operation: payload.operation, status: 'enviando' });
  try {
    const queued = await RemoteAPI.dispatch(payload);
    setStatus(`En cola · ${queued.request_id}`);
    showResult(queued);
    const job = await RemoteAPI.waitForJob(queued.request_id, { timeoutMs: 180000, intervalMs: 2000 });
    setStatus(job.status === 'success' ? 'Completado' : 'Falló');
    showResult(job);
    return job;
  } catch (error) {
    if (error.status === 401) {
      setAuthenticated(null);
      setHeader('error', 'Sesión requerida');
    } else if (error.status === 403) {
      setHeader('error', 'Cuenta no autorizada');
    }
    setStatus(error.status === 403 ? 'Acceso denegado' : 'Error');
    showResult({ status: error.status || 0, error: error.message || String(error) });
    throw error;
  }
}

loginButton?.addEventListener('click', async () => {
  setStatus('Abriendo GitHub…');
  try {
    await RemoteAuth.signInWithGitHub();
  } catch (error) {
    setStatus('Error de inicio de sesión');
    showResult(error.message || String(error));
  }
});

logoutButton?.addEventListener('click', async () => {
  try {
    await RemoteAuth.signOut();
  } finally {
    setAuthenticated(null);
    setStatus('Sesión cerrada');
    showResult('Sin resultados todavía.');
  }
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode || 'files';
    if (window.location.hash !== `#${mode}`) window.location.hash = mode;
    else activateMode(mode);
  });
});

window.addEventListener('hashchange', () => activateMode(modeFromHash()));

document.querySelector('[data-files-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const operation = String(data.get('operation') || 'list');
  const payload = {
    operation,
    path: String(data.get('path') || ''),
    name: String(data.get('name') || ''),
    new_name: String(data.get('new_name') || ''),
    destination: String(data.get('destination') || ''),
    content: String(data.get('content') || ''),
    confirm: String(data.get('confirm') || ''),
    inbox_file: String(data.get('inbox_file') || ''),
  };

  if (operation === 'delete' && payload.confirm !== 'DELETE') {
    setStatus('Confirmación requerida');
    showResult('Para eliminar debes escribir DELETE exactamente.');
    return;
  }
  await executeRemote(payload).catch(() => {});
});

document.querySelector('[data-python-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const operation = String(data.get('operation') || 'python-run');
  await executeRemote({
    operation,
    path: String(data.get('path') || ''),
    code: String(data.get('code') || ''),
  }).catch(() => {});
});

document.querySelector('[data-terminal-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  await executeRemote({
    operation: 'terminal-exec',
    command: String(data.get('command') || ''),
  }).catch(() => {});
});

// Operations exposed by the backend contract: list, mkdir, rename, move, delete,
// read-text, write-text, prepare-download, upload, python-run, python-run-file,
// terminal-exec.
activateMode(modeFromHash());
refreshSession();
