import { supabase } from "@/lib/supabase";

// PostgREST error code for "no rows returned" (Supabase lookup returned empty).
// This is an expected "not found" case; all OTHER errors are real failures.
const PG_NOT_FOUND = "PGRST116";

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
 */
export async function findConnection(
  sessionId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from("schwab_connections")
    .select("session_id, refresh_token, connected_at, last_refreshed_at")
    .eq("session_id", sessionId)
    .single();
  if (error) {
    if (error.code === PG_NOT_FOUND) return null;
    throw new Error(`findConnection: ${error.message}`);
  }
  if (!data) return null;
  return data as ConnectionRow;
}

export async function deleteConnection(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("schwab_connections")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw new Error(`deleteConnection: ${error.message}`);
}
