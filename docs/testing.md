# Validation

## Offline app changes

```sh
npm ci
npm run check
npx playwright install chromium
CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser
npm run check:public
```

`check` validates JavaScript syntax, parses the TV runtime scripts as ES5, and checks the webOS manifest (generic ID, version, Back delivery, 80 px and 130 px icons) and bundled resources. It does not contact a TV.

`check:browser` uses a fresh Playwright Chromium profile, its own loopback preview and a mock `PalmServiceBridge`. It checks List and Dock navigation, single focus, Home controls, grouped Settings, explicit OK application, applied checkmarks, pending-load cancellation, retries, persistence, all fifteen wallpaper bundles, available fonts, 720p scaling, migrations, the Home editor, the fixed-ID fallback when the launch-point list is denied, Inputs apart from apps, input names, the clock format and date, Picture mode (start, idle start, exit, rotation), screen shift registration, the Magic Remote pointer and wheel, the Channel, number and colour keys, and honest browser-only launch errors. Reports and screenshots are in ignored `.local/qa/`. A failed assertion exits with a nonzero status. `CLEANFRAME_PUBLIC_FONTS=1` excludes any local proprietary fonts; the GitHub Actions workflow uses this public path.

`check:public` is a bounded source and history check for private files, credentials, proprietary fonts and personal identifiers (personal app IDs, home-directory paths, email addresses, private IP and MAC addresses). It does not clear third-party asset rights.

`npm run webos:stage` builds the public-font app folder without the webOS CLI and asserts that no private font is included.

`node scripts/check-performance.mjs` is an optional, CPU-throttled browser performance audit with a mock webOS bridge; its report goes to `.local/qa/performance/`. It is a regression screen, not a TV benchmark.

If the default browser/cache location is unavailable, use a writable local path for both commands:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run check:browser
```

For manual review, use `npm run dev:public` and open `/home/`. Use the arrow keys, Enter and Escape. Check the changed flow in List and Dock, on Photo, Light and Dark backgrounds. Check a single app and nine apps when changing app layout. In Settings, browse without applying, apply with OK, return with both Back routes, and cancel a pending resource load. Check editor placement/undo, wallpaper rotation pausing during panels/background time, and restored focus on return when those flows change. Browser preferences are separate from TV preferences.

## Physical TV checks

Run these only under a task that includes TV testing. Announce any installation or launch first, then follow [LG webOS](webos.md). A successful `ares-install` or `ares-launch` is not a visible result. Ask the TV's owner to confirm the remote behaviour and record the version, webOS/firmware, result and any open checks in [TV status](tv-status.md).

1. Move in both directions through each layout and Settings; check focus, response and readable labels from the sofa.
2. Launch a Home app and return through Quick Access or the LG app bar; check the selected app is kept. Streaming apps handle their own Back.
3. Check Live TV, All apps (All apps and Inputs pages), Settings → LG TV → LG Home and TV settings, and Back → Leave Home? → LG Home; verify the visible destinations.
4. Check saved appearance, app order and wallpaper after relaunch. Check timed rotation pauses while a panel is open or CleanFrame is in the background.

Browser CPU throttling is a development comparison, not a TV performance measurement.
