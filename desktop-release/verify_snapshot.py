"""Verify the captured runtime and offline migrations without paid model calls."""
import argparse
import hashlib
import json
import os
import pathlib
import socket
import sqlite3
import subprocess
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
STAGE = ROOT / 'work/1.3.14/payload'
VERIFY = ROOT / 'verification'
STATE = STAGE / 'backend/desktop-state'
NODE = STAGE / 'runtime/node/node.exe'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run_migration(target, force=False):
    cmd = [str(NODE), str(STATE / 'apply-state.mjs'), '--install-root', str(target)]
    if force:
        cmd.append('--force')
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()


def verify():
    VERIFY.mkdir(exist_ok=True)
    manifest = json.loads((ROOT / 'snapshot/manifest.json').read_text('utf-8'))
    prompts = json.loads((STATE / 'prompt-templates.json').read_text('utf-8'))
    home = pathlib.Path(os.environ['LOCALAPPDATA']) / 'YingceCanvas'
    source = home / 'versions' / manifest['sourceDesktopVersion']
    for entry in manifest['runtimeFiles']:
        assert sha(source / entry['path']) == entry['sha256'], entry['path']
        expected = manifest['packagingAdapter']['publishedSha256'] if entry['path'] == 'app/resources/app.asar' else entry['sha256']
        assert sha(STAGE / entry['path']) == expected, entry['path']
    source_db = sqlite3.connect((home / 'data/open_ai_canvas.db').as_uri() + '?mode=ro', uri=True)
    for prompt in prompts:
        assert source_db.execute('SELECT content FROM prompt_templates WHERE id=?', (prompt['id'],)).fetchone()[0] == prompt['content']
    source_db.close()
    print(f'Runtime comparison passed: {len(manifest["runtimeFiles"])} files, only documented packaging bootstrap differs.', flush=True)

    target = VERIFY / ('fresh-' + str(time.time_ns()))
    run_migration(target)
    db_path = target / 'data/open_ai_canvas.db'
    db = sqlite3.connect(db_path)
    for prompt in prompts:
        assert db.execute('SELECT content,enabled FROM prompt_templates WHERE id=?', (prompt['id'],)).fetchone() == (prompt['content'], prompt['enabled'])
    assert db.execute('SELECT count(*) FROM skills').fetchone()[0] == 73
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    db.execute("INSERT INTO users (id,status) VALUES ('release-local-test','active')")
    db.execute("INSERT INTO system_settings (key,value_json) VALUES ('release-preservation-test','{\"privateKey\":\"TEST-SENTINEL-NOT-A-REAL-KEY\"}')")
    db.execute('UPDATE prompt_templates SET content=? WHERE id=?', ('edited-after-update', prompts[0]['id']))
    db.commit()
    db.close()
    run_migration(target)
    db = sqlite3.connect(db_path)
    assert db.execute('SELECT content FROM prompt_templates WHERE id=?', (prompts[0]['id'],)).fetchone()[0] == 'edited-after-update'
    db.close()
    registry_path = target / 'data/plugin_registry.json'
    registry = json.loads(registry_path.read_text('utf-8'))
    registry.append({'id':'local-preservation-sentinel','manifest':{'id':'local-preservation-sentinel'}})
    registry_path.write_text(json.dumps(registry), 'utf-8')
    run_migration(target, force=True)
    db = sqlite3.connect(db_path)
    for prompt in prompts:
        assert db.execute('SELECT content FROM prompt_templates WHERE id=?', (prompt['id'],)).fetchone()[0] == prompt['content']
    assert 'TEST-SENTINEL' in db.execute("SELECT value_json FROM system_settings WHERE key='release-preservation-test'").fetchone()[0]
    assert db.execute("SELECT count(*) FROM users WHERE id='release-local-test'").fetchone()[0] == 1
    assert db.execute('SELECT count(*) FROM user_skill_states').fetchone()[0] > 0
    db.close()
    assert any(p['id']=='local-preservation-sentinel' for p in json.loads(registry_path.read_text('utf-8')))
    backups = list((target / 'data/backups').rglob('database.db'))
    assert backups
    backup = sqlite3.connect(backups[-1])
    assert backup.execute('SELECT content FROM prompt_templates WHERE id=?', (prompts[0]['id'],)).fetchone()[0] == 'edited-after-update'
    backup.close()
    print('Migration passed: exact prompts, builtin skills, backup, idempotency, explicit reapply, personal settings preservation.', flush=True)

    # Actual bundled backend must accept the fresh migrated schema and retain templates.
    fresh = VERIFY / ('backend-' + str(time.time_ns()))
    run_migration(fresh)
    sock = socket.socket()
    sock.bind(('127.0.0.1',0))
    port = sock.getsockname()[1]
    sock.close()
    env = {**os.environ,'GIN_MODE':'release','CANVAS_DESKTOP_MODE':'1',
           'CANVAS_DESKTOP_TOKEN':'7'*64,
           'CANVAS_BACKEND_ADDR':f'127.0.0.1:{port}',
           'CANVAS_BACKEND_DATA_DIR':str(fresh / 'data'),
           'CANVAS_PI_RUNTIME_DIR':str(STAGE / 'backend/agent-runtime/pi'),
           'CANVAS_REGISTRATION_ENABLED':'false','CANVAS_CORS_ORIGINS':f'http://127.0.0.1:{port}',
           'PATH':str(NODE.parent)+os.pathsep+os.environ['PATH']}
    with (fresh / 'backend.log').open('wb') as log:
        proc = subprocess.Popen([str(STAGE / 'runtime/canvas-backend.exe')], cwd=STAGE, env=env,
                                stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            for _ in range(90):
                if proc.poll() is not None:
                    raise RuntimeError('Isolated backend exited. See verification backend.log')
                try:
                    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/health',headers={'X-Canvas-Desktop-Token':'7'*64})
                    with urllib.request.urlopen(req,timeout=2) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.5)
            else:
                raise RuntimeError('Isolated backend startup timeout')
            req = urllib.request.Request(f'http://127.0.0.1:{port}/api/auth/session',headers={'X-Canvas-Desktop-Token':'7'*64})
            with urllib.request.urlopen(req,timeout=5) as response:
                session = json.load(response)
            assert session['code'] == 0
            db = sqlite3.connect(fresh / 'data/open_ai_canvas.db')
            for prompt in prompts:
                actual = db.execute('SELECT content FROM prompt_templates WHERE operation=? AND enabled=1', (prompt['operation'],)).fetchall()
                assert actual == [(prompt['content'],)], prompt['operation']
            assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            assert db.execute('SELECT count(*) FROM yingce_extraction_observations').fetchone()[0] == 0
            for selected in json.loads((STATE / 'database-state.json').read_text('utf-8'))['selectedSkills']:
                assert db.execute('SELECT count(*) FROM user_skill_states WHERE skill_id=? AND added=?',(selected['skill_id'],selected['added'])).fetchone()[0] >= 1
            db.close()
        finally:
            proc.terminate()
            proc.wait(timeout=15)
    print('Bundled backend startup, desktop session, schema and all 9 active templates passed.', flush=True)
    report = {'runtimeFilesVerified':len(manifest['runtimeFiles']),'promptTemplatesVerified':len(prompts),
              'migrations':['fresh','backup','preserve-settings','idempotency','force-reapply'],
              'isolatedBackendHealth':True,'isolatedDesktopSession':True,
              'paidModelRequests':0,'capturedDesktopUntouched':True}
    (ROOT / 'snapshot/verification.json').write_text(json.dumps(report,indent=2)+'\n','utf-8')


if __name__ == '__main__':
    verify()
