import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client built from the SERVICE_ROLE key. The service
 * role bypasses Row Level Security, so this client must NEVER be imported
 * by browser code — it would leak full database read/write to anyone who
 * cracks open the JS bundle.
 *
 * This client exists because `schwab_connections` stores long-lived Schwab
 * refresh tokens. Those tokens grant account-level read access to the
 * brokerage account they were minted against, so they cannot be readable
 * via the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` (which ships in the
 * client bundle). The matching migration enables RLS with no anon policy
 * on `schwab_connections`; the service role keeps server-side data access
 * working transparently.
 *
 * Import only from `src/lib/schwab/*` and from server-only API routes.
 * The browser-facing `src/lib/supabase.ts` (anon-key) is still fine for
 * read-only public tables like `treasury_rates`.
 */
let _admin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the admin client.",
      );
    }

    _admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        // Server-only client — no session persistence, no auto-refresh.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _admin;
}

/**
 * Lazy proxy that defers client construction until first table access.
 * Mirrors the shape of the anon proxy in `src/lib/supabase.ts` so call
 * sites read identically: `supabaseAdmin.from("schwab_connections")...`.
 */
export const supabaseAdmin = {
  from(table: string) {
    return getSupabaseAdmin().from(table);
  },
};
