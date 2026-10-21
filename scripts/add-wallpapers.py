"""Add personal photos as CleanFrame wallpapers without putting them in the repository.

    python3 scripts/add-wallpapers.py ~/Pictures/frame          # add every photo in a folder
    python3 scripts/add-wallpapers.py photo.jpg --name "Lake"    # one photo with its own name
    python3 scripts/add-wallpapers.py --list
    python3 scripts/add-wallpapers.py --remove own-lake          # moved to .local/wallpapers/removed/
    python3 scripts/add-wallpapers.py --catalog-only             # after editing wallpapers.json

Everything is written to the ignored .local/wallpapers/: the 1920 x 1080 background, thumbnail,
panel backdrop and four registered materials per photo (the bundled recipe, rendered by
scripts/build-materials.mjs in Playwright's Chromium), plus wallpapers.json and
assets/wallpapers/catalog-overlay.js. Originals are only read. npm run dev and the webOS package
add the overlay; see scripts/wallpaper_overlay.py and app/assets/wallpapers/README.md.

Catalogue values (tone, ut, frostVeil, clockMist) start from simple brightness measurements.
Review each photo in the preview and edit wallpapers.json if text is hard to read, then run
--catalog-only. Personal photos have no adaptive-ink palette and use these catalogue values.
"""
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata

from wallpaper_overlay import ROOT, OVERLAY, SCRIPT

MANIFEST = OVERLAY / 'wallpapers.json'
# Formats Chromium decodes. HEIC is not among them: export those photos as JPEG first.
FORMATS = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp'}
MATERIALS = ['study-soft', 'field-blur', 'field-frost', 'field-clear']
VALUES = {'tone': ['light', 'dark'], 'ink': ['light', 'mist', 'dark'],
          'frostVeil': [.12, .20, .30, .36, .44], 'listColumn': [0, 2, 3]}


def file_hash(path):
    return sha256(path.read_bytes()).hexdigest()


def slug(text):
    ascii_text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    value = re.sub(r'[^a-z0-9]+', '-', ascii_text).strip('-')[:40].strip('-')
    # -thumb and -panel are runtime suffixes; keep them out of the ID itself.
    return re.sub(r'-(?:thumb|panel)$', '', value) or 'photo'


def title(stem):
    name = re.sub(r'[\s_-]+', ' ', stem).strip()[:60]
    return (name[:1].upper() + name[1:]) if name else 'Photo'


def files_of(id):
    return (['assets/wallpapers/' + id + tag + '.jpg' for tag in ['', '-thumb', '-panel']]
            + ['assets/materials/' + id + '-' + m + '.jpg' for m in MATERIALS])


def load():
    if MANIFEST.is_file():
        return json.loads(MANIFEST.read_text())
    return {'version': 1, 'wallpapers': []}


def save(manifest):
    OVERLAY.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')


def defaults(stats):
    """Starting catalogue values from 8-bit luma, calibrated loosely against the bundled photos."""
    dock = stats['dock']['p90']
    return {
        'tone': 'light' if stats['all']['mean'] >= 110 or stats['top']['mean'] >= 150 else 'dark',
        'ut': {'tr': 'light' if stats['tr']['p90'] < 125 else 'mist',
               'br': 'light' if stats['br']['p90'] < 100 else 'mist'},
        'frostVeil': .44 if dock >= 195 else .36 if dock >= 185 else .30 if dock >= 175 else .20 if dock >= 100 else .12,
        'listColumn': 0, 'dockQuiet': False, 'clockMist': stats['tl']['p90'] >= 170,
    }


