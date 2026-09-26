from pathlib import Path


def test_portal_exposes_github_remote_without_embedding_secrets():
    html = Path('portal/index.html').read_text(encoding='utf-8')
    app = Path('portal/app.js').read_text(encoding='utf-8')

    assert 'GitHub Remote' in html
    assert 'github.com/datapublicm/Hostinger-Web-Bridge/actions/workflows/discod-remote.yml' in html
    assert 'DISCOD_REMOTE_SSH_KEY' not in html
    assert 'ghp_' not in html
    assert 'github_pat_' not in html
    assert 'api.github.com' not in app
