BridgeNavigation.init('files');

const rows = document.querySelector('[data-file-rows]');
const empty = document.querySelector('[data-files-empty]');
const breadcrumb = document.querySelector('[data-breadcrumb]');
const itemCount = document.querySelector('[data-item-count]');
const downloadButton = document.querySelector('[data-action="download"]');
const moveButton = document.querySelector('[data-action="move"]');
const deleteButton = document.querySelector('[data-action="delete"]');
const uploadButton = document.querySelector('[data-action="upload"]');
let currentPath = '';
let currentItems = [];
let selected = null;

function joinPath(base, name) {
  return [base, name].filter(Boolean).join('/');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function setSelected(item) {
  selected = item;
  downloadButton.disabled = !item || item.is_dir;
  moveButton.disabled = !item;
  deleteButton.disabled = !item;
  rows.querySelectorAll('tr').forEach((tr) => tr.classList.toggle('selected', tr.dataset.name === item?.name));
}

function button(label, action, item) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'action-btn';
  node.textContent = label;
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    runAction(() => action(item));
  });
  return node;
}

function renderFiles(items) {
  currentItems = items;
  setSelected(null);
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.dataset.name = item.name;
    tr.addEventListener('click', () => setSelected(item));

    const check = document.createElement('td');
    check.className = 'check';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', `Seleccionar ${item.name}`);
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
      setSelected(checkbox.checked ? item : null);
    });
    check.appendChild(checkbox);

    const name = document.createElement('td');
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'file-name-button';
    nameButton.textContent = `${item.is_dir ? '□' : '▤'} ${item.name}`;
    if (item.is_dir) nameButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openFolder(item.name);
    });
    name.appendChild(nameButton);

    const type = document.createElement('td');
    type.className = 'col-type';
    type.textContent = item.type;
    const size = document.createElement('td');
    size.className = 'col-size';
    size.textContent = item.is_dir ? '—' : formatBytes(item.size);
    const modified = document.createElement('td');
    modified.textContent = String(item.modified || '').replace('T', ' ');
    const actions = document.createElement('td');
    actions.className = 'row-actions';
    if (item.is_dir) actions.appendChild(button('Abrir', () => openFolder(item.name), item));
    else actions.appendChild(button('Descargar', downloadItem, item));
    actions.appendChild(button('Renombrar', renameItem, item));
    actions.appendChild(button('Mover', moveItem, item));
    actions.appendChild(button('Eliminar', deleteItem, item));

    tr.append(check, name, type, size, modified, actions);
    fragment.appendChild(tr);
  });

  rows.replaceChildren(fragment);
  empty.hidden = items.length > 0;
  if (!items.length) {
    empty.querySelector('h3').textContent = 'Esta carpeta está vacía';
    empty.querySelector('p').textContent = 'Crea una carpeta o un archivo para comenzar.';
  }
  itemCount.textContent = `${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}`;
  breadcrumb.textContent = `⌂ / Archivos${currentPath ? ` / ${currentPath}` : ''}`;
}

async function executeRemote(payload) {
  const queued = await RemoteAPI.dispatch(payload);
  const job = await RemoteAPI.waitForJob(queued.request_id, { timeoutMs: 180000, intervalMs: 2000 });
  if (job.status !== 'success') {
    throw new Error(job.error_message || 'La operación remota falló');
  }
  return job;
}

async function loadFiles() {
  BridgeStatus.set('connected', 'GitHub Remote conectado');
  const job = await executeRemote({ operation: 'list', path: currentPath });
  renderFiles(job.result_json?.items || []);
}

async function safeReload() {
  try {
    await loadFiles();
  } catch (error) {
    rows.replaceChildren();
    empty.hidden = false;
    empty.querySelector('h3').textContent = error.status === 401 ? 'Sesión requerida' : 'GitHub Remote no disponible';
    empty.querySelector('p').textContent = error.message || String(error);
    if (error.status === 401) window.location.href = '../remote/';
  }
}

async function openFolder(name) {
  currentPath = joinPath(currentPath, name);
  await safeReload();
}

async function createFolder() {
  const name = prompt('Nombre de la nueva carpeta:')?.trim();
  if (!name) return;
  await executeRemote({ operation: 'mkdir', path: currentPath, name });
  await safeReload();
}

async function createFile() {
  const name = prompt('Nombre del nuevo archivo:')?.trim();
  if (!name) return;
  await executeRemote({ operation: 'write-text', path: joinPath(currentPath, name), content: '' });
  await safeReload();
}

async function renameItem(item = selected) {
  if (!item) return;
  const newName = prompt('Nuevo nombre:', item.name)?.trim();
  if (!newName || newName === item.name) return;
  await executeRemote({ operation: 'rename', path: currentPath, name: item.name, new_name: newName });
  await safeReload();
}

async function moveItem(item = selected) {
  if (!item) return;
  const destination = prompt('Carpeta de destino relativa a /srv/DiscoD:', '')?.trim();
  if (destination === undefined) return;
  await executeRemote({ operation: 'move', path: currentPath, name: item.name, destination });
  await safeReload();
}

async function deleteItem(item = selected) {
  if (!item || !confirm(`¿Eliminar ${item.name}?`)) return;
  await executeRemote({ operation: 'delete', path: currentPath, name: item.name, confirm: 'DELETE' });
  await safeReload();
}

async function downloadItem(item = selected) {
  if (!item || item.is_dir) return;
  const job = await executeRemote({ operation: 'prepare-download', path: joinPath(currentPath, item.name) });
  if (job.github_run_id) {
    window.open(`https://github.com/datapublicm/Hostinger-Web-Bridge/actions/runs/${job.github_run_id}`, '_blank', 'noopener');
  }
}

async function runAction(action) {
  try { await action(); }
  catch (error) {
    if (error.status === 401) window.location.href = '../remote/';
    else alert(error.message || String(error));
  }
}

document.querySelector('[data-action="new-folder"]')?.addEventListener('click', () => runAction(createFolder));
document.querySelector('[data-action="new-file"]')?.addEventListener('click', () => runAction(createFile));
uploadButton?.addEventListener('click', () => {
  alert('La carga local desde navegador todavía no está habilitada en GitHub Remote. El resto del administrador funciona con la interfaz original.');
});
downloadButton?.addEventListener('click', () => runAction(() => downloadItem()));
moveButton?.addEventListener('click', () => runAction(() => moveItem()));
deleteButton?.addEventListener('click', () => runAction(() => deleteItem()));
breadcrumb?.addEventListener('click', async () => {
  if (!currentPath) return;
  currentPath = currentPath.split('/').slice(0, -1).join('/');
  await safeReload();
});

safeReload();
