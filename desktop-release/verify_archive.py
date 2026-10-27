"""Validate the exact ZIP bytes that will be uploaded, including legacy paths."""
import hashlib
import json
import pathlib
import struct
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
WORK = ROOT / 'work/1.3.14'
manifest = json.loads((WORK / 'latest.json').read_text('utf-8'))
archive = WORK / manifest['archive']
with archive.open('rb') as stream:
    assert hashlib.file_digest(stream,'sha256').hexdigest() == manifest['archiveSha256']
expected = {e['path']:e for e in manifest['files']}
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist()) == set(expected)
    for i, entry in enumerate(z.infolist()):
        parts = pathlib.PurePosixPath(entry.filename).parts
        assert '..' not in parts and not entry.filename.startswith('/')
        assert parts[0] in ['app','backend','runtime','web','plugin-packages'] or entry.filename in ['release.json','install.ps1','安装或更新.cmd','update.cmd','使用说明.md'], entry.filename
        assert entry.file_size == expected[entry.filename]['size']
        with z.open(entry) as stream:
            assert hashlib.file_digest(stream,'sha256').hexdigest() == expected[entry.filename]['sha256'], entry.filename
        if i % 10000 == 0:
            print(f'ZIP verification {i}/{len(expected)}',flush=True)
    for name in ['apply-state.mjs','prompt-templates.json','database-state.json','plugin-registry.json']:
        source = ROOT / 'apply-state.mjs' if name == 'apply-state.mjs' else ROOT / 'snapshot/portable-state' / name
        assert z.read('backend/desktop-state/'+name) == source.read_bytes()
    assert z.read('install.ps1').startswith(b'\xef\xbb\xbf')
    assert 'web/dist/assets/extraction-live-test-input.json' not in z.namelist()
    # Parse the repacked Electron archive and check the startup hook syntax.
    asar = z.read('app/resources/app.asar')
    header_size = struct.unpack_from('<I',asar,4)[0]
    json_size = struct.unpack_from('<I',asar,12)[0]
    tree = json.loads(asar[16:16+json_size])
    content_start = 8+header_size
    def entry_bytes(name):
        entry=tree['files'][name]
        start=content_start+int(entry['offset'])
        return asar[start:start+entry['size']]
    main=entry_bytes('main.cjs')
    assert b"'backend','desktop-state','apply-state.mjs'" in main
    assert json.loads(entry_bytes('package.json'))['version'] == manifest['version']
    subprocess.run([str(WORK/'payload/runtime/node/node.exe'),'--check','--input-type=commonjs'],input=main,check=True,capture_output=True)
report = {'archive':archive.name,'archiveSha256':manifest['archiveSha256'],
          'archiveBytes':archive.stat().st_size,'verifiedZipEntries':len(expected),
          'legacyInstallerPathsCompatible':True,'promptAndMigrationSourceMatchesArchive':True}
(ROOT / 'snapshot/archive-verification.json').write_text(json.dumps(report,indent=2)+'\n','utf-8')
print(json.dumps(report),flush=True)
