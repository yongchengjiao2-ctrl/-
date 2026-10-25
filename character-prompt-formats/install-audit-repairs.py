"""Install only explicit, hash-checked audit repair modules; never touches a database.

Examples (check/build do not modify the application):
  python install-audit-repairs.py --check --files shot-asset-bindings.js
  python install-audit-repairs.py --build --source-dir build/audit-final --files a.js b.js --allow-create b.js
  python install-audit-repairs.py --verify-manifest build/audit-repairs/<stamp>/manifest.json

An existing installed module must exactly match its installed entry in the chosen
baseline. An absent module can be created only with explicit --allow-create.
Every target is a single .js filename directly under --target-dir. Apply uses
per-file atomic replacements plus guarded rollback, not a multi-file transaction.
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent
DEFAULT_BASELINE = ROOT.parent / '影策审计-20261025' / 'repair-baseline-path.txt'
DEFAULT_TARGET = pathlib.Path(os.environ.get('LOCALAPPDATA', '')) / 'YingceCanvas/versions/1.3.13/web/dist/assets'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    return digest(path.read_bytes()) if path.is_file() else None


def resolve_baseline(value):
    path = pathlib.Path(value).resolve()
    if path.is_file() and path.suffix.lower() == '.txt':
        path = pathlib.Path(path.read_text(encoding='utf-8-sig').strip()).resolve()
    if path.is_dir():
        path = path / 'manifest.json'
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(data, list):
        raise ValueError('Baseline manifest must be an array of path/backup/sha256 entries')
    return path, data


def safe_name(value):
    # No traversal, drives, nested paths, ADS, shell metacharacters, or device names.
    if not re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js', value):
        raise ValueError(f'Expected one plain .js filename, got {value!r}')
    if value.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)), *(f'LPT{i}' for i in range(1, 10))}:
        raise ValueError(f'Windows device name is not allowed: {value}')
    return value


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--check', action='store_true', help='Validate baseline, syntax and dependencies; no app changes')
    modes.add_argument('--build', action='store_true', help='Write validated review bundle; no app changes')
    modes.add_argument('--install', action='store_true', help='Back up then apply explicit modules after all checks')
    modes.add_argument('--verify-manifest', type=pathlib.Path, help='Verify installed hashes against an emitted manifest')
    parser.add_argument('--baseline', default=str(DEFAULT_BASELINE), help='Baseline manifest, folder, or pointer .txt')
    parser.add_argument('--source-dir', type=pathlib.Path, default=ROOT / 'src')
    parser.add_argument('--target-dir', type=pathlib.Path, default=DEFAULT_TARGET)
    parser.add_argument('--files', nargs='+', default=[], help='Exact module filenames; never inferred')
    parser.add_argument('--allow-create', nargs='*', default=[], help='Explicit filenames allowed only when absent from installation and baseline')
    parser.add_argument('--output-dir', type=pathlib.Path, help='New bundle directory (must not exist)')
    parser.add_argument('--node', default='node', help='Node executable for syntax checks')
    return parser.parse_args()


def verify_manifest(path):
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    files = data.get('files')
    if not isinstance(files, list) or not files:
        raise ValueError('Repair manifest has no files')
    results = []
    for entry in files:
        target = pathlib.Path(entry['target'])
        actual = file_hash(target)
        results.append({'name': entry['name'], 'target': str(target), 'expected': entry['afterSha256'], 'actual': actual, 'ok': actual == entry['afterSha256']})
    print(json.dumps({'operation': 'verify', 'ok': all(r['ok'] for r in results), 'files': results}, ensure_ascii=False, indent=2))
    return 0 if all(r['ok'] for r in results) else 2


def preflight(args):
    source_dir, target_dir = args.source_dir.resolve(), args.target_dir.resolve()
    if not source_dir.is_dir() or not target_dir.is_dir():
        raise ValueError('Source and target directories must exist')
    if source_dir == target_dir:
        raise ValueError('Source directory must be distinct from installation')
    names = [safe_name(n) for n in args.files]
    if not names or len(set(names)) != len(names):
        raise ValueError('--files must explicitly list distinct module filenames')
    creates = {safe_name(n) for n in args.allow_create}
    if not creates.issubset(names):
        raise ValueError('--allow-create entries must also occur in --files')
    baseline_path, entries = resolve_baseline(args.baseline)
    baseline = {}
    for row in entries:
        path = pathlib.Path(row['path']).resolve()
        if path.parent == target_dir:
            if path.name in baseline:
                raise ValueError(f'Duplicate installed baseline entry for {path.name}')
            baseline[path.name] = row
    plan = []
    for name in names:
        source, target = source_dir / name, target_dir / name
        if source.is_symlink() or target.is_symlink() or source.resolve().parent != source_dir or target.resolve().parent != target_dir:
            raise ValueError(f'Symlink or path escape refused: {name}')
        if not source.is_file():
            raise ValueError(f'Explicit source does not exist: {source}')
        content = source.read_bytes()
        before = file_hash(target)
        row = baseline.get(name)
        if row:
            if not isinstance(row.get('sha256'), str) or before != row['sha256']:
                raise ValueError(f'Installed module changed since baseline: {name}. Refused to overwrite another edit; review changes and create a fresh baseline.')
            backup = pathlib.Path(row['backup'])
            if file_hash(backup) != row['sha256']:
                raise ValueError(f'Baseline backup hash mismatch: {name}')
        elif before is not None:
            raise ValueError(f'Existing installed module has no baseline: {name}. Review it and create a fresh baseline.')
        elif name not in creates:
            raise ValueError(f'New module needs explicit --allow-create: {name}')
        if name in creates and row:
            raise ValueError(f'--allow-create cannot bypass an existing baseline: {name}')
        # Force ESM even when the staging directory has no package.json. Node's
        # ambiguous .js detection must not skip a malformed export declaration.
        result = subprocess.run([args.node, '--input-type=module', '--check'], input=content.decode('utf-8-sig'), capture_output=True, text=True, encoding='utf-8', errors='replace')
        if result.returncode:
            raise ValueError(f'Syntax check failed for {name}: {result.stderr.strip()}')
        plan.append({'name': name, 'source': str(source), 'target': str(target), 'beforeSha256': before, 'afterSha256': digest(content), 'create': row is None, 'syntaxChecked': True})
    planned = set(names)
    # Validate actual relative JS imports, not arbitrary language-token strings.
    for item in plan:
        text = pathlib.Path(item['source']).read_text(encoding='utf-8-sig')
        imports = re.findall(r'(?:from\s*|import\s*\()(["\x27`])(\./[^"\x27`]+\.js(?:\?[^"\x27`]+)?)\1', text)
        for _, value in imports:
            name = value[2:].split('?', 1)[0]
            if '/' in name or '\\' in name:
                dependency = (target_dir / name).resolve()
                if not dependency.is_relative_to(target_dir) or not dependency.is_file():
                    raise ValueError(f'Unresolved or escaped import {value} in {item["name"]}')
            elif name not in planned and not (target_dir / name).is_file():
                raise ValueError(f'Unresolved import {value} in {item["name"]}; add its source to --files')
    manifest = {'schemaVersion': 1, 'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'baseline': str(baseline_path), 'sourceDir': str(source_dir), 'targetDir': str(target_dir), 'files': plan, 'databaseModified': False, 'atomicity': 'per-file replacement, guarded rollback on failure; application should reload only after success'}
    return manifest


def write_bundle(args, manifest):
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    folder = (args.output_dir or ROOT / 'build/audit-repairs' / stamp).resolve()
    target = pathlib.Path(manifest['targetDir'])
    if folder == target or folder.is_relative_to(target):
        raise ValueError('Build output cannot be inside installation')
    folder.mkdir(parents=True, exist_ok=False)
    stage = folder / 'files'; stage.mkdir()
    for item in manifest['files']:
        content = pathlib.Path(item['source']).read_bytes()
        if digest(content) != item['afterSha256']:
            raise ValueError(f'Source changed during build: {item["name"]}; rerun for a reviewable bundle')
        (stage / item['name']).write_bytes(content)
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return folder


def atomic_write(target, content):
    handle, temp = tempfile.mkstemp(prefix='.audit-repair-', suffix='.tmp', dir=target.parent)
    try:
        with os.fdopen(handle, 'wb') as stream:
            stream.write(content); stream.flush(); os.fsync(stream.fileno())
        os.replace(temp, target)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def apply_bundle(folder, manifest):
    entries = manifest['files']
    # Recheck every file before any backup or mutation, then immediately before each replacement.
    for item in entries:
        if file_hash(pathlib.Path(item['target'])) != item['beforeSha256']:
            raise ValueError(f'Installed file changed after check: {item["name"]}; application not modified')
    backup_dir = folder / 'backups'; backup_dir.mkdir()
    for item in entries:
        target = pathlib.Path(item['target'])
        if not item['create']:
            shutil.copy2(target, backup_dir / item['name'])
            if file_hash(backup_dir / item['name']) != item['beforeSha256']:
                raise ValueError(f'Concurrent change while backing up {item["name"]}; application not modified')
    changed = []
    try:
        for item in entries:
            target = pathlib.Path(item['target']); payload = (folder / 'files' / item['name']).read_bytes()
            if file_hash(target) != item['beforeSha256'] or digest(payload) != item['afterSha256']:
                raise ValueError(f'Concurrent installed/staged change: {item["name"]}')
            atomic_write(target, payload); changed.append(item)
            if file_hash(target) != item['afterSha256']:
                raise ValueError(f'Installed verification failed: {item["name"]}')
    except Exception:
        rollback = []
        for item in reversed(changed):
            target = pathlib.Path(item['target'])
            if file_hash(target) != item['afterSha256']:
                rollback.append({'name': item['name'], 'restored': False, 'reason': 'Concurrent edit; preserved rather than overwrote it'})
                continue
            if item['create']:
                target.unlink()
            else:
                atomic_write(target, (backup_dir / item['name']).read_bytes())
            rollback.append({'name': item['name'], 'restored': True})
        (folder / 'rollback.json').write_text(json.dumps(rollback, ensure_ascii=False, indent=2), encoding='utf-8')
        raise
    manifest['installedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    manifest['backupDir'] = str(backup_dir)
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    args = parse_args()
    if args.verify_manifest:
        return verify_manifest(args.verify_manifest.resolve())
    manifest = preflight(args)
    if args.check:
        print(json.dumps({'operation': 'check', 'ok': True, 'manifest': manifest}, ensure_ascii=False, indent=2))
        return 0
    folder = write_bundle(args, manifest)
    if args.install:
        apply_bundle(folder, manifest)
    print(json.dumps({'operation': 'install' if args.install else 'build', 'ok': True, 'bundle': str(folder), 'manifest': str(folder / 'manifest.json'), 'applicationModified': args.install, 'databaseModified': False}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error), 'instruction': 'Review current files and baseline; do not rerun historical installers to force an overwrite.'}, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(2)
