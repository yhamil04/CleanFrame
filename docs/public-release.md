# Public release checklist

CleanFrame for LG webOS is a public fork of Nathan Clark's [CleanFrame](https://github.com/nthnclrk/CleanFrame), which was reviewed and published under the MIT licence on 20 October 2026. This fork keeps his copyright notice, credits him in the README, CONTRIBUTING and notices, and contains no Samsung/Tizen tooling.

## Source boundary

The public source contains the webOS app, a public-font screenshot, development tools, browser tests, setup notes and asset notices. Paid Pangram fonts, keys, TV addresses, device identifiers, the owner's app ID (`.local/webos.json`), personal wallpapers (`.local/wallpapers/`) and generated packages stay in ignored `.local/` and `dist/`. The tracked app ID is the generic `com.example.cleanframe`.

## Before publishing

1. Run `npm run check`, `CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser` and `npm run check:public`. The public check covers private paths, credential patterns, proprietary font bytes and personal identifiers (personal app IDs, home-directory paths, email addresses, private IP and MAC addresses). It is bounded and cannot guarantee the absence of every secret.
2. Check that the GitHub Actions run for the revision passed; local and hosted results are separate.
3. For a downloadable package, build it with `npm run webos:package`. It always uses the public fonts and includes `LICENSE` and `THIRD_PARTY_NOTICES.md`. Build it with `CLEANFRAME_PERSONAL_WALLPAPERS=0` so personal photos from `.local/wallpapers/` are left out, and do not publish a package built with a personal app ID unless that is intended.
4. Keep Nathan Clark's copyright line in `LICENSE` and the credits in the README and notices.
5. Review new images for location or personal metadata, and new assets against [third-party notices](../THIRD_PARTY_NOTICES.md) and [asset sources](asset-sources.md).

## Asset review

The upstream review checked each of the fifteen wallpaper pages for author and Unsplash licence on 20 October 2026; see [asset sources](asset-sources.md). Font and icon licence texts are retained beside the assets. Original code uses MIT; third-party assets keep their own terms.

Deleting a file does not remove it from Git history. Visibility changes, release uploads and history rewrites need their own explicit instruction.
