import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./tokens";

/**
 * The encryption round trip. (ANA-04)
 *
 * What matters is less that encrypt/decrypt agree — they will — and more that
 * every way a stored value can be wrong yields null rather than garbage. A
 * mangled token that decrypts to noise produces a confusing 401 from Microsoft
 * an hour later; a null produces "not connected" immediately.
 */

const key = randomBytes(32);

describe("token encryption", () => {
  it("round-trips", () => {
    const token = "0.ARoA-refresh-token-payload-" + "x".repeat(200);
    expect(decryptToken(encryptToken(token, key), key)).toBe(token);
  });

  it("never emits the same ciphertext twice for one plaintext", () => {
    // A fresh random IV per call. Identical ciphertexts would let anyone with
    // two backups see that the token did not change between them.
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("yields null for a value encrypted under a different key", () => {
    const other = randomBytes(32);
    expect(decryptToken(encryptToken("secret", key), other)).toBeNull();
  });

  it("yields null for a tampered payload", () => {
    const stored = encryptToken("secret", key);
    const parts = stored.split(".");
    const payload = Buffer.from(parts[3], "base64url");
    payload[0] ^= 0xff;
    parts[3] = payload.toString("base64url");
    expect(decryptToken(parts.join("."), key)).toBeNull();
  });

  it("yields null for null, junk, and future formats", () => {
    expect(decryptToken(null, key)).toBeNull();
    expect(decryptToken("", key)).toBeNull();
    expect(decryptToken("not-encrypted-at-all", key)).toBeNull();
    expect(decryptToken("v2.a.b.c", key)).toBeNull();
  });
});
