import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app.
 *
 * A native shell around the LIVE admin, not a second frontend. `server.url`
 * points the WebView at production, so the app is always exactly as new as
 * the last Vercel deploy — no App Store submission to ship a fix, no version
 * of the CRM that can lag the one in the browser. The trade is honest: with
 * no network the app shows nothing, which for a CRM whose every read is a
 * database query is the truth however it is packaged.
 *
 * `webDir` still points at a real folder because the CLI requires one, but
 * nothing in it ships to the phone while `server.url` is set — it holds a
 * single explanatory file.
 *
 * Distribution is Xcode-to-device / TestFlight, deliberately NOT the public
 * App Store: guideline 4.2 rejects thin wrappers, and a single-user internal
 * CRM has no business being publicly listed anyway. The runbook in
 * Docs/iPhone-App-Runbook.md is the Mac-side half of this file.
 */
const config: CapacitorConfig = {
  appId: "ca.renovisionana.crm",
  appName: "Renovision",
  webDir: "capacitor-shell",
  server: {
    // Production. The condition the previous comment set here has been met:
    // mobile-app is merged to master (0 commits apart in both directions as
    // of this change), so the preview alias and production now serve the
    // same commits, and pointing at preview only bought a second copy of
    // everything to keep in sync.
    //
    // It bought a bug, too. The app registered for push against the preview
    // deployment while notifications were SENT from production, and only
    // production had a working APNS_KEY_P8 -- the preview copy is still
    // mangled. That happened to work because both read one Supabase, which
    // is the kind of accident that holds until it doesn't.
    //
    // The cost of this line: a web-only change now needs a push to master
    // rather than to mobile-app. That is the same push either way now.
    url: "https://www.renovisionana.ca/admin",
    allowNavigation: ["www.renovisionana.ca", "renovisionana.ca"],
  },
  ios: {
    // The admin's own chrome starts below the notch; the WebView handles its
    // own safe areas rather than being letterboxed by the shell.
    contentInset: "automatic",
    // Unset, this defaults to black — so an edge scroll-bounce past the top
    // or bottom of the page showed a black sliver where the page's own white
    // background should have kept going. White matches every page's actual
    // background, so a bounce now shows nothing rather than a visible seam.
    backgroundColor: "#ffffff",
  },
  backgroundColor: "#ffffff",
};

export default config;