def entry_for_catalogue(w):
    """Validate one manifest entry and return the catalogue fields main.js reads."""
    problems = []
    if not re.fullmatch(r'own-[a-z0-9-]+', w.get('id', '')):
        problems.append('id must look like own-name')
    if not isinstance(w.get('name'), str) or not w['name'].strip() or len(w['name']) > 60:
        problems.append('name must be 1-60 characters')
    if w.get('tone') not in VALUES['tone']:
        problems.append('tone must be light or dark')
    ut = w.get('ut') or {}
    if ut.get('tr') not in VALUES['ink'] or ut.get('br') not in VALUES['ink']:
        problems.append('ut.tr and ut.br must be light, mist or dark')
    if w.get('frostVeil') not in VALUES['frostVeil']:
        problems.append('frostVeil must be one of .12, .2, .3, .36, .44')
    if w.get('listColumn', 0) not in VALUES['listColumn']:
        problems.append('listColumn must be 0, 2 or 3')
    if problems:
        raise SystemExit('wallpapers.json, ' + str(w.get('id')) + ': ' + '; '.join(problems))
    id = w['id']
    return {'id': id, 'name': w['name'].strip(), 'src': 'assets/wallpapers/' + id + '.jpg',
            'thumb': 'assets/wallpapers/' + id + '-thumb.jpg', 'tone': w['tone'],
            'ut': {'tr': ut['tr'], 'br': ut['br']}, 'frostVeil': w['frostVeil'],
            'listColumn': w.get('listColumn', 0), 'dockQuiet': bool(w.get('dockQuiet')),
            'clockMist': bool(w.get('clockMist')), 'personal': True}


def write_catalogue(manifest):
    target = OVERLAY / SCRIPT
    walls = [entry_for_catalogue(w) for w in manifest['wallpapers']]
    for w in walls:
        missing = [name for name in files_of(w['id']) if not (OVERLAY / name).is_file()]
        if missing:
            raise SystemExit('Missing overlay files for ' + w['id'] + ': ' + ', '.join(missing) + '. Re-add the photo.')
    if not walls:
        if target.is_file():
            target.unlink()
        print('No personal wallpapers; the overlay catalogue was removed.')
        return
    data = json.dumps(walls, indent=2, ensure_ascii=True).replace('</', '<\\/')
    target.parent.mkdir(parents=True, exist_ok=True)
    # ES5: runs on the TV between assets/wallpapers/catalog.js and main.js.
    target.write_text(
        '/* Personal wallpapers from .local/wallpapers, added at preview or package time. Not public source. */\n'
        '(function (walls) {\n'
        '  var list = window.CleanFrameWallpapers, seen = {};\n'
        '  if (!list) return;\n'
        '  list.forEach(function (w) { seen[w.id] = true; });\n'
        '  walls.forEach(function (w) { if (!seen[w.id]) list.push(w); });\n'
        '}(' + data + '));\n')
    print('Wrote ' + str(target.relative_to(ROOT)) + ' with ' + str(len(walls)) + ' personal wallpaper(s).')


def sources_of(paths, parser):
    found = []
    for path in paths:
        path = path.expanduser().resolve()
        if path.is_relative_to(ROOT / 'app'):
            parser.error('Keep personal photos outside app/: ' + str(path))
        if path.is_dir():
            candidates = sorted(p for p in path.iterdir() if p.is_file() and not p.name.startswith('.'))
        elif path.is_file():
            candidates = [path]
        else:
            parser.error('Not found: ' + str(path))
        for p in candidates:
            if p.suffix.lower() in FORMATS:
                found.append(p)
            elif p.suffix.lower() in {'.heic', '.heif'}:
                print('Skipped ' + p.name + ': export HEIC photos as JPEG first.')
    return found


def build(entries):
    """Render backgrounds, thumbnails and materials into the overlay; return measurements per ID."""
    if not shutil.which('node'):
        raise SystemExit('Node.js is required (npm ci; npx playwright install chromium).')
    OVERLAY.mkdir(parents=True, exist_ok=True)
    job, report = OVERLAY / 'build.json', OVERLAY / 'build-report.json'
    job.write_text(json.dumps([{'id': e['id'], 'source': e['source']} for e in entries], indent=2) + '\n')
    try:
        subprocess.run(['node', 'scripts/build-materials.mjs', '--overlay'], cwd=ROOT, check=True)
        result = json.loads(report.read_text())
    finally:
        job.unlink(missing_ok=True)
        report.unlink(missing_ok=True)
    tints = {a['id']: a['softTint'] for a in result['assets']}
    return {id: dict(m, softTint=tints.get(id)) for id, m in result.get('measured', {}).items()}


