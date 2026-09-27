BridgeNavigation.init('portal');

const loginPanel = document.querySelector('[data-remote-login]');
const headerStatus = document.querySelector('[data-remote-header-status]');
const loginButton = document.querySelector('[data-action="github-login"]');

function setHeader(state, text) {
  headerStatus.dataset.state = state;
  headerStatus.textContent = text;
}

async function refreshSession() {
  try {
    const session = await RemoteAuth.getSession();
    if (session) {
      setHeader('connected', 'GitHub Remote conectado');
      window.location.replace('../portal/');
      return;
    }
    loginPanel.hidden = false;
    setHeader('checking', 'Inicia sesión con GitHub');
  } catch (error) {
    loginPanel.hidden = false;
    setHeader('error', error.message || 'No se pudo comprobar la sesión');
  }
}

loginButton?.addEventListener('click', async () => {
  loginButton.disabled = true;
  setHeader('checking', 'Abriendo GitHub…');
  try {
    await RemoteAuth.signInWithGitHub();
  } catch (error) {
    loginButton.disabled = false;
    setHeader('error', error.message || 'Error de inicio de sesión');
  }
});

refreshSession();
