"""Read-only export of the actual installed workflow package for runtime QA."""
import hashlib
import json
import os
from pathlib import Path
import zipfile

out = Path(__file__).resolve().parent
package = Path(os.environ['LOCALAPPDATA']) / 'YingceCanvas/data/skill-packages/yingce-short-drama-workflow/ef8f38981fa8538e90d8fa055680b44e.zip'
previous = json.loads((out / 'repair-live-storyboard-real-skill-package.json').read_text('utf8'))
data = {key: previous[key] for key in ['id', 'name', 'version_id', 'version_label', 'package_key']}
data.update(zip_path=str(package), zip_sha256=hashlib.sha256(package.read_bytes()).hexdigest(), files={})
with zipfile.ZipFile(package) as archive:
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        raw = archive.read(entry)
        data['files'][entry.filename] = {'content': raw.decode('utf-8-sig'), 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
(out / 'F16-真实ZIP文件.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')
print('Read-only ZIP export:', len(data['files']), 'files', sum(len(f['content']) for f in data['files'].values()), 'characters')
