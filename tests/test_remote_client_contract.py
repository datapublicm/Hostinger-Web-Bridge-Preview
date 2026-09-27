from pathlib import Path


CONFIG = Path('shared/supabase-config.js')
CLIENT = Path('shared/remote-api.js')


def test_supabase_config_contains_only_publishable_client_values():
    assert CONFIG.exists()
    text = CONFIG.read_text('utf-8')
    assert 'jasuqnxrskhqfobsazwd.supabase.co' in text
    assert 'sb_publishable_' in text
    for forbidden in ['service_role', 'github_pat_', 'ghp_', 'OPENSSH PRIVATE KEY', 'CALLBACK_SECRET']:
        assert forbidden not in text


def test_remote_client_exposes_auth_and_api_contracts():
    assert CLIENT.exists()
    text = CLIENT.read_text('utf-8')
    for name in ['signInWithGitHub', 'signOut', 'getSession', 'dispatch', 'getJob', 'waitForJob']:
        assert name in text
    assert 'web_hostinger_bridge_remote' in text
    assert 'Authorization' in text
    assert 'Bearer' in text


def test_remote_client_has_bounded_polling_and_distinct_auth_errors():
    assert CLIENT.exists()
    text = CLIENT.read_text('utf-8')
    assert 'timeoutMs' in text
    assert 'intervalMs' in text
    assert '401' in text
    assert '403' in text
    assert 'setTimeout' in text


def test_remote_client_never_calls_private_github_api_directly():
    assert CLIENT.exists()
    text = CLIENT.read_text('utf-8')
    assert 'api.github.com' not in text
    assert 'github_pat_' not in text
    assert 'ghp_' not in text
