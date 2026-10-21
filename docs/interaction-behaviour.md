# Interaction behaviour — 0.6.1

This describes CleanFrame on LG webOS. Remote keys are the arrows, OK and Back (keyCode 461; `appinfo.json` sets `disableBackHistoryAPI` so Back reaches the app), Channel Up/Down, the number keys 0–9 and the four colour keys. In the browser preview, Enter is OK, Escape or Backspace is Back and Page Up/Down are Channel Up/Down.

## Home

- Home controls are **Live TV**, **All apps** and **Settings**.
- Dock: Left/Right scrolls the apps without wrapping. Up enters the top-right controls, starting with the last selected control. Left/Right moves between the controls. Down or Back returns to the selected app. The clock is at the top left.
- List: Up/Down scrolls the apps without wrapping. Right enters the bottom-right controls, aligned with the clock above. Up/Down moves between the controls. Left or Back returns to the selected app. The list fades at both ends as it scrolls.
- OK opens the selected item. Focus alone never launches an app. With no Home apps, OK opens the Home editor.
- Icons-only apps and controls reveal their names when focused. App presentation and control presentation are independent.
- Back from the app list or Dock opens **Leave Home?** with two actions: **Stay** (focused first) and **LG Home**. Left/Right moves between them; OK on LG Home opens LG's Home screen; Back or Stay closes the prompt.
- A panel keeps focus within its own controls. Back closes one panel at a time.
- Returning to the running launcher keeps the selected app or panel item. There is no auto-return timer. Held OK and Back keys act once until the key is released.
- Number keys 1–9 open the matching Home app, moving focus to it first. 0 starts Picture mode. Red opens All apps, Green opens Live TV, Yellow opens Apps on Home and Blue opens Settings. These keys work only on Home; panels ignore them. Like OK and Back, a held number or colour key acts once.
- Channel Up/Down move five apps along the Dock or List, without wrapping.

Without root, the remote's Home button and Back inside another app go to LG's Home, not CleanFrame. See [LG webOS](webos.md) for Quick Access as the route back.

## Pointer

The Magic Remote pointer moves focus without OK. On Home, pointing at an app selects it; elsewhere it focuses the item, including All apps tabs and tiles, editor rows, Remove and the header, Settings rows, choices, wallpaper rows, input names and message buttons. Pointing at a wallpaper previews it like remote focus but never saves it. Inactive choices cannot take pointer focus. The pointer is ignored while an editor app is lifted. A click acts as OK. The wheel moves one item at a time (left/right on the Dock and in messages, up/down elsewhere); a fast flick moves one step.

## Picture mode

LG TVs have no Art Mode, so Picture mode shows the current wallpaper full screen with every Home control hidden. A small clock sits at the bottom right, following the Clock settings (format and date). The photo is used even when Background is Light or Dark; it loads through the same photo bundle as a Photo Home.

- Start it with Settings → Picture → Start now, with 0 on Home, or automatically: Settings → Picture → Start when Home is idle offers Off (default), After 5 minutes, After 15 minutes and After 30 minutes. The idle count runs only while Home is the top view and CleanFrame is visible; any remote key, click, wheel or pointer movement starts it again, and every return to Home starts a new count.
- Any key, click, wheel or pointer movement returns to Home with its previous focus. That key is consumed and does not act; its repeats are ignored until it is released. Pointer movement in the first half second after starting is ignored, so the click that started it does not end it. Started from Settings, Picture mode closes Settings first, so leaving it always lands on Home; reopening Settings returns to the Picture group.
- Picture mode ends when CleanFrame is hidden, for example by the remote's Home button.
- The wallpaper changes on the Rotation interval (Fixed and Each time Home opens keep one photo), on any background. The new photo crossfades in over about a second using opacity only. No image beyond the usual wallpaper bundle is loaded.

## Settings and appearance

Settings opens a grouped overview in two columns: Background, Layout, Typography and Focus on the left; Clock, Picture, Apps on Home and LG TV on the right. Up/Down moves within a column without wrapping; Left/Right moves to the same row of the other column. OK opens a group. Appearance groups use a two-pane screen with visible choices on the left and the committed Home preview on the right.

