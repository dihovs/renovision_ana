import ChatConversation from "./ChatConversation";

/**
 * The floating variant this shell used to offer is gone — Ana's ElevenLabs
 * widget (AnaWidget, mounted once in the root layout) is the corner bubble
 * now, on every page. What remains is /estimation's inline conversation,
 * dropped into normal page flow where the estimator IS the page rather than
 * something reached by clicking a bubble.
 *
 * Every other call site that used to open the floating panel now calls
 * useChat().openChat() (see ChatProvider.tsx), which starts a conversation on
 * the Ana widget directly rather than rendering anything from here.
 */
export default function ChatWidget() {
  return <ChatConversation variant="inline" />;
}
