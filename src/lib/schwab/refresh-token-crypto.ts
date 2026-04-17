import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Envelope encryption for Schwab refresh tokens.
 *
 * Refresh tokens grant account-level read access to the Schwab brokerage
 * account they were minted against. RLS keeps anon clients out of
 * `schwab_connections`, but a Supabase compromise (leaked service-role
 * key, backup exfil, support-tool snapshot, etc.) would still expose the
 * tokens at rest. AEAD with a key held outside the database limits the
 * blast radius — an attacker needs both the DB row and `REFRESH_TOKEN_KMS_KEY`.
 *
 * AES-256-GCM via `node:crypto`. Output format is a sentinel-prefixed,
 * base64url-encoded triple that records the key version so we can
 * rotate without re-encrypting in lockstep:
 *
 *     enc:v1:<base64url(iv ‖ ciphertext ‖ authTag)>
 *
 * The `enc:v<N>:` sentinel is also how the data-migration script tells
 * an already-encrypted row from a plaintext one (idempotency).
 */

const SENTINEL_PREFIX = "enc:";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;

export const CURRENT_KEY_VERSION = 1;

function loadKeyForVersion(version: number): Buffer {
  if (version !== 1) {
    // Add a key-rotation map here when v2 is introduced. For now we have
    // exactly one key, sourced from REFRESH_TOKEN_KMS_KEY.
    throw new Error(`refresh-token-crypto: unknown key_version ${version}`);
  }
  const raw = process.env.REFRESH_TOKEN_KMS_KEY;
  if (!raw) {
    throw new Error(
      "REFRESH_TOKEN_KMS_KEY env var is required (32 raw bytes, base64-encoded)",
    );
  }
  // Accept either standard base64 or base64url; Node's "base64" decoder
  // handles both via padding tolerance — but we do it manually so a bad
  // value fails loudly at construct-time rather than at first encrypt.
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `REFRESH_TOKEN_KMS_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        `Generate with: openssl rand -base64 32`,
    );
  }
  return key;
}

/**
 * Encrypt a plaintext refresh token. Returns an opaque sentinel-prefixed
 * string safe to store in the existing `refresh_token text` column.
 *
 * Uses the current key version (`CURRENT_KEY_VERSION`). Callers should
 * also persist `key_version` alongside the ciphertext so a future
 * rotation can decrypt old rows with the old key.
 */
export function encryptRefreshToken(plaintext: string): {
  ciphertext: string;
  keyVersion: number;
} {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptRefreshToken: plaintext must be a non-empty string");
  }
  const keyVersion = CURRENT_KEY_VERSION;
  const key = loadKeyForVersion(keyVersion);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) {
    // Defense in depth — Node guarantees 16-byte tags by default.
    throw new Error(`unexpected GCM tag length ${tag.length}`);
  }
  const blob = Buffer.concat([iv, enc, tag]).toString("base64url");
  return {
    ciphertext: `${SENTINEL_PREFIX}v${keyVersion}:${blob}`,
    keyVersion,
  };
}

/**
 * Returns true if the value looks like an `enc:v<N>:...` ciphertext blob
 * we produced. Used by the data-migration script to skip already-encrypted
 * rows on retry, and by `decryptRefreshToken` to no-op on legacy plaintext.
 */
export function isEncryptedRefreshToken(value: string): boolean {
  return /^enc:v\d+:[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Decrypt a stored refresh token. If `value` is plaintext (no sentinel),
 * returns it unchanged so legacy rows keep working until the data-
 * migration script runs against them. After the migration, every row
 * in production should be encrypted — but the no-op fallback means a
 * partial migration cannot cause an outage.
 */
export function decryptRefreshToken(
  value: string,
  storedKeyVersion?: number | null,
): string {
  if (!isEncryptedRefreshToken(value)) {
    // Legacy plaintext — return as-is. Once the data-migration script
    // has run end-to-end against an environment, this branch should be
    // unreachable for that environment.
    return value;
  }

  // Parse `enc:v<N>:<blob>`. Prefer the version embedded in the blob over
  // the column value — they should always match, but the embedded form
  // is the cryptographic ground truth.
  const match = value.match(/^enc:v(\d+):(.+)$/);
  if (!match) {
    throw new Error("decryptRefreshToken: malformed ciphertext header");
  }
  const embeddedVersion = Number(match[1]);
  if (
    storedKeyVersion != null &&
    storedKeyVersion !== embeddedVersion
  ) {
    throw new Error(
      `decryptRefreshToken: key_version column (${storedKeyVersion}) ` +
        `disagrees with embedded version (${embeddedVersion})`,
    );
  }
  const key = loadKeyForVersion(embeddedVersion);
  const blob = Buffer.from(match[2], "base64url");
  if (blob.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("decryptRefreshToken: ciphertext too short");
  }
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const enc = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  // .final() throws "Unsupported state or unable to authenticate data"
  // on tag mismatch (wrong key, tampered ciphertext) — this is the
  // AEAD integrity check.
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
