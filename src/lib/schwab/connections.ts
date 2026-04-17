import { supabase } from "@/lib/supabase";

export interface ConnectionRow {
  session_id: string;
  refresh_token: string;
  connected_at: string;
  last_refreshed_at: string | null;
}

export async function upsertConnection(
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  const { error } = await supabase
    .from("schwab_connections")
    .upsert(
      {
        session_id: sessionId,
        refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
  if (error) throw new Error(`upsertConnection: ${error.message}`);
}

/**
 * Delete every row EXCEPT the given session_id. Used by admin login to
 * reap stale refresh tokens from prior sessions — Phase 1 has exactly
 * one George connection at a time, so anything not matching is garbage.
 * Phase 2 would scope this to a user_id instead.
 */
export async function deleteOtherConnections(keepSessionId: string): Promise<void> {
  const { error } = await supabase
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
 * data-level null (no error), not the PGRST116 sentinel. Once RLS is
 * enabled (TODO: H1), `.single()` would return PGRST116 for both
 * "no row" AND "RLS denied" — masking misconfigured policies as
 * "disconnected." `.maybeSingle()` makes the missing-row path explicit.
 */
export async function findConnection(
  sessionId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from("schwab_connections")
    .select("session_id, refresh_token, connected_at, last_refreshed_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`findConnection: ${error.message}`);
  return (data as ConnectionRow | null) ?? null;
}

/**
 * Cheap "do we have a row for this session" check. Does NOT touch Schwab,
 * does NOT refresh tokens. Used by /api/schwab/status so a page-load that
 * mounts two status callers in parallel cannot race a token refresh and
 * cause a silent invalid_grant → deleteConnection → spurious logout.
 */
export async function hasConnection(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("schwab_connections")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`hasConnection: ${error.message}`);
  return data !== null;
}

export async function deleteConnection(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("schwab_connections")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw new Error(`deleteConnection: ${error.message}`);
}
