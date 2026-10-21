"""Package, install and launch CleanFrame on an LG webOS TV with the webOS CLI (ares).

Public fonts only. The device is the ares device name (default "tv", or CLEANFRAME_WEBOS_DEVICE).
Install and launch reach the TV; announce them to the TV's owner first.
"""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

from font_assets import ROOT, write_widget_archive

APP = ROOT / 'app'
DIST = ROOT / 'dist'
STAGE = DIST / 'webos/app'
# Samsung Tizen manifest and its widget icon are not used by webOS.
TIZEN_ONLY = {'config.xml', 'icon.png'}
INFO = json.loads((APP / 'appinfo.json').read_text())
DEVICE = os.environ.get('CLEANFRAME_WEBOS_DEVICE', 'tv')


def ares(tool):
    found = shutil.which(tool) or str(Path.home() / '.local/bin' / tool)
    if not Path(found).is_file():
        raise SystemExit(tool + ' not found. Install the webOS CLI (ares) and add it to PATH.')
    return found


def ipk():
    return DIST / (INFO['id'] + '_' + INFO['version'] + '_all.ipk')


def package():
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    with tempfile.TemporaryDirectory() as temp:
        archive = Path(temp) / 'app.zip'
        write_widget_archive(archive, include_private=False)
        with zipfile.ZipFile(archive) as source:
            for name in source.namelist():
                if name not in TIZEN_ONLY:
                    source.extract(name, STAGE)
    names = [p.relative_to(STAGE).as_posix() for p in STAGE.rglob('*') if p.is_file()]
    assert not any(n.startswith('assets/private-fonts/') or Path(n).name.startswith('PP') for n in names), 'Private font in webOS package'
    assert 'appinfo.json' in names, 'Missing appinfo.json'
    for notice in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
        shutil.copy(ROOT / notice, STAGE / notice)
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


if __name__ == '__main__':
    commands = {'package': package, 'install': install, 'launch': launch}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        raise SystemExit('Usage: webos.py package|install|launch')
    commands[sys.argv[1]]()
