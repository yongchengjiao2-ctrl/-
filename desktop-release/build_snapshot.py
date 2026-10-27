"""Capture the installed application, not a potentially different source tree."""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import sqlite3
import struct
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
HOME = pathlib.Path(os.environ['LOCALAPPDATA']) / 'YingceCanvas'
VERSION = '1.3.14'


def adapt_desktop_bootstrap(archive):
    """Keep generation modules byte-identical; add only state migration before startup.

    This also supports the already-installed v1 installer, which can copy a new
    package but cannot run its prompt migration itself.
    """
    raw = archive.read_bytes()
    header_length = struct.unpack_from('<I', raw, 4)[0]
    json_length = struct.unpack_from('<I', raw, 12)[0]
    tree = json.loads(raw[16:16 + json_length])
    offset = 8 + header_length
    chunks = []
    changed = []
    next_offset = 0

    def walk(directory, base=''):
        nonlocal next_offset
        for name, entry in directory['files'].items():
            rel = base + name
            if 'files' in entry:
                walk(entry, rel + '/')
                continue
            assert 'offset' in entry and not entry.get('unpacked'), rel
            start = offset + int(entry['offset'])
            data = raw[start:start + entry['size']]
            if rel == 'main.cjs':
                text = data.decode('utf-8')
                anchor = "if (portable) process.env.PATH = path.join(runtime,'node')+path.delimiter+process.env.PATH;"
                assert text.count(anchor) == 1
                hook = "\n// Install the captured prompt/protocol state once before the backend opens its DB.\nif (portable) require('child_process').execFileSync(path.join(runtime,'node','node.exe'), [path.join(root,'backend','desktop-state','apply-state.mjs'), '--install-root', local], {cwd:root, windowsHide:true, stdio:'pipe'});"
                data = text.replace(anchor, anchor + hook).encode('utf-8')
                changed.append(rel)
            elif rel == 'package.json':
                pkg = json.loads(data)
                pkg['version'] = VERSION
                data = (json.dumps(pkg, ensure_ascii=False, indent=2) + '\n').encode()
                changed.append(rel)
            entry['offset'] = str(next_offset)
            entry['size'] = len(data)
            if 'integrity' in entry:
                block_size = entry['integrity'].get('blockSize', 4194304)
                entry['integrity'] = {'algorithm': 'SHA256', 'hash': hashlib.sha256(data).hexdigest(),
                                      'blockSize': block_size, 'blocks': [hashlib.sha256(data[i:i+block_size]).hexdigest() for i in range(0, len(data), block_size)]}
            chunks.append(data)
            next_offset += len(data)

    walk(tree)
    encoded = json.dumps(tree, separators=(',', ':'), ensure_ascii=False).encode()
    padded = encoded + b'\0' * (-len(encoded) % 4)
    header = struct.pack('<II', 4 + len(padded), len(encoded)) + padded
    archive.write_bytes(struct.pack('<II', 4, len(header)) + header + b''.join(chunks))
    return {'path': 'app/resources/app.asar', 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'publishedSha256': digest(archive), 'changedEntries': changed,
            'reason': 'One-time prompt/protocol migration and displayed release version; generation code unchanged.'}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def rows(db, table, columns=None):
    fields = '*' if columns is None else ','.join(columns)
    return [dict(r) for r in db.execute(f'SELECT {fields} FROM "{table}"')]


