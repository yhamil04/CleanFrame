# Interaction behaviour — 0.6.1

This describes CleanFrame on LG webOS. Remote keys are the arrows, OK and Back (keyCode 461; `appinfo.json` sets `disableBackHistoryAPI` so Back reaches the app). In the browser preview, Enter is OK and Escape or Backspace is Back.

## Home

- Home controls are **Live TV**, **All apps** and **Settings**.
- Dock: Left/Right scrolls the apps without wrapping. Up enters the top-right controls, starting with the last selected control. Left/Right moves between the controls. Down or Back returns to the selected app. The clock is at the top left.
- List: Up/Down scrolls the apps without wrapping. Right enters the bottom-right controls, aligned with the clock above. Up/Down moves between the controls. Left or Back returns to the selected app. The list fades at both ends as it scrolls.
- OK opens the selected item. Focus alone never launches an app. With no Home apps, OK opens the Home editor.
- Icons-only apps and controls reveal their names when focused. App presentation and control presentation are independent.
- Back from the app list or Dock opens **Leave Home?** with two actions: **Stay** (focused first) and **LG Home**. Left/Right moves between them; OK on LG Home opens LG's Home screen; Back or Stay closes the prompt.
- A panel keeps focus within its own controls. Back closes one panel at a time.
- Returning to the running launcher keeps the selected app or panel item. There is no auto-return timer. Held OK and Back keys act once until the key is released.

Without root, the remote's Home button and Back inside another app go to LG's Home, not CleanFrame. See [LG webOS](webos.md) for Quick Access as the route back.

## Settings and appearance

Settings opens a grouped overview: Background, Layout, Typography, Focus, Apps on Home and LG TV. OK opens a group. Appearance groups use a two-pane screen with visible choices on the left and the committed Home preview on the right.

