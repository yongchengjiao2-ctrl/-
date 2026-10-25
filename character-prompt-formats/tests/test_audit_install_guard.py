import ast
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('_audit_install_guard', ROOT / '_audit_install_guard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class LegacyGuardTests(unittest.TestCase):
    def test_no_marker_is_read_only_and_preserves_legacy_behavior(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            original = target / 'a.js'
            original.write_text('preserved', encoding='utf8')
            guard.guard_legacy_install('install.py', assets_dir=target, argv=[])
            self.assertEqual(original.read_text('utf8'), 'preserved')
            self.assertEqual([p.name for p in target.iterdir()], ['a.js'])

    def test_marker_blocks_install_restore_and_fake_build_mode_without_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / guard.MARKER_NAME).write_text('{invalid marker still protects}', encoding='utf8')
            (target / 'a.js').write_text('preserved', encoding='utf8')
            before = {p.name: p.read_bytes() for p in target.iterdir()}
            for args in [[], ['--restore'], ['--build-only'], ['--build-only', '--restore']]:
                with self.assertRaisesRegex(SystemExit, 'install-audit-repairs.py'):
                    guard.guard_legacy_install('install-old.py', assets_dir=target, argv=args)
            self.assertEqual(before, {p.name: p.read_bytes() for p in target.iterdir()})

    def test_only_supported_exact_build_only_is_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / guard.MARKER_NAME).write_text('{}', encoding='utf8')
            guard.guard_legacy_install('install.py', allow_build_only=True, assets_dir=target, argv=['--build-only'])
            for args in [[], ['--restore'], ['--build-only', '--restore']]:
                with self.assertRaises(SystemExit):
                    guard.guard_legacy_install('install.py', allow_build_only=True, assets_dir=target, argv=args)

    def test_all_legacy_scripts_guard_before_executable_code_and_parse(self):
        scripts = [p for p in ROOT.glob('install*.py') if p.name != 'install-audit-repairs.py']
        self.assertTrue(scripts)
        for script in scripts:
            tree = ast.parse(script.read_text('utf-8-sig'), filename=str(script))
            body = list(tree.body)
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
                body.pop(0)
            while body and isinstance(body[0], ast.ImportFrom) and body[0].module == '__future__':
                body.pop(0)
            self.assertIsInstance(body[0], ast.ImportFrom, script.name)
            self.assertEqual(body[0].module, '_audit_install_guard', script.name)
            self.assertIsInstance(body[1], ast.Expr, script.name)
            self.assertEqual(body[1].value.func.id, 'guard_legacy_install', script.name)
        self.assertNotIn('guard_legacy_install', (ROOT / 'install-audit-repairs.py').read_text('utf8'))

    def test_script_refuses_before_top_level_mutation_in_temp_localappdata(self):
        # Execute every real legacy script with an isolated fake installation;
        # the sentinel makes the guard stop before imports or backups/database
        # writes. No production installation path is passed to the process.
        import os
        with tempfile.TemporaryDirectory() as directory:
            local = Path(directory)
            target = local / 'YingceCanvas/versions/1.3.13/web/dist/assets'
            target.mkdir(parents=True)
            (target / guard.MARKER_NAME).write_text('{}', encoding='utf8')
            (target / 'a.js').write_text('preserved', encoding='utf8')
            before = {str(p.relative_to(local)): p.read_bytes() for p in local.rglob('*') if p.is_file()}
            env = dict(os.environ, LOCALAPPDATA=str(local), PYTHONDONTWRITEBYTECODE='1')
            for script in ROOT.glob('install*.py'):
                if script.name == 'install-audit-repairs.py':
                    continue
                for args in [[], ['--restore']]:
                    result = subprocess.run([sys.executable, '-B', str(script), *args], cwd=local, env=env, capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0, script.name)
                    self.assertIn('Legacy installer', result.stderr, script.name)
            after = {str(p.relative_to(local)): p.read_bytes() for p in local.rglob('*') if p.is_file()}
            self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
