# Reference TV and verification status

These results describe the maintainer's LG TV. Other models, webOS versions and regions need their own checks. Repository-only work must not contact the TV.

## Reference TV

| Item | Reference setup |
| --- | --- |
| TV | LG 49NANO863NA (NANO86, 2020), UK |
| OS | webOS TV 5.6.2, firmware 04.64.00 |
| Web engine | Chrome/68.0.3440.106 |
| Access | Developer Mode app; not rooted |

The TV's network address, device identifiers and the installed app ID are private local configuration (`.local/`).

## Confirmed by the owner

- The Dock Home renders; remote arrows, OK and Back work.
- Apps open from CleanFrame; LG Home and TV settings open from CleanFrame.
- All apps lists Stremio, HBO Max, Pathé and Viaplay, and they open.

The default Home app IDs, Netflix (`netflix`), YouTube (`youtube.leanback.v4`), Prime Video (`amazon`) and Disney+ (`com.disney.disneyplus-prod`), were verified on this TV. Also verified installed: Apple TV (`com.apple.appletv`), Apple Music (`com.apple.applemusic`), Stremio (`io.strem.tv`), HBO Max (`com.wbd.hbomax`), Pathé (`pathe`), Viaplay (`viaplay-lg`), Web Browser, Photo & Video, Music, Live TV and HDMI 1–4. BBC iPlayer (`bbc.iplayer.3.0`), ITVX (`com.fvp.itv`) and Spotify (`spotify-beehive`) are listed with their usual IDs but were not installed there. Videoland's ID has not been found.

## Known limits

On webOS 5 a developer app is denied the installed-app and launch-point lists, so All apps uses a fixed list of known IDs. The remote's Home button and Back inside other apps go to LG's Home; CleanFrame cannot start at power-on without root. See [LG webOS](webos.md).

## Not yet confirmed

Record a result here only after the owner has seen it on the TV. Command success (install or launch returning without error) is not a visible result. Browser checks establish source behaviour; CPU-throttled Chromium timings are not TV benchmarks. Current browser checks are described in [testing](testing.md).
