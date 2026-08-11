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
    // WHILE THE MOBILE PROJECT IS IN FLIGHT: points at the stable Vercel
    // Preview alias for the mobile-app branch rather than production, so the
    // phases already tested (camera, dialer, viewport fix, and whatever
    // follows) are what's actually on the phone. This alias auto-updates on
    // every push to mobile-app — no rebuild needed for web-only changes.
    //
    // Swap to the production line below only once mobile-app is merged to
    // master and this file's own change is part of that merge — not before,
    // per "keep main clean until the whole thing works."
    url: "https://renovision-ana-git-mobile-app-renovision-an-a.vercel.app/admin/home",
    allowNavigation: [
      "renovision-ana-git-mobile-app-renovision-an-a.vercel.app",
      "www.renovisionana.ca",
      "renovisionana.ca",
    ],
    // url: "https://www.renovisionana.ca/admin",
    // allowNavigation: ["www.renovisionana.ca", "renovisionana.ca"],
  },
  ios: {
    // The admin's own chrome starts below the notch; the WebView handles its
    // own safe areas rather than being letterboxed by the shell.
    contentInset: "automatic",
  },
};

export default config;
