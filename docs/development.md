# Development

## Browser preview

Start with Node.js 22+ and Python 3.10+, then `npm ci`. These are the supported development baselines; lower versions have not been checked. Install Chromium once with `npx playwright install chromium` for the browser checks. Linux hosts may also need Playwright's system dependencies (`npx playwright install --with-deps chromium`).

`npm run dev:public` starts http://localhost:4795/home/, bound to this computer only, using only the bundled public fonts. `/home/` serves `app/`, the same source that is packaged for webOS. Arrow keys, Enter and Escape mirror remote navigation. Device controls report that they require the TV; no success is simulated.

`npm run dev` also offers the optional Pangram fonts when their files are present under ignored `.local/research/font-candidates/`. Those binaries are never copied into `app/`, and the webOS package never includes them.

All UI assets, public fonts and the fifteen wallpapers are bundled. Glass materials and blurred panel backgrounds are rendered ahead of time; see [asset generation](assets.md).

## Runtime map and compatibility

- `app/appinfo.json` is the webOS manifest. Its tracked ID is the generic `com.example.cleanframe`; owners set their own in `.local/webos.json` (see [LG webOS](webos.md)).
- `app/index.html` loads the device adapter, gallery/font/palette catalogues, `assets/icons/metrics.js` and `main.js`, with `style.css`.
- `main.js` owns the List and Dock layouts, panel stack, focus, preferences and wallpaper timers. `device.js` owns the webOS calls (`PalmServiceBridge` to `luna://com.webos.applicationManager`) and installed-app discovery, behind the `FrameDevice` interface. Keep device details in that adapter.
- The logical stage is 1920 x 1080, scaled uniformly to the viewport. Check at 1920 x 1080 and 1280 x 720. Glass geometry and cached materials must stay aligned.
- Preferences use localStorage key `cleanframe.home.v1`, with a fallback read from `cleanframe.shore.v1`. Legacy fields are `dock`, `wallpaper`, `mode`, `lastApp` and `theme`. The 0.6 migration preserves app order, wallpaper, rotation and selection. Legacy `list` becomes Dark / List / Type; `shore` and `grid` become Photo / Dock / Glass. Appearance axes are stored separately. A saved app keeps its real app ID and name; discovery refreshes the installed catalogue. Keep migration checks when changing this format.
- `window.ShoreQA.state()` and `.where()` expose state and focus for browser tests. `minuteMs` can shorten rotation intervals in an isolated browser test.

The tested target is the webOS 5 TV in [TV status](tv-status.md), whose web engine is Chromium 68. Keep runtime JavaScript ES5-compatible: `npm run check` parses `app/main.js`, `app/device.js` and the scripts under `app/assets/` as ES5. That check covers syntax only; verify any new DOM, CSS or Luna service API on a webOS TV before claiming support. Avoid CSS newer than Chromium 68, such as flex `gap` and `inset`.

Keep material rendering in the development tools. See [asset generation](assets.md) and [testing](testing.md).

## Packaging and TV commands

`scripts/webos.py` stages, packages, installs, launches and inspects the app with the webOS CLI (`ares`). `npm run webos:stage` writes `dist/webos/app` with public fonts, notices and the identity from `.local/webos.json`; it needs neither `ares` nor a TV. `npm run webos:package` then runs `ares-package`. `webos:install`, `webos:launch` and `webos:inspect` reach the TV: run them only in an explicit device task and announce them to the TV's owner. See [LG webOS](webos.md) for setup and limits.

Keep the webOS CLI configuration, TV address and any keys outside the repository or under ignored `.local/`.
