# LG webOS port

The `webos` branch runs CleanFrame as a developer-mode web app on LG webOS TVs. Without root it is an app opened from the LG app bar; it does not replace LG's Home. Samsung's Tizen manifest, signing and device scripts are unchanged and are not used here.

## Reference TV

LG 49NANO863NA (2020), webOS TV 5.6.2, firmware 04.64.00, UK. The web engine is Chrome/68.0.3440.106. Not rooted.

Confirmed by the owner on this TV: the Dock Home renders; remote arrows, OK and Back work; apps open from CleanFrame; LG Home and TV settings open from CleanFrame; All apps lists Stremio, HBO Max, Pathé and Viaplay, and they open.

## Build, install and launch

Requires the webOS CLI (`ares`) with the TV registered as an ares device (default name `tv`; set `CLEANFRAME_WEBOS_DEVICE` for another name), and the TV's Developer Mode app with its session active.

```sh
npm run check
CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser
npm run webos:package   # dist/com.yhamil.cleanframe_<version>_all.ipk, public fonts only
npm run webos:install   # ares-install to the TV
npm run webos:launch    # ares-launch on the TV
```

Install and launch reach the TV; announce them to its owner first. The package leaves out `config.xml` and the Tizen widget icon, and includes `LICENSE` and `THIRD_PARTY_NOTICES.md`. A Developer Mode session lasts about 50 hours. Press Extend in the Developer Mode app before it expires, or the TV removes developer apps.

For another person's TV, change `id` and `vendor` in `app/appinfo.json`. The adapter reads its own ID at runtime, so nothing else needs changing.

## Runtime differences

- `app/device.js` calls `luna://com.webos.applicationManager` through `PalmServiceBridge`. It keeps the `FrameDevice` interface; `art` reports that Art Mode is unavailable.
- LG Home is `com.webos.app.home`; TV settings is `com.palm.app.settings`. Home controls are Live TV (`com.webos.app.livetv`, in Art Mode's former place), All apps and Settings. The settings group is LG TV.
- `appinfo.json` sets `disableBackHistoryAPI`, so Back (keyCode 461) reaches CleanFrame.
- CSS avoids features newer than Chromium 68: flex `gap` became sibling margins and `inset` became explicit offsets. A layout snapshot of 202 UI states matched the previous CSS. `:focus-visible` is ignored by this engine; it only affects a browser outline.

## Apps

Home defaults to Netflix (`netflix`), YouTube (`youtube.leanback.v4`), Prime Video (`amazon`) and Disney+ (`com.disney.disneyplus-prod`).

On webOS 5 a developer app is denied `listApps`, `listLaunchPoints`, `getAppInfo` and `getForegroundAppInfo`, and cannot read other apps' files. It may call `getAppLoadStatus`, which reports whether an app ID exists. All apps therefore checks a list of known IDs in `device.js` (`IDS` and `MORE`) and shows the installed ones. A newly installed app appears automatically only if its ID is in that list. If a TV allows `listLaunchPoints`, the adapter uses it instead. Other failures show Try again.

Verified installed on the reference TV: Apple TV (`com.apple.appletv`), Apple Music (`com.apple.applemusic`), Stremio (`io.strem.tv`), HBO Max (`com.wbd.hbomax`), Pathé (`pathe`), Viaplay (`viaplay-lg`), Web Browser, Photo & Video, Music, Live TV and HDMI 1–4. BBC iPlayer (`bbc.iplayer.3.0`), ITVX (`com.fvp.itv`) and Spotify (`spotify-beehive`) are listed with their usual IDs but were not installed there. Videoland's ID has not been found.

All apps has page tabs: All apps, Inputs and Apps on Home. Live TV and the HDMI inputs are on the Inputs page, not among the apps. OK on a tab switches page in place; Up from the first row reaches the open page's tab. Back on Inputs returns to the All apps page, and Back on All apps returns Home. Apps on Home opens the editor, whose Done or Back returns to All apps.

To test an ID, open CleanFrame, run `ares-inspect -d tv -a com.yhamil.cleanframe` and evaluate a `getAppLoadStatus` call through `PalmServiceBridge`. The reply is `{"exist": true}` when the app is installed. This launches nothing.

## Limits without root

The remote's Home button and Back inside another app go to LG's own Home, not CleanFrame. A developer app cannot intercept those keys, replace the launcher or see which app is in front. Remapping Home or starting CleanFrame at power-on needs root (for example Homebrew Channel) and is outside this port. Public exploits list webOS 5 firmware from 5.4.0 (RootMyTV) or the latest releases (faultmanager) as patched; the reference TV runs 5.6.2, firmware 04.64.00. Check [CanI.RootMy.TV](https://cani.rootmy.tv/) before considering root.

Without root, the quickest way back is LG's Quick Access: open CleanFrame, then press and hold a number key (1–8) and confirm. Holding that key then opens CleanFrame from Live TV or any app. Hold 0 to edit Quick Access. Moving CleanFrame to the start of the LG app bar also shortens the route through Home.
