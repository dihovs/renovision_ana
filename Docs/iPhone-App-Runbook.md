# iPhone app — the Mac-side runbook

Everything Windows could prepare is already in this repo; this file is the
half that needs a Mac. It is written to be followed either by Artush directly
or by Claude Code opened in this repo on the MacBook ("follow
Docs/iPhone-App-Runbook.md").

## What the app is

A native shell (Capacitor 7) whose WebView loads the LIVE admin at
`https://www.renovisionana.ca/admin` — see `capacitor.config.ts`. There is no
second frontend: every Vercel deploy updates the app instantly, and nothing
needs rebuilding on the Mac unless the shell itself changes (icon, permissions,
Capacitor upgrade).

Already prepared in the repo:

- `ios/` — the complete Xcode project, icon installed (1024px, from
  `scripts/make-app-icons.mjs`), `NSMicrophoneUsageDescription` set so the
  in-app softphone can use the mic
- `capacitor.config.ts` — app id `ca.renovisionana.crm`, name "Renovision",
  remote URL mode, navigation allowed on our domain only
- Capacitor 7 uses Swift Package Manager — **no CocoaPods to install**

## One-time setup on the Mac

1. Install **Xcode** from the Mac App Store (large download; launch it once and
   accept the license / let it install components).
2. In Xcode → Settings → Accounts, sign in with the Apple Developer account.
3. Clone and prepare:

   ```bash
   git clone https://github.com/dihovs/renovision_ana.git
   cd renovision_ana
   npm ci
   npx cap sync ios
   npx cap open ios
   ```

## Put it on the iPhone

In the Xcode window that opens:

1. Click the **App** target → **Signing & Capabilities** tab.
2. Tick **Automatically manage signing** and pick the **Team** (the developer
   account). Xcode registers the bundle id `ca.renovisionana.crm` on the
   account by itself.
3. Plug in the iPhone with a cable (first time: unlock it and tap **Trust**).
4. Select the iPhone in the device dropdown at the top, press **▶ Run**.
5. First launch on the phone may ask to trust the developer profile:
   Settings → General → VPN & Device Management → trust.

That's it — "Renovision" is on the home screen with the company icon. With a
paid developer account the install stays valid for a year.

## Updating later

- **CRM changes** (pages, features, fixes): nothing to do — the app shows the
  live site.
- **Shell changes** (icon, permissions, Capacitor version): `git pull`,
  `npx cap sync ios`, press Run again.

## Optional: TestFlight instead of a cable

Xcode → Product → **Archive** → Distribute App → **TestFlight Internal
Testing**. Add the account itself as an internal tester in App Store Connect.
Installs over the air, updates pushed the same way, no cable. Internal
TestFlight builds skip App Review but expire after 90 days, so the cable
install is less upkeep for one person.

## Deliberately NOT the public App Store

Guideline 4.2 rejects thin web-wrapper apps, and a single-user internal CRM
has no business being publicly listed. If a store listing ever becomes a real
goal (e.g. crew accounts), the path is native features on top of this shell —
push notifications, offline caching — not a resubmission of the wrapper.

## Known limits, stated honestly

- **No network → no app.** Every read is a database query; the wrapper does
  not change that.
- **The softphone in the WebView** should work (WKWebView supports
  `getUserMedia` on iOS 14.3+, and the mic permission is declared) but has not
  been exercised on a real device yet — test a call on the phone before
  relying on it in the truck. If it misbehaves, the browser-tab version and
  the bridge dialer on /admin/calls both still work.
- **Push notifications don't exist yet** (new lead / new text making the
  phone buzz). That is the first genuinely native feature worth adding here —
  it needs a device token registration + a sender on the server. Ask Claude
  for "push notifications for the iPhone app" as its own piece of work.