def add(args, parser):
    manifest = load()
    sources = sources_of(args.sources, parser)
    if not sources:
        parser.error('No photos found (' + ', '.join(sorted(FORMATS)) + ').')
    if args.name and len(sources) != 1:
        parser.error('--name needs exactly one photo.')
    by_hash = {w['sourceSha256']: w for w in manifest['wallpapers']}
    taken = {w['id'] for w in manifest['wallpapers']}
    todo = []
    for path in sources:
        digest = file_hash(path)
        known = by_hash.get(digest)
        if known and not args.rebuild:
            print('Already added: ' + path.name + ' as ' + known['id'])
            continue
        if known:
            # Rebuild the images; keep any reviewed name and catalogue values.
            known['source'] = str(path)
            todo.append((known, None))
            continue
        base = 'own-' + slug(path.stem)
        id, n = base, 2
        while id in taken:
            id, n = base + '-' + str(n), n + 1
        taken.add(id)
        todo.append(({'id': id, 'name': args.name or title(path.stem), 'source': str(path), 'sourceSha256': digest}, path))
    if not todo:
        write_catalogue(manifest)
        return
    measured = build([w for w, _ in todo])
    for w, new in todo:
        m = measured[w['id']]
        if file_hash(Path(w['source'])) != w['sourceSha256']:
            raise SystemExit('Original changed while preparing: ' + w['source'])
        w.update(width=m['width'], height=m['height'], softTint=m['softTint'], stats=m['stats'])
        if new:
            w.update(defaults(m['stats']))
            manifest['wallpapers'].append(w)
        print(w['id'] + ': ' + w['name'] + ' (' + str(m['width']) + ' x ' + str(m['height'])
              + ', tone ' + w['tone'] + ', utilities ' + w['ut']['tr'] + '/' + w['ut']['br'] + ', frost veil ' + str(w['frostVeil']) + ')')
    save(manifest)
    write_catalogue(manifest)
    print('Review each photo with npm run dev (Settings > Background > Wallpaper). Personal photos stay in .local/.')


def remove(ids, parser):
    manifest = load()
    known = {w['id'] for w in manifest['wallpapers']}
    unknown = [id for id in ids if id not in known]
    if unknown:
        parser.error('Unknown personal wallpaper: ' + ', '.join(unknown))
    # Reversible: files move to .local/wallpapers/removed/<time>/ rather than being deleted.
    store = OVERLAY / 'removed' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    for id in ids:
        for name in files_of(id):
            if (OVERLAY / name).is_file():
                (store / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(OVERLAY / name), str(store / name))
    store.mkdir(parents=True, exist_ok=True)
    (store / 'wallpapers.json').write_text(json.dumps([w for w in manifest['wallpapers'] if w['id'] in ids], indent=2, ensure_ascii=False) + '\n')
    manifest['wallpapers'] = [w for w in manifest['wallpapers'] if w['id'] not in ids]
    save(manifest)
    write_catalogue(manifest)
    print('Moved ' + ', '.join(ids) + ' to ' + str(store.relative_to(ROOT)))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('sources', nargs='*', type=Path, help='Photo files or folders (not recursive)')
    parser.add_argument('--name', help='Display name, when adding one photo')
    parser.add_argument('--rebuild', action='store_true', help='Render already-added photos again, keeping their catalogue values')
    parser.add_argument('--remove', help='Comma-separated IDs to move to .local/wallpapers/removed/')
    parser.add_argument('--catalog-only', action='store_true', help='Rewrite catalog-overlay.js from wallpapers.json')
    parser.add_argument('--list', action='store_true', help='List personal wallpapers')
    args = parser.parse_args()
    if args.list:
        for w in load()['wallpapers']:
            print(w['id'] + '\t' + w['name'] + '\t' + w['source'])
    elif args.remove:
        remove([id.strip() for id in args.remove.split(',') if id.strip()], parser)
    elif args.catalog_only:
        write_catalogue(load())
    elif args.sources:
        add(args, parser)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
