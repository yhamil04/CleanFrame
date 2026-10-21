# LG webOS

CleanFrame for LG runs as a developer-mode web app on LG webOS TVs. Without root it is an app opened from the LG app bar; it does not replace LG's Home. The reference TV and what has been confirmed on it are in [TV status](tv-status.md).

## Your app identity

The tracked `app/appinfo.json` uses the generic ID `com.example.cleanframe`. For your own TV, set your own reverse-domain ID in the git-ignored `.local/webos.json`:

```json
{"id": "com.<yourname>.cleanframe", "vendor": "<your name>"}
```

`scripts/webos.py` applies it to the packaged `appinfo.json` and to the IDs used for install, launch and inspect. Only `id` and `vendor` are accepted. Keep the ID stable once installed: a different ID installs a second, separate app with its own saved preferences. The adapter reads its own ID at runtime (`PalmSystem.identifier`), so nothing in `app/` needs changing.

## Build, install and launch

Requires the webOS CLI (`ares`) with the TV registered as an ares device (default name `tv`; set `CLEANFRAME_WEBOS_DEVICE` for another name), and the TV's Developer Mode app with its session active.

```sh
npm run check
CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser
npm run webos:stage     # dist/webos/app, public fonts only; no ares or TV needed
npm run webos:package   # dist/<app id>_<version>_all.ipk, public fonts only
npm run webos:install   # ares-install to the TV
npm run webos:launch    # ares-launch on the TV
npm run webos:inspect   # ares-inspect: Web Inspector for the running app
```

Install, launch and inspect reach the TV; announce them to its owner first. The package always uses the public fonts, even when private Pangram files exist locally, and includes `LICENSE` and `THIRD_PARTY_NOTICES.md`. Personal wallpapers added with `npm run wallpapers:add` (in `.local/wallpapers/`) are included; set `CLEANFRAME_PERSONAL_WALLPAPERS=0` to package without them. A Developer Mode session lasts about 50 hours. Press Extend in the Developer Mode app before it expires, or the TV removes developer apps.

## Runtime notes

- `app/device.js` calls `luna://com.webos.applicationManager` through `PalmServiceBridge` and exposes the `FrameDevice` interface used by `main.js`. Every call has an 8-second limit and reports a real error; no success is simulated.
- LG Home is `com.webos.app.home`; TV settings is `com.palm.app.settings`; Live TV is `com.webos.app.livetv`.
- `appinfo.json` sets `disableBackHistoryAPI`, so Back (keyCode 461) reaches CleanFrame.
- Other remote keys CleanFrame uses: Channel Up/Down (keyCodes 33 and 34) page through lists; the number keys 0–9 (48–57, and 96–105 from a number pad) open Home apps 1–9 and start Picture mode with 0; the colour keys Red, Green, Yellow and Blue (403–406) open All apps, Live TV, Apps on Home and Settings. Number and colour keys act only on Home. LG Quick Access uses a *held* number key; CleanFrame acts on a press, once per press.
- All apps reuses the last good catalogue for 10 minutes, so reopening it does not repeat about 20 `getAppLoadStatus` calls. **Try again** after a failure always bypasses that cache.
- Picture mode keeps the screen showing a still photo indefinitely. Whether the TV's own screen saver, "no signal"/inactivity power-off or OLED care features interrupt it during Picture mode has not been checked on a TV. CleanFrame does not try to block them.
- CSS avoids features newer than Chromium 68: flex `gap` became sibling margins and `inset` became explicit offsets. `:focus-visible` is ignored by this engine; it only affects a browser outline. `npm run check` rejects JavaScript newer than ES5 in the runtime scripts.

## Apps

Home defaults to Netflix (`netflix`), YouTube (`youtube.leanback.v4`), Prime Video (`amazon`) and Disney+ (`com.disney.disneyplus-prod`).

On webOS 5 a developer app is denied `listApps`, `listLaunchPoints`, `getAppInfo` and `getForegroundAppInfo`, and cannot read other apps' files. It may call `getAppLoadStatus`, which reports whether an app ID exists. All apps therefore checks a list of known IDs in `device.js` (`IDS` and `MORE`) and shows the installed ones. A newly installed app appears automatically only if its ID is in that list. If a TV allows `listLaunchPoints`, the adapter uses it instead. Other failures show Try again. The IDs verified on the reference TV are listed in [TV status](tv-status.md).

To test an ID, open CleanFrame, run `npm run webos:inspect` and evaluate a `getAppLoadStatus` call through `PalmServiceBridge` in the inspector console. The reply is `{"exist": true}` when the app is installed. This launches nothing.

## Limits without root

The remote's Home button and Back inside another app go to LG's own Home, not CleanFrame. A developer app cannot intercept those keys, replace the launcher or see which app is in front. Remapping Home or starting CleanFrame at power-on needs root (for example Homebrew Channel) and is outside this project. Public exploits list webOS 5 firmware from 5.4.0 (RootMyTV) or the latest releases (faultmanager) as patched. Check [CanI.RootMy.TV](https://cani.rootmy.tv/) before considering root.

Without root, the quickest way back is LG's Quick Access: open CleanFrame, then press and hold a number key (1–8) and confirm. A short press of the same key inside CleanFrame opens a Home app instead. Holding that key then opens CleanFrame from Live TV or any app. Hold 0 to edit Quick Access. Moving CleanFrame to the start of the LG app bar also shortens the route through Home.
