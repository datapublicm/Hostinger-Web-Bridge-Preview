(() => {
  const API = window.BRIDGE_BASE_URL || '';
  const empty = document.querySelector('[data-files-empty]');

  function showFailure(title, detail, disconnected = false) {
    if (disconnected) BridgeStatus.unavailable();
    if (!empty) return;
    empty.hidden = false;
    const heading = empty.querySelector('h3');
    const message = empty.querySelector('p');
    if (heading) heading.textContent = title;
    if (message) message.textContent = detail;
  }

  function loadScript(src, onError) {
    const script = document.createElement('script');
    script.src = src;
    script.onerror = onError;
    document.body.appendChild(script);
  }

  async function loadRemoteFilesAppIfAuthenticated() {
    try {
      const session = await RemoteAuth.getSession();
      if (!session) return false;
      loadScript('./remote-app.js', () => {
        showFailure('No se pudo cargar Archivos', 'El módulo GitHub Remote no pudo iniciarse.');
      });
      return true;
    } catch {
      return false;
    }
  }

  async function loadPrivateFilesApp() {
    try {
      const response = await fetch(`${API}/api/ui/files-app.js`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!response.ok) {
        if (response.status === 401) {
          showFailure('Sesión requerida', 'Inicia sesión desde Inicio para administrar archivos.');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const source = await response.text();
      const blobUrl = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      const script = document.createElement('script');
      script.src = blobUrl;
      script.onload = () => URL.revokeObjectURL(blobUrl);
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        showFailure('No se pudo cargar Archivos', 'El Bridge respondió, pero el módulo privado no pudo iniciarse.');
      };
      document.body.appendChild(script);
    } catch (error) {
      showFailure('Hostinger no disponible', `No se pudo cargar el módulo privado: ${error.message}`, true);
    }
  }

  (async () => {
    if (await loadRemoteFilesAppIfAuthenticated()) return;
    await loadPrivateFilesApp();
  })();
})();