def capture():
    source_version = (HOME / 'current.txt').read_text().strip()
    source = HOME / 'versions' / source_version
    work = ROOT / 'work' / VERSION
    stage = work / 'payload'
    if stage.exists():
        raise RuntimeError('Use a new staging directory; existing capture will not be overwritten.')
    state = ROOT / 'snapshot' / 'portable-state'
    state.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect((HOME / 'data/open_ai_canvas.db').as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    db.execute('BEGIN')
    prompts = rows(db, 'prompt_templates', ['id', 'operation', 'name', 'version', 'content',
                                           'output_type', 'enabled', 'created_at', 'updated_at'])
    write_json(state / 'prompt-templates.json', prompts)
    schemas = [dict(r) for r in db.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, name")]
    tables = {table: rows(db, table) for table in ['skills', 'skill_versions', 'skill_files',
               'skill_curation_settings', 'skill_curation_categories', 'skill_curation_assignments',
               'skill_curation_roots', 'skill_curation_root_assignments']}
    if any(r['source_type'] != 'builtin' for r in tables['skills']):
        raise RuntimeError('Non-builtin skills require explicit selection before publication.')
    # No user IDs, login data, channels, credentials, projects or task history are exported.
    for skill in tables['skills']:
        skill['owner_id'] = ''
    selected_skills = rows(db, 'user_skill_states', ['skill_id', 'installed_version_id', 'auto_update', 'added', 'liked'])
    write_json(state / 'database-state.json', {'schemaVersion': 1, 'schema': schemas,
               'tables': tables, 'selectedSkills': selected_skills})
    db.rollback()
    db.close()
    registry = json.loads((HOME / 'data/plugin_registry.json').read_text('utf-8-sig'))
    write_json(state / 'plugin-registry.json', registry)
    for entry in registry:
        if entry.get('packagePath'):
            path = HOME / 'data/plugin-packages' / entry['packagePath']
            assert path.is_file() and digest(path) == entry['packageSha256'], entry['id']
    print(f'Captured {len(prompts)} exact prompt templates, {len(tables["skills"])} builtin skills, {len(registry)} protocol registrations.', flush=True)

    baseline_url = 'https://github.com/yongchengjiao2-ctrl/yingce-desktop-releases/releases/download/desktop-v1.3.13/latest.json'
    with urllib.request.urlopen(baseline_url, timeout=90) as response:
        baseline = json.load(response)
    baseline_files = {f['path'].replace('\\', '/'): f['sha256'].lower() for f in baseline['files']}
    excluded = ['web/dist/assets/extraction-live-test-input.json']
    inventory, changed = [], []
    for part in ['app', 'backend', 'runtime', 'web', 'plugin-packages']:
        print('Capturing ' + part, flush=True)
        for path in sorted((source / part).rglob('*')):
            if not path.is_file():
                continue
            rel = path.relative_to(source).as_posix()
            if rel in excluded:
                continue
            target = stage / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            sha = digest(target)
            assert digest(path) == sha, 'Installed file changed while capturing: ' + rel
            entry = {'path': rel, 'size': target.stat().st_size, 'sha256': sha}
            inventory.append(entry)
            if baseline_files.get(rel) != sha:
                changed.append(entry)
                if path.suffix in ['.js', '.mjs', '.cjs', '.json', '.css', '.html', '.txt', '.md']:
                    copy = ROOT / 'snapshot' / 'files' / rel
                    copy.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(target, copy)

    for entry in registry:
        if not entry.get('packagePath'):
            continue
        src = HOME / 'data/plugin-packages' / entry['packagePath']
        dest = stage / 'backend/desktop-state/plugin-packages' / entry['packagePath']
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    shutil.copytree(HOME / 'data/skill-packages', stage / 'backend/desktop-state/skill-packages')
    for path in state.iterdir():
        if path.is_file():
            shutil.copy2(path, stage / 'backend/desktop-state' / path.name)
    shutil.copy2(ROOT / 'apply-state.mjs', stage / 'backend/desktop-state/apply-state.mjs')
    adapter = adapt_desktop_bootstrap(stage / 'app/resources/app.asar')
    write_json(stage / 'release.json', {'version': VERSION, 'portable': True, 'capturedFrom': source_version})
    for name in ['install.ps1', '安装或更新.cmd', 'update.cmd', '使用说明.md']:
        shutil.copy2(ROOT / name, stage / name)
    snapshot = {'releaseVersion': VERSION, 'sourceDesktopVersion': source_version,
                'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'baselineRelease': baseline['version'], 'packagingAdapter': adapter, 'runtimeFileCount': len(inventory),
                'runtimeBytes': sum(e['size'] for e in inventory), 'changedFromPublished': changed,
                'excludedNonRuntimeTestInputs': excluded, 'runtimeFiles': inventory,
                'templates': [{'id': p['id'], 'operation': p['operation'], 'name': p['name'],
                               'sha256': hashlib.sha256(p['content'].encode()).hexdigest()} for p in prompts]}
    write_json(ROOT / 'snapshot/manifest.json', snapshot)
    write_json(stage / 'backend/desktop-state/desktop-snapshot.json', snapshot)
    print(json.dumps({'runtimeFiles': len(inventory), 'changedFiles': len(changed),
                      'bytes': snapshot['runtimeBytes'], 'stage': str(stage)}, ensure_ascii=False), flush=True)
    return stage


def package(stage):
    work = stage.parent
    archive = work / f'Yingce-{VERSION}-win-x64.zip'
    files = []
    for p in sorted(stage.rglob('*')):
        if p.is_file():
            files.append({'path': p.relative_to(stage).as_posix(), 'size': p.stat().st_size, 'sha256': digest(p)})
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=4) as out:
        for i, entry in enumerate(files):
            out.write(stage / entry['path'], entry['path'])
            if i % 5000 == 0:
                print(f'Packaging {i}/{len(files)}', flush=True)
    manifest = {'version': VERSION, 'files': files, 'archive': archive.name,
                'archiveSha256': digest(archive), 'portableState': 'backend/desktop-state/apply-state.mjs',
                'requiresInstallerVersion': 1}
    write_json(work / 'latest.json', manifest)
    for name, src in [('install.ps1', ROOT / 'install.ps1'), ('install.cmd', ROOT / '安装或更新.cmd'),
                      ('instructions.md', ROOT / '使用说明.md')]:
        shutil.copy2(src, work / name)
    print(json.dumps({'archive': str(archive), 'size': archive.stat().st_size,
                      'sha256': manifest['archiveSha256'], 'files': len(files)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--capture', action='store_true')
    parser.add_argument('--package', action='store_true')
    args = parser.parse_args()
    stage = capture() if args.capture else ROOT / 'work' / VERSION / 'payload'
    if args.package:
        package(stage)
