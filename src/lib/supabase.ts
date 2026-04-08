import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

// Lazy singleton — resolves env vars at call time, not at module import time.
// This prevents build-time errors when env vars are not available.
function getSupabase(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
      );
    }

    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// Proxy that defers client creation to first use
export const supabase = {
  from(table: string) {
    return getSupabase().from(table);
  },
};
