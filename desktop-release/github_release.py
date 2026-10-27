"""GitHub release transport; credentials stay in memory and are never printed."""
import argparse
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import urllib.error
import urllib.request
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent
WORK = ROOT / 'work/1.3.14'
REPO = 'yongchengjiao2-ctrl/yingce-desktop-releases'
TAG = 'desktop-v1.3.14'


def credential():
    result = subprocess.run(
        ['git', 'credential', 'fill'],
        input='protocol=https\nhost=github.com\n\n', text=True,
        capture_output=True, check=True,
        env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'},
    )
    values = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    return values['password']


def request(path, method='GET', data=None):
    url = path if path.startswith('https://') else 'https://api.github.com' + path
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Yingce-Desktop-Release',
               'Authorization': 'Bearer ' + credential(), 'X-GitHub-Api-Version': '2022-11-28'}
    if data is not None:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'GitHub {method} returned HTTP {error.code}: ' + error.read().decode()[:500]) from None


def inspect(owner):
    repos = request('/users/' + owner + '/repos?per_page=100')
    for repo in repos:
        print(json.dumps({'repo': repo['full_name'], 'default_branch': repo['default_branch'],
                          'private': repo['private']}, ensure_ascii=False), flush=True)
    for name in ['-', 'yingce-desktop-releases']:
        releases = request(f'/repos/{owner}/{name}/releases?per_page=5')
        for release in releases:
            print(json.dumps({'repo': name, 'tag': release['tag_name'], 'id': release['id'],
                              'draft': release['draft'], 'published_at': release['published_at'],
                              'assets': [{'name': a['name'], 'size': a['size']} for a in release['assets']]},
                             ensure_ascii=False), flush=True)


def prepare():
    releases = request(f'/repos/{REPO}/releases?per_page=100')
    existing = next((r for r in releases if r['tag_name'] == TAG), None)
    if existing and not existing['draft']:
        raise RuntimeError('This tag is already public; do not overwrite a published release.')
    release = existing or request(f'/repos/{REPO}/releases', 'POST', {
        'tag_name': TAG, 'name': '影策 1.3.14 · 桌面完整状态与提示词同步', 'draft': True,
        'body': '本次以 2026-10-27 实际桌面安装内容为准打包，补齐此前仅推送开发文件、未更新可安装版本的问题。\n\n包含单次非流式分镜流程、全部已安装修复、9 项后台提示词、73 项内置技能及 14 项协议注册信息。生成模块与捕获时的桌面版本逐字节一致；桌面入口仅增加一次提示词迁移及版本标识。\n\n已安装用户：菜单「影策 → 安装或更新影策」。首次安装：下载 install.cmd 和 install.ps1 至同一目录，双击 install.cmd。更新前会备份本机数据库和提示词，保留个人项目及接口密钥。新电脑须单独配置接口渠道。\n\n验证：运行文件 SHA256 比对、非流式与单次调用回归、提示词迁移回归、隔离安装与启动验证；未调用付费模型。'
    })
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / 'github-release.json').write_text(json.dumps({'id': release['id'], 'url': release['html_url']}, indent=2))
    print(json.dumps({'id': release['id'], 'draft': release['draft'], 'url': release['html_url']}), flush=True)
    return release


def upload_file(release, file):
    existing = next((a for a in release['assets'] if a['name'] == file.name), None)
    with file.open('rb') as stream:
        sha = hashlib.file_digest(stream, 'sha256').hexdigest()
    if existing:
        if existing.get('digest') == 'sha256:' + sha and existing['size'] == file.stat().st_size:
            print('Already uploaded and SHA256 verified: ' + file.name, flush=True)
            return
        raise RuntimeError('A different asset with this name already exists; inspect before replacing: ' + file.name)
    upload_url = release['upload_url'].split('{', 1)[0] + '?name=' + urllib.parse.quote(file.name)
    size = file.stat().st_size

    class ProgressReader:
        def __init__(self, stream):
            self.stream, self.sent, self.next_report = stream, 0, 0

        def read(self, length=-1):
            chunk = self.stream.read(length)
            self.sent += len(chunk)
            if self.sent >= self.next_report:
                print(f'Uploading {file.name}: {self.sent}/{size} ({self.sent * 100 / size:.1f}%)', flush=True)
                self.next_report = self.sent + 50 * 1024 * 1024
            return chunk

    headers = {'Authorization':'Bearer '+credential(), 'User-Agent':'Yingce-Desktop-Release',
               'Content-Type':'application/octet-stream','Content-Length':str(size)}
    with file.open('rb') as stream:
        req = urllib.request.Request(upload_url,data=ProgressReader(stream),headers=headers,method='POST')
        with urllib.request.urlopen(req,timeout=180) as response:
            asset = json.load(response)
    if asset['size'] != size or asset.get('digest') != 'sha256:' + sha:
        raise RuntimeError('GitHub asset digest mismatch: ' + file.name)
    print('GitHub SHA256 verified: ' + file.name, flush=True)


