/**
 * What Ana asks Microsoft for, and what she deliberately does not. (ANA-04)
 *
 * THIS FILE IS THE BOUNDARY. The owner said on 30 Aug 2026: Teams messages,
 * Outlook, OneDrive — and explicitly **not** Teams voice calls. That instruction
 * is honoured here, by never requesting the scope, and nowhere else. Microsoft
 * then refuses the call data permanently, to this application, regardless of
 * what any prompt says or what any future handler tries to fetch.
 *
 * It is the same reasoning as `ownerToolsFor()` returning an empty array and as
 * PERMITTED_CRM_WRITES: the thing that cannot be talked into anything is the
 * thing that was never granted. A rule enforced at the consent screen survives
 * a rewritten system prompt, a confused model, and a message from a stranger
 * asking nicely.
 *
 * Adding a scope here is a real decision with a visible diff, and it costs the
 * owner a fresh consent — Microsoft does not widen a grant silently. That
 * friction is a feature.
 */

/**
 * Delegated scopes, requested as the owner rather than as the tenant.
 *
 * DELEGATED IS THE POINT. Application permissions would have been easier to
 * keep alive — no refresh token, no expiry, no re-consent — and would have
 * given a background service standing access to every mailbox and every file in
 * the company. He asked for *his* Teams, *his* mail, *his* files. Delegated
 * access is that sentence expressed as a grant, and it is why this app can
 * never read an employee's mailbox even by accident.
 */
export const GRAPH_SCOPES = [
  // Keeps the connection alive without sending him back to a consent screen
  // every hour. Without it there is no refresh token and Ana goes deaf in 60
  // to 90 minutes.
  "offline_access",

  // Who consented. Used for the label on the connection in the admin, so
  // "connected" can name an account rather than asserting itself.
  "User.Read",

  // ANA-05. 1:1 and group chats — confirmed 30 Aug 2026 that people message him
  // directly rather than in team channels, so `ChannelMessage.Read.All` is not
  // requested. That one is admin-consent territory and covers every channel in
  // the tenant; this one does not.
  "Chat.Read",

  // ANA-06. Read only. ANA-17 will need Mail.ReadWrite to leave a reply in his
  // drafts folder — that is a separate order and must arrive as a visible
  // change to this list, never as a quiet addition.
  "Mail.Read",

  // ANA-07. Finding a document the adjuster sent, not indexing the drive.
  "Files.Read.All",
] as const;

/**
 * Scopes that must never appear above, checked by a test rather than trusted.
 *
 * Not an exhaustive list of everything dangerous — it is the specific thing the
 * owner ruled out, plus the application-level and write scopes that would turn
 * this from "Ana can read my things" into something else. `scopes.test.ts`
 * fails if any of them is added, so the next person to widen this list has to
 * argue with a test rather than with a comment.
 */
export const FORBIDDEN_SCOPES = [
  // The owner's instruction, in code.
  "CallRecords.Read.All",
  "CallRecord-PstnCalls.Read.All",
  "OnlineMeetings.Read",
  "OnlineMeetings.ReadWrite",
  "OnlineMeetingTranscript.Read.All",
  "OnlineMeetingRecording.Read.All",

  // Sending is a human action. ANA-17 puts a draft in his mailbox; he presses
  // send. See the write boundary in src/lib/voice/ownerTools.ts.
  "Mail.Send",
  "Mail.Send.Shared",
  "Chat.ReadWrite",
  "ChatMessage.Send",

  // Tenant-wide reads. Every one of these is "any mailbox / any chat / any
  // file in the company" rather than "the owner's".
  "Mail.Read.All",
  "Chat.Read.All",
  "ChannelMessage.Read.All",
  "Files.ReadWrite.All",
  "Sites.Read.All",
  "Directory.Read.All",
  "User.Read.All",
] as const;

/** The space-separated string Microsoft's authorize and token endpoints want. */
export function scopeParameter(): string {
  return GRAPH_SCOPES.join(" ");
}

/**
 * Whether what Microsoft actually granted covers what we asked for.
 *
 * A grant can come back narrower than the request — an administrator can
 * restrict it, and consent can be given for some scopes and not others. That
 * shows up later as an empty mailbox rather than an error, which reads exactly
 * like "he has no mail about the boiler". So the health check compares, and the
 * admin can be told which scope is missing instead of guessing.
 *
 * `offline_access` is dropped from the comparison: Microsoft honours it by
 * issuing a refresh token and does not always echo it back in the granted list.
 * Its real test is whether a refresh token arrived, which tokens.ts checks.
 */
export function missingScopes(granted: readonly string[]): string[] {
  const held = new Set(granted.map((s) => s.toLowerCase()));
  return GRAPH_SCOPES.filter(
    (scope) => scope !== "offline_access" && !held.has(scope.toLowerCase()),
  );
}
