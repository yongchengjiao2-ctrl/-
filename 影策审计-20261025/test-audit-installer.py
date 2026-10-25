"""Check/build safety regression only. Never calls --install or changes Yingce."""
import pathlib, tempfile, subprocess, hashlib, json, sys, unittest, shutil

ROOT=pathlib.Path(__file__).resolve().parent
SCRIPT=ROOT.parent/'character-prompt-formats/install-audit-repairs.py'

class InstallerChecks(unittest.TestCase):
 def setUp(self):
  self.root=pathlib.Path(tempfile.mkdtemp(prefix='audit-installer-',dir=ROOT)).resolve()
  assert self.root.parent==ROOT.resolve()
  self.source=self.root/'source';self.target=self.root/'target';self.backup=self.root/'backup'
  for p in [self.source,self.target,self.backup]:p.mkdir()
  self.old=b'export const value=1;\n';self.new=b'export const value=2;\n'
  (self.source/'sample.js').write_bytes(self.new);(self.target/'sample.js').write_bytes(self.old);(self.backup/'sample.js').write_bytes(self.old)
  self.manifest=self.root/'manifest.json';self.manifest.write_text(json.dumps([{'path':str(self.target/'sample.js'),'backup':str(self.backup/'sample.js'),'sha256':hashlib.sha256(self.old).hexdigest()}]),encoding='utf8')
 def tearDown(self):
  # Only this test's newly created absolute directory may be removed recursively.
  resolved=self.root.resolve()
  if resolved.parent!=ROOT.resolve() or not resolved.name.startswith('audit-installer-'):
   raise RuntimeError('Refused to clean an unverified fixture path')
  shutil.rmtree(resolved)
 def invoke(self,*args):
  return subprocess.run([sys.executable,str(SCRIPT),'--baseline',str(self.manifest),'--source-dir',str(self.source),'--target-dir',str(self.target),*args],capture_output=True,text=True,encoding='utf8',errors='replace')
 def test_check_leaves_target_unchanged(self):
  result=self.invoke('--check','--files','sample.js');self.assertEqual(result.returncode,0,result.stderr);self.assertEqual((self.target/'sample.js').read_bytes(),self.old)
 def test_build_leaves_target_unchanged_and_has_verifiable_bundle(self):
  result=self.invoke('--build','--output-dir',str(self.root/'bundle'),'--files','sample.js');self.assertEqual(result.returncode,0,result.stderr)
  manifest=json.loads((self.root/'bundle/manifest.json').read_text('utf8'));self.assertEqual(manifest['files'][0]['afterSha256'],hashlib.sha256(self.new).hexdigest());self.assertEqual((self.root/'bundle/files/sample.js').read_bytes(),self.new);self.assertEqual((self.target/'sample.js').read_bytes(),self.old)
 def test_concurrent_edit_rejected_even_with_allow_create(self):
  (self.target/'sample.js').write_bytes(b'export const anotherEdit=true;')
  result=self.invoke('--check','--files','sample.js','--allow-create','sample.js');self.assertEqual(result.returncode,2);self.assertIn('changed since baseline',result.stderr)
 def test_explicit_create_needed_for_new_file(self):
  (self.source/'new.js').write_text('export const created=true;',encoding='utf8')
  result=self.invoke('--check','--files','new.js');self.assertEqual(result.returncode,2);self.assertIn('explicit --allow-create',result.stderr)
  result=self.invoke('--check','--files','new.js','--allow-create','new.js');self.assertEqual(result.returncode,0,result.stderr);self.assertFalse((self.target/'new.js').exists())
 def test_existing_unknown_module_cannot_use_allow_create_to_bypass_baseline(self):
  (self.source/'unknown.js').write_bytes(self.new);(self.target/'unknown.js').write_bytes(self.old)
  result=self.invoke('--check','--files','unknown.js','--allow-create','unknown.js');self.assertEqual(result.returncode,2);self.assertIn('has no baseline',result.stderr)
 def test_path_traversal_rejected(self):
  result=self.invoke('--check','--files','../sample.js');self.assertEqual(result.returncode,2);self.assertIn('plain .js filename',result.stderr)
 def test_missing_import_rejected(self):
  (self.source/'sample.js').write_text('import {missing} from "./missing.js?audit=1";',encoding='utf8')
  result=self.invoke('--check','--files','sample.js');self.assertEqual(result.returncode,2);self.assertIn('Unresolved import',result.stderr)
 def test_syntax_error_rejected(self):
  (self.source/'sample.js').write_text('export const =;',encoding='utf8')
  result=self.invoke('--check','--files','sample.js');self.assertEqual(result.returncode,2);self.assertIn('Syntax check failed',result.stderr)
 def test_baseline_backup_tampering_rejected(self):
  (self.backup/'sample.js').write_bytes(self.new)
  result=self.invoke('--check','--files','sample.js');self.assertEqual(result.returncode,2);self.assertIn('backup hash mismatch',result.stderr)

if __name__=='__main__':unittest.main(verbosity=2)