def upload():
    release_id = json.loads((WORK / 'github-release.json').read_text())['id']
    release = request(f'/repos/{REPO}/releases/{release_id}')
    assert release['draft'], 'Only upload to the prepared draft.'
    for name in ['Yingce-1.3.14-win-x64.zip', 'latest.json', 'install.ps1', 'install.cmd', 'instructions.md']:
        upload_file(release, WORK / name)


def publish():
    release_id = json.loads((WORK / 'github-release.json').read_text())['id']
    release = request(f'/repos/{REPO}/releases/{release_id}')
    for name in ['Yingce-1.3.14-win-x64.zip', 'latest.json', 'install.ps1', 'install.cmd', 'instructions.md']:
        file = WORK / name
        asset = next(a for a in release['assets'] if a['name'] == name)
        with file.open('rb') as stream:
            sha = hashlib.file_digest(stream,'sha256').hexdigest()
        assert asset.get('digest') == 'sha256:' + sha and asset['size'] == file.stat().st_size, name
    release = request(f'/repos/{REPO}/releases/{release_id}', 'PATCH', {'draft':False, 'make_latest':'true'})
    latest = request(f'/repos/{REPO}/releases/latest')
    assert latest['id'] == release_id
    print(json.dumps({'published':release['html_url'], 'tag':latest['tag_name'], 'assets':len(latest['assets'])}), flush=True)


def sync_release_repository():
    ref = request(f'/repos/{REPO}/git/ref/heads/main')
    parent = ref['object']['sha']
    base = request(f'/repos/{REPO}/git/commits/{parent}')
    paths = {'latest.json': WORK / 'latest.json', 'install.ps1': ROOT / 'install.ps1',
             'install.cmd': ROOT / '安装或更新.cmd', '安装或更新.cmd': ROOT / '安装或更新.cmd',
             'instructions.md': ROOT / '使用说明.md', '使用说明.md': ROOT / '使用说明.md',
             'README.md': ROOT / 'release-repository-readme.md'}
    tree = []
    for name, file in paths.items():
        blob = request(f'/repos/{REPO}/git/blobs','POST', {
            'content':base64.b64encode(file.read_bytes()).decode(),'encoding':'base64'})
        tree.append({'path':name,'mode':'100644','type':'blob','sha':blob['sha']})
    new_tree = request(f'/repos/{REPO}/git/trees','POST',{'base_tree':base['tree']['sha'],'tree':tree})
    commit = request(f'/repos/{REPO}/git/commits','POST',{
        'message':'release: publish exact desktop snapshot 1.3.14 with prompt migration',
        'tree':new_tree['sha'],'parents':[parent]})
    assert request(f'/repos/{REPO}/git/ref/heads/main')['object']['sha'] == parent, 'Remote changed during preparation'
    request(f'/repos/{REPO}/git/refs/heads/main','PATCH',{'sha':commit['sha'],'force':False})
    print(json.dumps({'repository':REPO,'commit':commit['sha']}),flush=True)


def push_workspace():
    # Git does not use Windows Internet Settings automatically; urllib does.
    env = {**os.environ, 'GIT_TERMINAL_PROMPT':'0'}
    proxy = urllib.request.getproxies().get('https')
    if proxy:
        env['HTTPS_PROXY'] = proxy
    subprocess.run(['git','push','origin','main'],cwd=ROOT.parent,env=env,check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspect', action='store_true')
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--upload', action='store_true')
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--sync-repository', action='store_true')
    parser.add_argument('--push-workspace', action='store_true')
    args = parser.parse_args()
    if args.inspect:
        inspect('yongchengjiao2-ctrl')
    if args.prepare:
        prepare()
    if args.upload:
        upload()
    if args.publish:
        publish()
    if args.sync_repository:
        sync_release_repository()
    if args.push_workspace:
        push_workspace()
