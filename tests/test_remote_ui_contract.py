from pathlib import Path


PORTAL = Path('portal/index.html')
PORTAL_APP = Path('portal/app.js')
REMOTE = Path('remote/index.html')
APP = Path('remote/app.js')
STYLES = Path('remote/styles.css')


def test_portal_keeps_direct_bridge_and_opens_remote_panel():
    html = PORTAL.read_text('utf-8')
    assert 'Acceso directo al Bridge' in html
    assert 'data-login-form' in html
    assert 'GitHub Remote' in html
    assert 'href="../remote/"' in html


def test_portal_preserves_remote_session_navigation():
    html = PORTAL.read_text('utf-8')
    app = PORTAL_APP.read_text('utf-8')
    assert '../shared/supabase-config.js' in html
    assert '../shared/remote-api.js' in html
    assert 'data-remote-target="files"' in html
    assert 'data-remote-target="python"' in html
    assert 'data-remote-target="terminal"' in html
    assert 'RemoteAuth.getSession()' in app
    assert "../remote/#files" in app
    assert "../remote/#python" in app
    assert "../remote/#terminal" in app


def test_remote_page_reuses_existing_shell_and_has_auth_states():
    assert REMOTE.exists()
    html = REMOTE.read_text('utf-8')
    assert '../shared/discod-shell.css' in html
    for label in ['Inicio', 'Archivos', 'Python', 'Consola']:
        assert label in html
    assert 'data-remote-login' in html
    assert 'Iniciar sesión con GitHub' in html
    assert 'data-remote-workspace' in html
    assert 'data-action="logout"' in html


def test_remote_auth_card_respects_hidden_state_after_login():
    css = STYLES.read_text('utf-8')
    assert '.remote-auth-card[hidden]{display:none}' in css


def test_remote_sidebar_stays_inside_remote_panel():
    html = REMOTE.read_text('utf-8')
    assert 'data-module="files" href="#files"' in html
    assert 'data-module="python" href="#python"' in html
    assert 'data-module="terminal" href="#terminal"' in html
    app = APP.read_text('utf-8')
    assert "window.addEventListener('hashchange'" in app
    assert "window.location.hash" in app


def test_remote_page_has_three_modes_delete_confirmation_and_results():
    html = REMOTE.read_text('utf-8')
    for mode in ['Archivos', 'Python', 'Consola']:
        assert f'>{mode}<' in html
    assert 'DELETE' in html
    assert 'data-remote-status' in html
    assert 'data-remote-result' in html
    assert 'discod-remote.yml' in html


def test_remote_app_maps_supported_operations_without_direct_github_api():
    assert APP.exists()
    text = APP.read_text('utf-8')
    for operation in ['list', 'mkdir', 'rename', 'move', 'delete', 'read-text', 'write-text', 'prepare-download', 'python-run', 'python-run-file', 'terminal-exec']:
        assert operation in text
    assert 'RemoteAuth' in text
    assert 'RemoteAPI' in text
    assert 'api.github.com' not in text


def test_remote_page_loads_only_publishable_supabase_client_configuration():
    html = REMOTE.read_text('utf-8')
    assert '../shared/supabase-config.js' in html
    assert '../shared/remote-api.js' in html
    for forbidden in ['service_role', 'github_pat_', 'ghp_', 'OPENSSH PRIVATE KEY']:
        assert forbidden not in html
