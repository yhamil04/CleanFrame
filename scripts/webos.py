"""Stage, package, install, launch and inspect CleanFrame on an LG webOS TV with the webOS CLI (ares).

Public fonts only. The device is the ares device name (default "tv", or CLEANFRAME_WEBOS_DEVICE).
An optional, git-ignored .local/webos.json ({"id": "...", "vendor": "..."}) replaces the generic
app ID and vendor in the packaged appinfo.json and in the install/launch/inspect commands.
Personal wallpapers in .local/wallpapers are added unless CLEANFRAME_PERSONAL_WALLPAPERS=0.
Install, launch and inspect reach the TV; announce them to the TV's owner first.
"""
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

from font_assets import ROOT, write_widget_archive
from wallpaper_overlay import apply_wallpaper_overlay

APP = ROOT / 'app'
DIST = ROOT / 'dist'
STAGE = DIST / 'webos/app'
LOCAL = ROOT / '.local/webos.json'
DEVICE = os.environ.get('CLEANFRAME_WEBOS_DEVICE', 'tv')
APP_ID = re.compile(r'[a-z0-9]+(?:\.[a-z0-9-]+)+')


def info():
    """Return appinfo.json with the local identity override applied."""
    data = json.loads((APP / 'appinfo.json').read_text())
    if LOCAL.is_file():
        override = json.loads(LOCAL.read_text())
        unknown = set(override) - {'id', 'vendor'}
        if unknown:
            raise SystemExit('.local/webos.json: unsupported keys ' + ', '.join(sorted(unknown)))
        data.update(override)
    if not APP_ID.fullmatch(data.get('id', '')) or data['id'].startswith(('com.webos.', 'com.palm.', 'com.lge.')):
        raise SystemExit('Use your own reverse-domain webOS app ID, for example com.<yourname>.cleanframe, in .local/webos.json.')
    return data


INFO = info()


def ares(tool):
    found = shutil.which(tool) or str(Path.home() / '.local/bin' / tool)
    if not Path(found).is_file():
        raise SystemExit(tool + ' not found. Install the webOS CLI (ares) and add it to PATH.')
    return found


def ipk():
    return DIST / (INFO['id'] + '_' + INFO['version'] + '_all.ipk')


def stage():
    """Write the public-font app folder that ares-package consumes. Needs no ares CLI or TV."""
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    with tempfile.TemporaryDirectory() as temp:
        archive = Path(temp) / 'app.zip'
        write_widget_archive(archive, include_private=False)
        with zipfile.ZipFile(archive) as source:
            source.extractall(STAGE)
    names = [p.relative_to(STAGE).as_posix() for p in STAGE.rglob('*') if p.is_file()]
    assert not any(n.startswith('assets/private-fonts/') or Path(n).name.startswith('PP') for n in names), 'Private font in webOS package'
    assert 'CleanFramePrivateFontIDs = ["geist", "newsreader"]' in (STAGE / 'assets/font-catalog.js').read_text(), 'Unexpected font catalogue in webOS package'
    assert 'appinfo.json' in names, 'Missing appinfo.json'
    (STAGE / 'appinfo.json').write_text(json.dumps(INFO, indent=2, ensure_ascii=False) + '\n')
    for notice in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
        shutil.copy(ROOT / notice, STAGE / notice)
    photos = apply_wallpaper_overlay(STAGE)
    if photos:
        print('Added ' + str(photos) + ' personal wallpaper(s) from .local/wallpapers (CLEANFRAME_PERSONAL_WALLPAPERS=0 to leave them out)')
    print('Staged ' + str(STAGE.relative_to(ROOT)) + ' as ' + INFO['id'] + ' (public fonts only)')


def package():
    stage()
    target = ipk()
    if target.exists():
        target.unlink()
    # -n: keep the ES5 sources as written; the packager's minifier is not needed.
    subprocess.run([ares('ares-package'), '-n', '-o', str(DIST), str(STAGE)], check=True)
    if not target.is_file():
        raise SystemExit('ares-package did not create ' + target.name)
    print('Created ' + str(target.relative_to(ROOT)) + ' (' + str(round(target.stat().st_size / 1e6, 1)) + ' MB, public fonts only)')


def install():
    if not ipk().is_file():
        raise SystemExit('Run npm run webos:package first.')
    subprocess.run([ares('ares-install'), '-d', DEVICE, str(ipk())], check=True)


def launch():
    subprocess.run([ares('ares-launch'), '-d', DEVICE, INFO['id']], check=True)


def inspect():
    subprocess.run([ares('ares-inspect'), '-d', DEVICE, '-a', INFO['id']], check=True)


if __name__ == '__main__':
    commands = {'stage': stage, 'package': package, 'install': install, 'launch': launch, 'inspect': inspect}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        raise SystemExit('Usage: webos.py ' + '|'.join(commands))
    commands[sys.argv[1]]()
