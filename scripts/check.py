"""Check the webOS manifest and the files the app references."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
app = root / 'app'
assert all((app / name).is_file() for name in ['main.js', 'style.css'])
for reference in ['assets/wallpapers/catalog.js', 'assets/adaptive-ink.js', 'assets/font-catalog.js']:
    assert (app / reference).is_file(), 'Missing runtime catalogue: ' + reference
for filename in ['index.html']:
    source = (app / filename).read_text()
    pattern = r'(?:src|href)=[\"\']([^\"\']+)' if filename.endswith('.html') else r'from\s+[\"\']([^\"\']+)'
    for reference in re.findall(pattern, source):
        if ':' in reference or reference.startswith('$'):
            continue
        assert (app / reference).is_file(), 'Missing bundled resource: ' + reference
        if filename.endswith('.js'):
            assert reference.startswith(('./', '../')), 'Module imports must be relative paths'
for css in app.rglob('*.css'):
    for reference in re.findall(r'url\([\"\']?([^\)\"\']+)', css.read_text()):
        if ':' not in reference:
            assert (css.parent / reference.split('?')[0]).is_file(), 'Missing CSS resource: ' + reference
# These resource names are constructed at runtime, so HTML/CSS reference checks cannot find them.
walls = json.loads((app / 'assets/wallpapers/SOURCES.json').read_text())
for wall in walls:
    for field in ['src', 'thumb']:
        assert (app / wall[field]).is_file(), 'Missing wallpaper: ' + wall[field]
    wall_id = wall['id']
    for suffix in ['study-soft', 'field-blur', 'field-frost', 'field-clear']:
        assert (app / ('assets/materials/' + wall_id + '-' + suffix + '.jpg')).is_file(), 'Missing registered material: ' + wall_id + '/' + suffix
    assert (app / ('assets/wallpapers/' + wall_id + '-panel.jpg')).is_file(), 'Missing panel backdrop: ' + wall_id
for icon in ['netflix', 'youtube', 'primevideo', 'disneyplus', 'appletv', 'spotify', 'apps', 'settings']:
    assert (app / ('assets/icons/' + icon + '.svg')).is_file(), 'Missing icon: ' + icon
# webOS manifest: a generic identity, Back delivered to the app, and icons at the sizes webOS expects.
# Owners set their own ID in the ignored .local/webos.json; scripts/webos.py applies it when packaging.
info = json.loads((app / 'appinfo.json').read_text())
assert info.get('type') == 'web' and (app / info.get('main', '')).is_file(), 'webOS entry point missing'
assert info['id'] == 'com.example.cleanframe', 'Keep the tracked app ID generic; put your own in .local/webos.json'
assert info.get('version') == json.loads((root / 'package.json').read_text())['version'], 'appinfo/package versions differ'
assert info.get('disableBackHistoryAPI') is True, 'Back (461) must reach the app'
for field, size in [('icon', 80), ('largeIcon', 130)]:
    data = (app / info[field]).read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and int.from_bytes(data[16:20], 'big') == size == int.from_bytes(data[20:24], 'big'), 'webOS ' + field + ' must be a ' + str(size) + 'px PNG'
print('webOS manifest, version and bundled resources are valid.')
