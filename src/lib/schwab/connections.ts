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

export async function findConnection(
  sessionId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from("schwab_connections")
    .select("session_id, refresh_token, connected_at, last_refreshed_at")
    .eq("session_id", sessionId)
    .single();
  if (error || !data) return null;
  return data as ConnectionRow;
}

export async function deleteConnection(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("schwab_connections")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw new Error(`deleteConnection: ${error.message}`);
}