| Group | Choices |
| --- | --- |
| Background | Photo, Light, Dark; Wallpaper and Rotation when Photo is active |
| Layout | List or Dock; independent Text, Icons or Both choices for apps and Home controls |
| Typography | Manrope, Geist and Newsreader; Neue Montreal, Mori and Pangram Sans only in a private preview with local font files |
| Focus | Type or Glass; Soft, Frost or Clear tint material |
| Apps on Home | Membership and arrangement editor |
| LG TV | LG Home (LG's Home screen) and TV settings (picture, sound and network) |

Up/Down moves between rows. Left/Right moves between choices in a horizontal row. Focus alone changes neither the preview nor saved preferences in these appearance groups. Wallpaper has its own temporary photo preview, described below. OK applies the focused value. A checkmark identifies the applied value; the filled plate identifies remote focus. Applying the current value does not write again.

Material applies to a photographic Dock, or Glass focus on a photographic List. Inactive material choices remain visible with an explanation and are skipped during navigation. Their stored value is retained. Wallpaper and rotation are also inactive on flat backgrounds.

A font or photo change applies only after its resources are ready and storage succeeds. A load or storage failure keeps the previous appearance and checkmark, with a Try again action. Back cancels a pending change, leaves the group and keeps completed changes. Late load callbacks cannot apply a cancelled choice. There is no Save button. Returning to a group restores its last choice focus; returning to Settings restores its category focus. Rotation is nested within Background, and Back returns to its Rotation row.

The selected font applies to Home app names, the clock and Home controls. Settings, All apps, the Home editor and status text retain Manrope. The preview shows the committed Home appearance and its clock continues to update. An unavailable optional face is omitted. If the baseline font is slow or missing, Home remains usable with a local fallback and can recover when the font loads.

## Launching apps and LG screens

Home defaults to Netflix, YouTube, Prime Video and Disney+. Launching calls `luna://com.webos.applicationManager/launch` with the app's webOS ID through `PalmServiceBridge`. Live TV opens `com.webos.app.livetv`, LG Home opens `com.webos.app.home` and TV settings opens `com.palm.app.settings`.

Every call has an 8-second limit. A missing app, denied launch or timeout shows a real error with a Back action and leaves CleanFrame usable. No web player, placeholder success page or account credential is embedded. The browser preview reports that launching requires the TV.

## All apps

All apps opens a panel with page tabs at the top: **All apps**, **Inputs** (only when an input was found) and **Apps on Home**. All apps lists the installed apps alphabetically; Inputs lists Live TV and the HDMI and other external inputs, which are kept apart from the apps.

- The five-column grid scrolls with remote focus. OK launches an app or input; its On Home badge shows Home membership.
- Up from the first row reaches the open page's tab. Left/Right moves between tabs. OK on All apps or Inputs switches page in place; OK on Apps on Home opens the editor, whose Done or Back returns to All apps.
- Back on Inputs returns to the All apps page. Back on All apps returns Home.
- Known brands use bundled marks. Other apps use the TV's icon when the launch-point list provides one, with initials as a fallback.

Discovery: the panel first asks for the TV's launch-point list (`listLaunchPoints`), omitting CleanFrame itself and LG system screens. On webOS 5 a developer app is denied that list, so CleanFrame checks a fixed list of known app and input IDs in `app/device.js` with `getAppLoadStatus` and shows those that exist. An app installed later appears only if its ID is in that list. Any other failure shows Try again in place of the tabs and keeps saved Home choices.

## Apps on Home

Open the editor from Settings or All apps. On Home shows the current order on the left. Not on Home shows Recently removed first, followed by other installed apps on the right. Home holds one to nine apps.

- Reorder: OK on an app name picks it up. Up/Down moves it. OK places it and saves the order. Back puts an unplaced app back without saving that move.
- Remove: Right from an app name reaches Remove from Home. OK saves the removal and moves focus to the same app in Recently removed. The app stays installed.
- Add: OK on an app in Not on Home adds it and saves. A recently removed app returns to its previous position within the editing session; another app is added at the end. Focus follows the app to its Remove from Home control, so another OK can reverse the addition.
- Undo reverses a completed addition, removal or reorder from the current editing session. Done or Back closes the editor and keeps completed changes. Undo history ends when the editor closes.

Removing the last Home app or adding a tenth app is prevented. A failed storage write keeps the committed choices and order, with a retry message. Saved app IDs and names survive a restart or a failed catalogue refresh.

## Preferences and wallpaper

The launcher stores appearance, Home order, recently removed apps, the last launched Home app, wallpaper and rotation in the app's localStorage. List and Dock share these preferences. The `cleanframe.home.v1` key is retained, with a fallback read from `cleanframe.shore.v1`. Legacy List maps to Dark + List + Type; Glass Dock and Glass Grid map to Photo + Dock + Glass. App order, wallpaper, rotation and the last Home app are preserved.

The gallery contains 15 bundled wallpapers. Settings → Background → Wallpaper keeps the two-pane Settings frame. Up/Down browses a vertical thumbnail list without wrapping; the right-hand Home preview shows the candidate while the surrounding Settings backdrop stays on the applied photo. OK applies the focused photo and stays in Wallpaper. The tick marks the applied photo and preview status distinguishes unsaved browsing. Back restores the latest applied photo, cancels pending loading and returns to Background's Wallpaper row. Photo and material assets change as one complete bundle; a failed load restores the applied preview and offers retry. Preview loading waits briefly for remote focus to settle. OK during loading queues application for that photo; another browse move or Back cancels it. Browsing never saves, and repeated OK on the applied photo does not write again.

Settings → Background → Rotation offers Fixed, Each time Home opens, Every 5 minutes, Every 15 minutes and Every hour. Each time Home opens advances once when the launcher loads; a return to the already-running launcher does not advance it. Timed rotation counts only visible Photo Home time in either List or Dock. Panels, flat backgrounds and time while CleanFrame is hidden pause the cycle. Changing the photo or rotation mode starts a new interval.

Runtime photos, materials and fonts are local assets; they need no network download.

## Clock and rendering

Both layouts show the TV's local time in 12-hour format, without AM/PM or seconds. It updates at the minute boundary and on return to the launcher. No date is shown.

Photographic materials and blurred panel backgrounds are generated before packaging and stay aligned with the full-screen image. Photo colour and contrast metadata are also prepared offline. Navigation does not sample image pixels or apply live backdrop blur. Flat backgrounds use matching light or dark panel colours. Focus feedback uses transforms and opacity; reduced motion removes animated scaling and movement while retaining opacity feedback.
