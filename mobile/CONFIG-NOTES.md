# app.json — why each value is what it is

Expo rejects unknown keys in app.json, so these notes live here. Each heading is
a key under `expo`.

**The app targets Android only** (decided 13 September 2026). The React code
stays platform-neutral — nothing in `app/`, `components/` or `lib/` is
Android-specific — so adding iOS later is a configuration and release job, not a
rewrite. What was dropped is the Apple *release apparatus*: the Developer Program
enrolment, the D-U-N-S wait, APNs keys, TestFlight, and the universal-links file.

## `platforms`

Pinned to `["android", "web"]`. Without the key, `expo export` and `eas build`
will happily produce iOS output nobody asked for and nobody will test. Naming
the supported platforms makes an accidental iOS build an error rather than a
silent, unverified artefact.

`web` is listed because it is the only target that runs on the development
machine itself (`npm run web`, via `react-native-web`). It is a development
convenience, not a shipped surface: nothing is released to the web, and Android
remains the only platform the app is tested and published on.

## `orientation`

`"default"` allows portrait and landscape. The plan requires both, plus
foldables. Layout is driven by measured width (`theme/width.ts`), never by an
orientation flag, so a fold or a split-screen resize goes through the same code
path as a rotation.

## `userInterfaceStyle`

Locked to `light`. The website has no dark mode, and the app is a replica rather
than a reinterpretation. Leaving it unset would let Android's dark theme recolour
system surfaces while every SXCCAA surface stayed light — worse than either
choice made deliberately.

## `scheme`

Deep links are `sxccaa://`. See `intentFilters` for the https variant.

## `android.package`

`org.sxccaa.alumni`. **Cannot be changed after the first Play submission** —
changing it creates a different app, which existing users do not receive as an
update. Confirm before phase 3.

## `android.versionCode`

An integer Play uses to order releases. It must increase with every upload, and
Play refuses a build whose code it has already seen. Separate from `version`
(`1.0.0`), which is the string users read.

## Edge-to-edge (no key)

Android 15 draws apps edge-to-edge whether they opt in or not, and SDK 57
removed `android.edgeToEdgeEnabled` from the config schema accordingly — there
is nothing left to opt into. Every screen reads real insets through
`react-native-safe-area-context` (`components/Screen.tsx`), which keeps content
out from under the status bar and the gesture handle.

## The New Architecture (no key)

Also absent for the same reason: SDK 57 dropped `newArchEnabled`, because the
New Architecture is the only architecture. Reanimated 4 and
`react-native-worklets` require it, which is why the pin exists in the first
place. Leaving the key in place is not harmless — `expo-doctor` fails schema
validation on it, which buries any real config error in a known-noisy check.

## `plugins` — `expo-splash-screen`

The splash screen is configured as **plugin props**, not as a top-level `splash`
object. SDK 57 removed `expo.splash` from the schema, and the plugin reads only
what it is passed: listed as the bare string `"expo-splash-screen"` it takes no
props and does nothing at all, silently, leaving the default white screen. There
is no fallback to `expo.splash`, so a config that looks configured is not.

`imageWidth` is required by the Android side of the plugin and has no equivalent
in the old block; 200 renders `assets/splash.png` at roughly a third of a phone's
width, centred on `#111111`. `app/_layout.tsx` holds this screen manually until
the fonts and the content bundle resolve.

## `android.permissions`

Only three, each tied to a feature:

- `CAMERA` — taking a photograph directly into an event album (phase 5)
- `READ_MEDIA_IMAGES` — choosing an existing photograph instead (Android 13+)
- `POST_NOTIFICATIONS` — **a runtime permission since Android 13.** The app must
  ask, and the user may refuse. Phase 6 handles refusal by degrading to the
  in-app feed rather than nagging; nothing in the app is gated on it.

## `android.blockedPermissions`

Libraries add permissions to the merged manifest transitively, and a permission
nobody asked for still appears on the Play listing and still has to be justified
in the Data Safety form. Blocking them makes the manifest match the declaration
by construction rather than by vigilance.

`READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are blocked deliberately:
they are the pre-Android-13 route to the photo library, far broader than
`READ_MEDIA_IMAGES`, and this app does not need them.

## `android.intentFilters`

`autoVerify: true` makes `https://sxccaa.org/events/...` open the app instead of
Chrome — Android App Links. It only works once **`assetlinks.json` is served from
`https://sxccaa.org/.well-known/assetlinks.json`**, which needs the site deployed
and the release signing fingerprint. Until then such a link opens the browser,
which is a correct fallback rather than a failure.

The `sxccaa://` scheme works without any of that, and is what notification taps
use.
