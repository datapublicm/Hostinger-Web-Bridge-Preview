BridgeNavigation.init('python');

const API = window.BRIDGE_BASE_URL || '';
const editor = document.querySelector('[data-python-code]');
const runButton = document.querySelector('[data-action="run-python"]');
const saveButton = document.querySelector('[data-action="save-python"]');
const newButton = document.querySelector('[data-action="new-python-file"]');
const output = document.querySelector('[data-python-output]');
const tree = document.querySelector('[data-python-tree]');
const pathNode = document.querySelector('[data-python-path]');
const tabNode = document.querySelector('[data-python-tab]');
const search = document.querySelector('[data-python-search]');

let remoteMode = false;
let currentDir = '';
let currentItems = [];
let activeFile = '';
let activeKind = '';

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

function joinPath(base, name) {
  return [base, name].filter(Boolean).join('/');
}

function showProcessResult(result) {
  const parts = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(result.stderr);
  if (result.timed_out) parts.push('\n[Proceso detenido por timeout]');
  if (result.truncated) parts.push('\n[Salida truncada]');
  parts.push(`\n[exit_code: ${result.exit_code ?? 'timeout'}]`);
  output.textContent = parts.join('') || '[sin salida]';
}

async function executeRemote(payload) {
  const queued = await RemoteAPI.dispatch(payload);
  const job = await RemoteAPI.waitForJob(queued.request_id, { timeoutMs: 180000, intervalMs: 2000 });
  if (job.status !== 'success') throw new Error(job.error_message || 'La operación remota falló');
  return job.result_json || {};
}

function setRemoteReady() {
  remoteMode = true;
  BridgeStatus.set('connected', 'GitHub Remote conectado');
  editor.disabled = false;
  runButton.disabled = false;
  saveButton.disabled = true;
  newButton.disabled = false;
  search.disabled = false;
  output.textContent = 'GitHub Remote listo. Selecciona un .py o escribe código para ejecutar.';
}

function renderTree() {
  const term = (search.value || '').trim().toLowerCase();
  const visible = currentItems.filter((item) => {
    if (!item.is_dir && !['.py', '.ipynb'].some((ext) => item.name.toLowerCase().endsWith(ext))) return false;
    return !term || item.name.toLowerCase().includes(term);
  });

  tree.classList.add('remote-tree');
  const fragment = document.createDocumentFragment();

  if (currentDir) {
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'python-tree-item folder';
    up.textContent = '↑ ..';
    up.addEventListener('click', async () => {
      currentDir = currentDir.split('/').slice(0, -1).join('/');
      await loadRemoteDirectory();
    });
    fragment.appendChild(up);
  }

  visible.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `python-tree-item ${item.is_dir ? 'folder' : 'file'}`;
    button.textContent = `${item.is_dir ? '□' : item.name.toLowerCase().endsWith('.ipynb') ? '◫' : '▤'} ${item.name}`;
    button.addEventListener('click', async () => {
      if (item.is_dir) {
        currentDir = joinPath(currentDir, item.name);
        await loadRemoteDirectory();
      } else {
        await openRemoteFile(joinPath(currentDir, item.name));
      }
    });
    fragment.appendChild(button);
  });

  if (!visible.length) {
    const note = document.createElement('span');
    note.className = 'python-tree-empty';
    note.textContent = term ? 'No hay coincidencias en esta carpeta.' : 'No hay .py ni .ipynb en esta carpeta.';
    fragment.appendChild(note);
  }

  tree.replaceChildren(fragment);
  pathNode.textContent = `Workspace de Python${currentDir ? ` / ${currentDir}` : ''}`;
}

async function loadRemoteDirectory() {
  try {
    const result = await executeRemote({ operation: 'list', path: joinPath('Python', currentDir) });
    currentItems = result.items || [];
    renderTree();
  } catch (error) {
    tree.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = 'No se pudo explorar Python';
    const span = document.createElement('span');
    span.textContent = error.message || String(error);
    tree.append(strong, span);
  }
}

