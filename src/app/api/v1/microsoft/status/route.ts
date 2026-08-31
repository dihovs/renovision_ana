import { guarded } from "@/app/api/v1/guard";
import { microsoftConfig } from "@/lib/microsoft/auth";
import { FORBIDDEN_SCOPES, GRAPH_SCOPES, missingScopes } from "@/lib/microsoft/scopes";
import { hasEncryptionKey, readConnection } from "@/lib/microsoft/tokens";

/**
 * What the Microsoft connection actually holds. (ANA-04)
 *
 *   GET /api/v1/microsoft/status
 *
 * The order's "done when" is that this can report the granted scopes and show
 * no access to calls, so this is the check rather than a claim in a document.
 *
 * It reports what was GRANTED, not what was requested. Those differ when an
 * administrator restricts consent, and the difference is invisible until Ana
 * starts answering "nothing was said about that" for a reason that has nothing
 * to do with the question.
 *
 * No token value is ever returned. Only whether one exists and when it expires.
 */
export async function GET() {
  return guarded(async () => {
    const config = microsoftConfig();
    const stored = await readConnection();

    const base = {
      configured: config.ok,
      missingEnvironment: config.ok ? [] : config.missing,
      encryptionKey: hasEncryptionKey(),
      requestedScopes: [...GRAPH_SCOPES],
      // Stated positively so the owner's instruction is visible in the health
      // check and not only in a comment: these are never asked for.
      neverRequested: [...FORBIDDEN_SCOPES],
    };

    if (!stored.ok) {
      return { ...base, connected: false, reason: stored.reason };
    }

    const { connection } = stored;
    const expiresAt = connection.accessExpiresAt;
    return {
      ...base,
      connected: !connection.invalidatedAt,
      account: connection.accountUpn,
      accountName: connection.accountName,
      tenantId: connection.tenantId,
      grantedScopes: connection.grantedScopes,
      missingScopes: missingScopes(connection.grantedScopes),
      hasRefreshToken: Boolean(connection.refreshToken),
      accessTokenExpiresAt: expiresAt,
      accessTokenExpired: expiresAt ? Date.parse(expiresAt) <= Date.now() : true,
      invalidatedAt: connection.invalidatedAt,
      invalidatedReason: connection.invalidatedReason,
    };
  });
}
