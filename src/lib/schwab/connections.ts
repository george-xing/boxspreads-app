import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  encryptRefreshToken,
  decryptRefreshToken,
} from "@/lib/schwab/refresh-token-crypto";

export interface ConnectionRow {
  session_id: string;
  /**
   * Plaintext refresh token. Decrypted from storage by `findConnection`
   * before being returned. Callers should never see ciphertext — encryption
   * is an internal storage concern.
   */
  refresh_token: string;
  connected_at: string;
  last_refreshed_at: string | null;
}

/**
 * Internal shape returned by `select(...)` on the table — `refresh_token`
 * here is the encrypted blob (or legacy plaintext for un-migrated rows).
 */
interface StoredRow {
  session_id: string;
  refresh_token: string;
  connected_at: string;
  last_refreshed_at: string | null;
  key_version: number | null;
}

export async function upsertConnection(
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  const { ciphertext, keyVersion } = encryptRefreshToken(refreshToken);
  const { error } = await supabaseAdmin
    .from("schwab_connections")
    .upsert(
      {
        session_id: sessionId,
        refresh_token: ciphertext,
        key_version: keyVersion,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
  if (error) throw new Error(`upsertConnection: ${error.message}`);
}

/**
 * Update the refresh token for an existing row (e.g. after Schwab rotates
 * it during a `tm.refresh()` call). Encrypts before writing and refreshes
 * `last_refreshed_at` and `key_version` in the same statement.
 */
export async function updateRefreshToken(
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  const { ciphertext, keyVersion } = encryptRefreshToken(refreshToken);
  const { error } = await supabaseAdmin
    .from("schwab_connections")
    .update({
      refresh_token: ciphertext,
      key_version: keyVersion,
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw new Error(`updateRefreshToken: ${error.message}`);
}

/**
 * Delete every row EXCEPT the given session_id. Used by admin login to
 * reap stale refresh tokens from prior sessions — Phase 1 has exactly
 * one George connection at a time, so anything not matching is garbage.
 * Phase 2 would scope this to a user_id instead.
 */
export async function deleteOtherConnections(keepSessionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("schwab_connections")
    .delete()
    .neq("session_id", keepSessionId);
  if (error) throw new Error(`deleteOtherConnections: ${error.message}`);
}

/**
 * Distinguish "no row for this session" (returns null) from "Supabase is
 * broken" (throws). Callers like the client factory treat null as
 * disconnected, but a thrown error should bubble up as a 5xx so transient
 * DB failures aren't silently flattened into a disconnect.
 *
 * Uses `.maybeSingle()` rather than `.single()` so a missing row is a
 * data-level null (no error), not the PGRST116 sentinel. With RLS
 * enabled (migration 003), `.single()` would return PGRST116 for both
 * "no row" AND "RLS denied" — masking misconfigured policies as
 * "disconnected." `.maybeSingle()` makes the missing-row path explicit.
 *
 * Decryption happens here so callers receive a plaintext `refresh_token`
 * regardless of storage format. Legacy un-migrated plaintext rows pass
 * through unchanged (see `decryptRefreshToken`).
 */
export async function findConnection(
  sessionId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("schwab_connections")
    .select("session_id, refresh_token, connected_at, last_refreshed_at, key_version")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`findConnection: ${error.message}`);
  if (!data) return null;
  const row = data as StoredRow;
  return {
    session_id: row.session_id,
    refresh_token: decryptRefreshToken(row.refresh_token, row.key_version),
    connected_at: row.connected_at,
    last_refreshed_at: row.last_refreshed_at,
  };
}

/**
 * Cheap "do we have a row for this session" check. Does NOT touch Schwab,
 * does NOT refresh tokens, does NOT decrypt. Used by /api/schwab/status so
 * a page-load that mounts two status callers in parallel cannot race a
 * token refresh and cause a silent invalid_grant → deleteConnection →
 * spurious logout.
 */
export async function hasConnection(sessionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("schwab_connections")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`hasConnection: ${error.message}`);
  return data !== null;
}

export async function deleteConnection(sessionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("schwab_connections")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw new Error(`deleteConnection: ${error.message}`);
}
