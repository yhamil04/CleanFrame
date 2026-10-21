# Working with a coding agent

CleanFrame for LG webOS is a port of Nathan Clark's [CleanFrame](https://github.com/nthnclrk/CleanFrame). It is developed on one LG TV (webOS 5, not rooted). Treat the source and setup notes as a starting point, explain that use is at the owner's risk, and inspect the actual scripts before proposing device commands. Samsung TVs are out of scope; point their owners to the original project.

Choose the scope before starting: a browser contribution or an installation on the owner's TV. Each needs a different level of local access and owner authority.

## Change the interface

Use the browser-only prompt in the README. Read `AGENTS.md`, then the development and interaction docs. Run the public-font preview so the result is reproducible on a clean clone. Finish with `npm run check`, relevant browser checks, a screenshot for visual changes and a clear statement of what needs physical TV observation.

The app has List and Dock layouts, fifteen wallpapers and separate appearance settings. `app/main.js` handles interaction; `app/device.js` owns webOS service calls. The existing storage migration keeps older installations usable. The TV engine is Chromium 68, so runtime code stays ES5 and CSS avoids newer features such as flex `gap` and `inset`.

## Install on your own LG TV

Use a local agent with access to your computer. A cloud-only agent can edit the repo but cannot reach your TV through this source alone. Start with this prompt:

```text
Read AGENTS.md and docs/webos.md. Help me install my own copy of
CleanFrame on my LG webOS TV. My model and webOS version are:
<supply them, or help me find them in the TV's settings>.

First preview the public-font app locally. Then help me install the
webOS CLI (ares), enable Developer Mode on the TV with LG's Developer
Mode app, and register the TV as an ares device. I will sign in to my
LG developer account myself. Create .local/webos.json with my own
reverse-domain app ID. Keep the TV address and any keys out of Git.

Prepare one stage at a time. Ask before the first device connection
and announce each install and launch. Confirm visible results with me.
Do not attempt rooting or changes to LG's Home or startup.
```

`scripts/webos.py` applies the ID in `.local/webos.json` to the package and to the install, launch and inspect commands, so nothing in `app/` changes. Keep that ID stable after the first installation; a different ID installs a second app with separate preferences.

If All apps misses an installed app, its ID is probably not in the fixed list in `app/device.js`. Test a candidate ID with `getAppLoadStatus` as described in [LG webOS](webos.md) before adding it.

## Publishing

Run `npm run check:public` before publishing. The webOS package always excludes proprietary fonts and includes the notices. Read the third-party notices and [public release](public-release.md) checklist. Repo visibility, release uploads and history changes need their own explicit instruction.
