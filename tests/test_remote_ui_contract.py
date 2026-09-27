from pathlib import Path


PORTAL = Path('portal/index.html')
PORTAL_APP = Path('portal/app.js')
REMOTE = Path('remote/index.html')
REMOTE_APP = Path('remote/app.js')
FILES = Path('files/index.html')
FILES_LOADER = Path('files/public-loader.js')
FILES_REMOTE = Path('files/remote-app.js')
PYTHON = Path('python/index.html')
PYTHON_APP = Path('python/app.js')
TERMINAL = Path('terminal/index.html')
TERMINAL_APP = Path('terminal/app.js')


def test_portal_keeps_original_module_routes_and_remote_login():
    html = PORTAL.read_text('utf-8')
    app = PORTAL_APP.read_text('utf-8')
    assert 'Acceso directo al Bridge' in html
    assert 'GitHub Remote' in html
    assert 'href="../files/"' in html
    assert 'href="../python/"' in html
    assert 'href="../terminal/"' in html
    assert '../remote/#files' not in app
    assert '../remote/#python' not in app
    assert '../remote/#terminal' not in app


def test_files_keeps_original_table_and_can_boot_remote_backend():
    html = FILES.read_text('utf-8')
    loader = FILES_LOADER.read_text('utf-8')
    assert 'Administrador de archivos' in html
    for label in ['Nueva carpeta', 'Nuevo archivo', 'Subir', 'Descargar', 'Mover']:
        assert label in html
    assert 'data-file-rows' in html
    assert '../shared/supabase-config.js' in html
    assert '../shared/remote-api.js' in html
    assert 'RemoteAuth.getSession()' in loader
    assert './remote-app.js' in loader


def test_files_remote_app_uses_original_table_contract_and_remote_operations():
    assert FILES_REMOTE.exists()
    text = FILES_REMOTE.read_text('utf-8')
    for selector in ['data-file-rows', 'data-files-empty', 'data-breadcrumb', 'data-item-count']:
        assert selector in text
    for operation in ['list', 'mkdir', 'rename', 'move', 'delete', 'write-text', 'prepare-download']:
        assert operation in text
    assert 'RemoteAPI.dispatch' in text
    assert 'api.github.com' not in text


def test_python_keeps_editor_output_and_remote_file_browser():
    html = PYTHON.read_text('utf-8')
    app = PYTHON_APP.read_text('utf-8')
    assert 'Editor de Python' in html
    assert 'python-workspace' in html
    assert 'python-output' in html
    assert 'data-python-code' in html
    assert 'data-action="save-python"' in html
    assert '../shared/supabase-config.js' in html
    assert '../shared/remote-api.js' in html
    assert 'RemoteAuth.getSession()' in app
    for operation in ['list', 'read-text', 'write-text', 'python-run', 'python-run-file']:
        assert operation in app
    assert "'Python'" in app
    assert '.py' in app
    assert '.ipynb' in app


def test_terminal_keeps_black_console_and_can_use_remote_exec():
    html = TERMINAL.read_text('utf-8')
    app = TERMINAL_APP.read_text('utf-8')
    styles = Path('terminal/styles.css').read_text('utf-8')
    assert 'Consola remota' in html
    assert 'terminal-panel' in html
    assert '#101923' in styles
    assert '../shared/supabase-config.js' in html
    assert '../shared/remote-api.js' in html
    assert 'RemoteAuth.getSession()' in app
    assert "operation: 'terminal-exec'" in app
    assert 'RemoteAPI.dispatch' in app


def test_remote_page_is_auth_gateway_not_replacement_workspace():
    html = REMOTE.read_text('utf-8')
    app = REMOTE_APP.read_text('utf-8')
    assert 'Iniciar sesión con GitHub' in html
    assert 'data-remote-login' in html
    assert "window.location.replace('../portal/')" in app
    assert 'data-files-form' not in html
    assert 'data-python-form' not in html
    assert 'data-terminal-form' not in html


def test_public_pages_do_not_embed_private_secrets():
    for path in [PORTAL, REMOTE, FILES, PYTHON, TERMINAL, FILES_LOADER, PYTHON_APP, TERMINAL_APP]:
        text = path.read_text('utf-8')
        for forbidden in ['service_role', 'github_pat_', 'ghp_', 'OPENSSH PRIVATE KEY']:
            assert forbidden not in text
