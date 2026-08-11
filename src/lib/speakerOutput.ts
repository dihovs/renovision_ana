import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Bridges to `SpeakerPlugin.swift` — a few lines of native code this app
 * ships itself rather than a package, registered by name since it has no
 * matching npm plugin. Outside the native shell this is always a no-op:
 * there is no audio-routing concept in a plain browser tab.
 */
type SpeakerBridge = {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
};

const Speaker = registerPlugin<SpeakerBridge>("Speaker");

/** Returns the state that actually took effect, not the one asked for. */
export async function setSpeakerEnabled(enabled: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await Speaker.setEnabled({ enabled });
    return result.enabled;
  } catch {
    return !enabled;
  }
}