| Group | Choices |
| --- | --- |
| Background | Photo, Light, Dark; Wallpaper and Rotation when Photo is active |
| Layout | List or Dock; independent Text, Icons or Both choices for apps and Home controls |
| Typography | Manrope, Geist and Newsreader; Neue Montreal, Mori and Pangram Sans only in a private preview with local font files |
| Focus | Type or Glass; Soft, Frost or Clear tint material |
| Clock | Format: 12-hour or 24-hour; Date: Off or On; Screen shift: Off or On |
| Picture | Start now; Start when Home is idle: Off, After 5, 15 or 30 minutes |
| Apps on Home | Membership and arrangement editor |
| LG TV | LG Home (LG's Home screen) and TV settings (picture, sound and network) |

The overview summarises each group, for example "24-hour, with date, screen shift" for Clock and "Start with 0 or from here" or "Starts after 15 minutes idle" for Picture. Clock and Picture choices apply with OK without loading assets, keep their last choice focus like the other groups, and the right-hand preview shows the committed Home clock, date and shift.

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
- Channel Up/Down move three rows; Up stops at the first row.
- The Inputs page has a **Rename** tab action after Inputs. It opens Rename inputs at the last focused input: the inputs on the left and twelve choices in two columns on the right (Original name, PlayStation, Xbox, Nintendo Switch, Apple TV, Set-top box, Blu-ray, Games console, PC, Soundbar, Chromecast, Fire TV). Up/Down picks an input; Right or OK moves to its names, starting at the applied one. Arrows move through the names; OK saves the focused name and stays there, with a tick on the applied name. Original name restores the TV's own name. Left from the first column or Back returns to the inputs; Back or Done returns to Inputs with the renamed input focused. A failed save keeps the previous name, says so, and OK tries again. There is no on-screen keyboard.
- A chosen name is used wherever the input appears: the Inputs grid, Home, the Home editor and launch error titles. The input keeps its bundled HDMI or antenna glyph and its place in the alphabetical order of the TV's own names. Grid OK still opens the input.
- Known brands use bundled marks. Other apps use the TV's icon when the launch-point list provides one, with initials as a fallback.

Discovery: the panel first asks for the TV's launch-point list (`listLaunchPoints`), omitting CleanFrame itself and LG system screens. On webOS 5 a developer app is denied that list, so CleanFrame checks a fixed list of known app and input IDs in `app/device.js` with `getAppLoadStatus` and shows those that exist. An app installed later appears only if its ID is in that list. Any other failure shows Try again in place of the tabs and keeps saved Home choices.

## Apps on Home

Open the editor from Settings or All apps. On Home shows the current order on the left. Not on Home shows Recently removed first, followed by other installed apps on the right. Home holds one to nine apps.

- Reorder: OK on an app name picks it up. Up/Down moves it. OK places it and saves the order. Back puts an unplaced app back without saving that move.
- Remove: Right from an app name reaches Remove from Home. OK saves the removal and moves focus to the same app in Recently removed. The app stays installed.
- Add: OK on an app in Not on Home adds it and saves. A recently removed app returns to its previous position within the editing session; another app is added at the end. Focus follows the app to its Remove from Home control, so another OK can reverse the addition.
- Channel Up/Down move one visible page; Up stops at the first row.
- Undo reverses a completed addition, removal or reorder from the current editing session. Done or Back closes the editor and keeps completed changes. Undo history ends when the editor closes.

Removing the last Home app or adding a tenth app is prevented. A failed storage write keeps the committed choices and order, with a retry message. Saved app IDs and names survive a restart or a failed catalogue refresh.

## Preferences and wallpaper

The launcher stores appearance, Home order, recently removed apps, the last launched Home app, wallpaper, rotation, clock format and date, Picture idle time, screen shift and input names in the app's localStorage. The last Home app is saved only after the TV accepts the launch. Preferences saved before these options existed load unchanged and take the defaults: 12-hour, no date, idle Off, screen shift Off and no input names. Saved input names must be one of the preset names for a valid app ID; anything else is dropped on load. List and Dock share these preferences. The `cleanframe.home.v1` key is retained, with a fallback read from `cleanframe.shore.v1`. Legacy List maps to Dark + List + Type; Glass Dock and Glass Grid map to Photo + Dock + Glass. App order, wallpaper, rotation and the last Home app are preserved.

The gallery contains 15 bundled wallpapers. Settings → Background → Wallpaper keeps the two-pane Settings frame. Up/Down browses a vertical thumbnail list without wrapping, and Channel Up/Down move one visible page (Up stops at the first row); the right-hand Home preview shows the candidate while the surrounding Settings backdrop stays on the applied photo. OK applies the focused photo and stays in Wallpaper. The tick marks the applied photo and preview status distinguishes unsaved browsing. Back restores the latest applied photo, cancels pending loading and returns to Background's Wallpaper row. Photo and material assets change as one complete bundle; a failed load restores the applied preview and offers retry. Preview loading waits briefly for remote focus to settle. OK during loading queues application for that photo; another browse move or Back cancels it. Browsing never saves, and repeated OK on the applied photo does not write again.

Settings → Background → Rotation offers Fixed, Each time Home opens, Every 5 minutes, Every 15 minutes and Every hour. Each time Home opens advances once when the launcher loads, and once each time the running launcher is shown again after another app or LG Home was in front. Window focus alone does not advance it. Timed rotation counts visible Photo Home time in either List or Dock, and Picture mode time on any background. Panels, flat-background Home and time while CleanFrame is hidden pause the cycle. Changing the photo or rotation mode starts a new interval.

Runtime photos, materials and fonts are local assets; they need no network download.

## Clock and rendering

Both layouts show the TV's local time without seconds. Settings → Clock → Format chooses 12-hour (the default, without AM/PM) or 24-hour (zero-padded hours, for example 09:05). Date On adds a short line under the clock, for example "Tue 21 Oct", built by CleanFrame rather than the browser's locale formatting. Clock and date update at the minute boundary and on return to the launcher. In the List layout a caption with a date starts higher, so a full-name line for a long app name still ends above the first row; in the Dock the clock, date and full name stack at the top left, well clear of the Dock. Every Home font keeps its clock digit metrics in both formats.

Screen shift (Settings → Clock, Off by default) is OLED care. When on, the whole Home layer (clock, date, Home controls, Dock or List, and the Picture mode clock) moves together by one translate on its wrapper, cycling through six fixed offsets of at most 3.2 px, one per 30 minutes of the TV's clock. The registered glass fields and the Dock material counter-move by the same offset, so the glass stays aligned with the photo. Turning it off restores the exact original position.

Photographic materials and blurred panel backgrounds are generated before packaging and stay aligned with the full-screen image. Photo colour and contrast metadata are also prepared offline. Navigation does not sample image pixels or apply live backdrop blur. Flat backgrounds use matching light or dark panel colours. Focus feedback uses transforms and opacity; reduced motion removes animated scaling and movement while retaining opacity feedback.
