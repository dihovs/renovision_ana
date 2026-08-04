/**
 * The one custom element this codebase renders: ElevenLabs' embeddable
 * conversation widget. Declared here so `<elevenlabs-convai>` type-checks
 * like any other JSX element instead of erroring as an unknown tag — React
 * still passes its attributes straight through to the DOM, this file exists
 * purely for TypeScript.
 *
 * Augments `React.JSX`, not a bare global `JSX` namespace — React 19 moved
 * the JSX types under the `react` module itself, and the old
 * `declare global { namespace JSX }` pattern from React 17/18 no longer
 * merges with anything.
 */
import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "agent-id": string;
          "dynamic-variables"?: string;
          /** Widget UI chrome language (button labels, etc) — read at connect, not reactive to later mutation. */
          language?: string;
          /** Pins the conversation panel open — the real lever behind ChatProvider's openChat(); this widget has no imperative open() method. */
          "always-expanded"?: string;
        },
        HTMLElement
      >;
    }
  }
}
