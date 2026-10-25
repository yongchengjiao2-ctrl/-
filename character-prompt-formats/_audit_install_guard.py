"""Refuse legacy mutating installers after the reviewed audit bundle is installed.

This is a local maintenance guard, not a lock against official application
updates or scripts that do not call this helper. It never modifies app files.
"""
import os
from pathlib import Path
import sys

MARKER_NAME = 'audit-repairs-marker.json'


def guard_legacy_install(script_name, *, allow_build_only=False, argv=None, assets_dir=None):
    args = list(sys.argv[1:] if argv is None else argv)
    target = Path(assets_dir) if assets_dir is not None else Path(os.environ['LOCALAPPDATA']) / 'YingceCanvas/versions/1.3.13/web/dist/assets'
    marker = target / MARKER_NAME
    if not marker.exists():
        return
    # Only the original installer actually implements an install-free build.
    # A historical top-level script ignores arbitrary CLI flags; never pass it
    # through merely because somebody supplied --build-only.
    if allow_build_only and args == ['--build-only']:
        return
    raise SystemExit(
        f'Legacy installer {Path(script_name).name} refused: reviewed audit repairs are protected by {marker}. '
        'Install/restore through install-audit-repairs.py with a fresh reviewed baseline and explicit files. '
        'Only supported --build-only mode may run without changing installed modules. '
        'Do not remove the marker to force an old installer.'
    )
