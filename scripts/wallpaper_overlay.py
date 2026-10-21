"""Personal wallpapers kept in ignored .local/wallpapers/ and added at preview or package time.

scripts/add-wallpapers.py writes the overlay. Its layout mirrors app/:

    .local/wallpapers/assets/wallpapers/own-<name>.jpg, -thumb.jpg, -panel.jpg
    .local/wallpapers/assets/materials/own-<name>-{study-soft,field-blur,field-frost,field-clear}.jpg
    .local/wallpapers/assets/wallpapers/catalog-overlay.js

catalog-overlay.js appends the photos to window.CleanFrameWallpapers. Its script tag is injected
after assets/wallpapers/catalog.js; app/index.html is never edited and personal photos never enter
app/. Set CLEANFRAME_PERSONAL_WALLPAPERS=0 to leave the overlay out of a preview or package.
"""
from pathlib import Path
import os
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
OVERLAY = ROOT / '.local/wallpapers'
SCRIPT = 'assets/wallpapers/catalog-overlay.js'
ANCHOR = '<script src="assets/wallpapers/catalog.js"></script>'
TAG = '<script src="' + SCRIPT + '"></script>'
# Only the runtime names main.js builds from a wallpaper ID, for IDs that cannot match a bundled photo.
NAME = re.compile(r'assets/(?:wallpapers/own-[a-z0-9-]+(?:-thumb|-panel)?'
                  r'|materials/own-[a-z0-9-]+-(?:study-soft|field-blur|field-frost|field-clear))\.jpg')


def enabled():
    """False when CLEANFRAME_PERSONAL_WALLPAPERS=0 (or false/no/off) asks for the bundled photos only."""
    return os.environ.get('CLEANFRAME_PERSONAL_WALLPAPERS', '1').strip().lower() not in {'0', 'false', 'no', 'off'}


def overlay_files(root=ROOT):
    """Map app-relative paths to overlay files. Empty without a catalogue script."""
    base = root / '.local/wallpapers'
    script = base / SCRIPT
    if not script.is_file() or script.is_symlink():
        return {}
    files = {SCRIPT: script}
    for folder in ['assets/wallpapers', 'assets/materials']:
        directory = base / folder
        if not directory.is_dir():
            continue
        for path in sorted(directory.iterdir()):
            name = folder + '/' + path.name
            # Regular files only; a personal file never replaces a bundled one.
            if NAME.fullmatch(name) and path.is_file() and not path.is_symlink() and not (root / 'app' / name).exists():
                files[name] = path
    return files


def inject_script(html):
    """Return index.html with the overlay catalogue loaded straight after the bundled catalogue."""
    if TAG in html:
        return html
    if html.count(ANCHOR) != 1:
        raise ValueError('index.html must load ' + ANCHOR + ' exactly once')
    return html.replace(ANCHOR, ANCHOR + '\n' + TAG)


def apply_wallpaper_overlay(stage, root=ROOT):
    """Copy the personal overlay into a staged app folder and load its catalogue. Returns the photo count.

    Call after the app files are in place. Does nothing without an overlay or when disabled.
    """
    stage = Path(stage)
    files = overlay_files(root) if enabled() else {}
    if not files:
        return 0
    for name, source in files.items():
        target = stage / name
        if target.exists():
            raise ValueError('Personal wallpaper would replace a packaged file: ' + name)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    index = stage / 'index.html'
    index.write_text(inject_script(index.read_text(encoding='utf-8')), encoding='utf-8')
    return sum(1 for name in files if name.endswith('-study-soft.jpg'))
