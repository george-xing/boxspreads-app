import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptRefreshToken,
  decryptRefreshToken,
  isEncryptedRefreshToken,
  CURRENT_KEY_VERSION,
} from "@/lib/schwab/refresh-token-crypto";

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");

describe("refresh-token-crypto", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.REFRESH_TOKEN_KMS_KEY;
    process.env.REFRESH_TOKEN_KMS_KEY = KEY_A;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.REFRESH_TOKEN_KMS_KEY;
    else process.env.REFRESH_TOKEN_KMS_KEY = originalKey;
  });

  it("round-trips plaintext through encrypt/decrypt", async () => {
    const plaintext = "schwab-refresh-token-abc123";
    const { ciphertext, keyVersion } = encryptRefreshToken(plaintext);
    expect(keyVersion).toBe(CURRENT_KEY_VERSION);
    expect(ciphertext.startsWith(`enc:v${CURRENT_KEY_VERSION}:`)).toBe(true);
    expect(ciphertext).not.toContain(plaintext);
    const decrypted = decryptRefreshToken(ciphertext, keyVersion);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const plaintext = "same-input";
    const a = encryptRefreshToken(plaintext);
    const b = encryptRefreshToken(plaintext);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    // Both still decrypt back to the same value.
    expect(decryptRefreshToken(a.ciphertext)).toBe(plaintext);
    expect(decryptRefreshToken(b.ciphertext)).toBe(plaintext);
  });

  it("decrypt with the wrong key fails (AEAD authentication)", async () => {
    const plaintext = "secret";
    const { ciphertext } = encryptRefreshToken(plaintext);
    // Swap the key under us — simulates a key rotation done badly, or
    // an attacker who has the ciphertext but not REFRESH_TOKEN_KMS_KEY.
    process.env.REFRESH_TOKEN_KMS_KEY = KEY_B;
    expect(() => decryptRefreshToken(ciphertext)).toThrow();
  });

  it("decrypt of tampered ciphertext fails (auth tag mismatch)", async () => {
    const { ciphertext } = encryptRefreshToken("plaintext");
    // Flip a byte in the middle of the encoded blob. The exact position
    // doesn't matter — GCM detects any change.
    const [, , blob] = ciphertext.split(":");
    const buf = Buffer.from(blob, "base64url");
    buf[Math.floor(buf.length / 2)] ^= 0xff;
    const tampered = `enc:v1:${buf.toString("base64url")}`;
    expect(() => decryptRefreshToken(tampered)).toThrow();
  });

  it("decryptRefreshToken passes through legacy plaintext unchanged", async () => {
    // Pre-migration rows have no sentinel — they must keep working until
    // the data-migration script encrypts them in place.
    expect(decryptRefreshToken("not-encrypted-yet")).toBe("not-encrypted-yet");
  });

  it("isEncryptedRefreshToken recognizes the sentinel format only", async () => {
    const { ciphertext } = encryptRefreshToken("x");
    expect(isEncryptedRefreshToken(ciphertext)).toBe(true);
    expect(isEncryptedRefreshToken("plain-token")).toBe(false);
    expect(isEncryptedRefreshToken("enc:v1:")).toBe(false);
    expect(isEncryptedRefreshToken("enc:vX:abc")).toBe(false);
  });

  it("rejects key_version mismatch between column and embedded header", async () => {
    const { ciphertext } = encryptRefreshToken("x");
    // Column says v2, blob says v1 — refuse rather than silently use one.
    expect(() => decryptRefreshToken(ciphertext, 2)).toThrow(
      /key_version column \(2\) disagrees with embedded version \(1\)/,
    );
  });

  it("encrypt with missing/short key throws clearly", async () => {
    delete process.env.REFRESH_TOKEN_KMS_KEY;
    expect(() => encryptRefreshToken("x")).toThrow(/REFRESH_TOKEN_KMS_KEY/);
    process.env.REFRESH_TOKEN_KMS_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptRefreshToken("x")).toThrow(/must decode to 32 bytes/);
  });

  it("encrypt rejects empty plaintext", async () => {
    expect(() => encryptRefreshToken("")).toThrow();
  });
});
