(() => {
  const FUNCTION_NAME = 'web_hostinger_bridge_remote';

  class RemoteError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'RemoteError';
      this.status = status;
    }
  }

  let client;

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) throw new RemoteError('Cliente Supabase no disponible');
    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config?.publishableKey) throw new RemoteError('Configuración Supabase no disponible');
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return client;
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw new RemoteError(error.message);
    return data.session || null;
  }

  async function signInWithGitHub() {
    const redirectTo = new URL('../remote/', window.location.href).href;
    const { data, error } = await getClient().auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    });
    if (error) throw new RemoteError(error.message);
    return data;
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw new RemoteError(error.message);
  }

  async function invoke(method, payload, query = '') {
    const session = await getSession();
    if (!session?.access_token) throw new RemoteError('Debes iniciar sesión con GitHub.', 401);

    const config = window.SUPABASE_CONFIG;
    const response = await fetch(`${config.url}/functions/v1/${FUNCTION_NAME}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.publishableKey,
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new RemoteError(body.error || 'Sesión expirada. Inicia sesión nuevamente.', 401);
      if (response.status === 403) throw new RemoteError(body.error || 'Tu cuenta no está autorizada para GitHub Remote.', 403);
      throw new RemoteError(body.error || `Error remoto HTTP ${response.status}`, response.status);
    }
    return body;
  }

  async function dispatch(payload) {
    return invoke('POST', payload);
  }

  async function getJob(requestId) {
    if (!requestId) throw new RemoteError('request_id requerido');
    return invoke('GET', null, `?request_id=${encodeURIComponent(requestId)}`);
  }

  async function waitForJob(requestId, options = {}) {
    const timeoutMs = Math.max(1000, Number(options.timeoutMs || 180000));
    const intervalMs = Math.max(750, Number(options.intervalMs || 2000));
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const job = await getJob(requestId);
      if (job.status === 'success' || job.status === 'failure') return job;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new RemoteError('La operación sigue en proceso. Puedes volver a consultar su estado.', 408);
  }

  window.RemoteAuth = Object.freeze({ signInWithGitHub, signOut, getSession });
  window.RemoteAPI = Object.freeze({ dispatch, getJob, waitForJob, RemoteError });
})();
