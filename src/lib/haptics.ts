import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/**
 * A tap that feels like something happened, not just a color change.
 *
 * Outside the native shell this is always a no-op — there is no haptic
 * concept in a browser tab, and the plugin call itself would just fail
 * quietly there anyway.
 */
export function tapFeedback(style: "light" | "medium" = "light"): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.impact({ style: style === "light" ? ImpactStyle.Light : ImpactStyle.Medium });
}
