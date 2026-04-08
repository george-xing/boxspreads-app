import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createClient<any>> | null = null;

// Lazy singleton — resolves env vars at call time, not at module import time.
// This prevents build-time errors when env vars are not available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): ReturnType<typeof createClient<any>> {
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

// Re-export a convenience alias for modules that prefer the named import.
export const supabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => getSupabase().from(table) as any,
};