function notebookToText(content) {
  try {
    const notebook = JSON.parse(content);
    const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
    const code = cells
      .filter((cell) => cell?.cell_type === 'code')
      .map((cell, index) => `# %% celda ${index + 1}\n${Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')}`);
    return code.join('\n\n') || '# Notebook sin celdas de código';
  } catch {
    return content;
  }
}

async function openRemoteFile(relativePath) {
  output.textContent = `Abriendo ${relativePath}…`;
  const result = await executeRemote({ operation: 'read-text', path: joinPath('Python', relativePath) });
  activeFile = relativePath;
  activeKind = relativePath.toLowerCase().endsWith('.ipynb') ? 'ipynb' : 'py';
  tabNode.textContent = relativePath.split('/').pop();
  if (activeKind === 'ipynb') {
    editor.value = notebookToText(result.content || '');
    editor.disabled = true;
    saveButton.disabled = true;
    runButton.disabled = true;
    output.textContent = 'Notebook .ipynb abierto como vista de sus celdas de código. La ejecución remota de notebooks todavía no está habilitada.';
  } else {
    editor.value = result.content || '';
    editor.disabled = false;
    saveButton.disabled = false;
    runButton.disabled = false;
    output.textContent = `Listo: ${relativePath}`;
  }
}

async function saveRemoteFile() {
  if (!activeFile || activeKind !== 'py') return;
  saveButton.disabled = true;
  output.textContent = `Guardando ${activeFile}…`;
  try {
    await executeRemote({ operation: 'write-text', path: joinPath('Python', activeFile), content: editor.value });
    output.textContent = `Guardado: ${activeFile}`;
    await loadRemoteDirectory();
  } finally {
    saveButton.disabled = false;
  }
}

async function createRemoteFile() {
  let name = prompt('Nombre del nuevo archivo Python:')?.trim();
  if (!name) return;
  if (!name.toLowerCase().endsWith('.py')) name += '.py';
  const relative = joinPath(currentDir, name);
  await executeRemote({ operation: 'write-text', path: joinPath('Python', relative), content: '' });
  await loadRemoteDirectory();
  await openRemoteFile(relative);
}

async function runRemotePython() {
  runButton.disabled = true;
  output.textContent = 'Ejecutando…';
  try {
    let result;
    if (activeFile && activeKind === 'py') {
      result = await executeRemote({ operation: 'python-run-file', path: activeFile });
    } else {
      result = await executeRemote({ operation: 'python-run', code: editor.value });
    }
    showProcessResult(result);
  } catch (error) {
    output.textContent = `Error: ${error.message || String(error)}`;
  } finally {
    runButton.disabled = activeKind === 'ipynb';
  }
}

async function connectDirect() {
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

async function runDirectPython() {
  runButton.disabled = true;
  output.textContent = 'Ejecutando…';
  try {
    const response = await api('/api/python/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: editor.value }),
    });
    showProcessResult(await response.json());
  } catch (error) {
    output.textContent = error.status === 401 ? 'Sesión requerida' : `Error: ${error.message}`;
  } finally {
    runButton.disabled = false;
  }
}

runButton?.addEventListener('click', () => (remoteMode ? runRemotePython() : runDirectPython()));
saveButton?.addEventListener('click', () => {
  if (remoteMode) saveRemoteFile().catch((error) => { output.textContent = `Error: ${error.message}`; });
});
newButton?.addEventListener('click', () => {
  if (remoteMode) createRemoteFile().catch((error) => { output.textContent = `Error: ${error.message}`; });
});
search?.addEventListener('input', () => {
  if (remoteMode) renderTree();
});
document.querySelector('.output-clear')?.addEventListener('click', () => {
  output.textContent = '';
});

(async () => {
  try {
    const session = window.RemoteAuth ? await RemoteAuth.getSession() : null;
    if (session) {
      setRemoteReady();
      await loadRemoteDirectory();
      return;
    }
  } catch {}
  await connectDirect();
})();
