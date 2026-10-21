# Launcher wallpapers

The fifteen entries in `SOURCES.json` each have a background JPEG, a thumbnail and a small blurred panel backdrop. Four registered material JPEGs per image live in `../materials/`. All derived images retain the source photograph's terms.

Photo pages, authors and licence observations are in [asset sources](../../../docs/asset-sources.md). Generation instructions are in [asset generation](../../../docs/assets.md). Full-size originals remain outside the repository.

## Your own photos

Personal photos can be added as wallpapers without being committed. They are written to the ignored `.local/wallpapers/` and never to `app/`.

```sh
python3 scripts/add-wallpapers.py ~/Pictures/frame           # every JPEG, PNG, WebP or AVIF in the folder
python3 scripts/add-wallpapers.py lake.jpg --name "Lake"      # one photo with its own name
python3 scripts/add-wallpapers.py --list
python3 scripts/add-wallpapers.py --remove own-lake           # moved to .local/wallpapers/removed/
```

Requirements: `npm ci` and `npx playwright install chromium`. The photos are rendered in Playwright's Chromium with the bundled recipe in `scripts/build-materials.mjs`: a centred 1920 x 1080 crop, a 512 x 288 thumbnail, the panel backdrop and the four registered materials. Originals are only read. HEIC files must be exported as JPEG first.

Each photo gets an `own-` ID and is listed after the fifteen bundled photos in Settings. `.local/wallpapers/wallpapers.json` records the source path, hash and the catalogue values `tone`, `ut`, `frostVeil` and `clockMist`. These start from simple brightness measurements and have no adaptive-ink palette. Check each photo in the preview; if text is hard to read, edit those values and run `python3 scripts/add-wallpapers.py --catalog-only`. `--rebuild` renders a photo again and keeps its values.

`npm run dev` shows the photos. `npm run dev:public`, `--no-personal-wallpapers` and `CLEANFRAME_PERSONAL_WALLPAPERS=0` leave them out. The webOS package copies the overlay into its staged app and loads `assets/wallpapers/catalog-overlay.js` after `catalog.js`; set `CLEANFRAME_PERSONAL_WALLPAPERS=0` to package without them. Do not share a package that contains personal photos you do not want to publish. See `scripts/wallpaper_overlay.py`.
