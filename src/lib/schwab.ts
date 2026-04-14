import {
  createApiClient,
  EnhancedTokenManager,
  type SchwabApiClient,
} from "@sudowealth/schwab-api";
import { supabase } from "./supabase";

const SINGLETON_ID = "singleton";

interface TokenRow {
  refresh_token: string;
  updated_at: string;
  invalid_at: string | null;
}

let _client: SchwabApiClient | null = null;
let _lastLoadedUpdatedAt: string | null = null;

async function loadTokenRow(): Promise<TokenRow | null> {
  const { data, error } = await supabase
    .from("schwab_tokens")
    .select("refresh_token, updated_at, invalid_at")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error) throw error;
  return (data as TokenRow | null) ?? null;
}

function getConfig() {
  const clientId = process.env.SCHWAB_APP_KEY;
  const clientSecret = process.env.SCHWAB_APP_SECRET;
  const redirectUri = process.env.SCHWAB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Schwab env: SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REDIRECT_URI"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function getSchwabClient(): SchwabApiClient {
  if (_client) return _client;
  const { clientId, clientSecret, redirectUri } = getConfig();

  const tokenManager = new EnhancedTokenManager({
    clientId,
    clientSecret,
    redirectUri,
    load: async () => {
      const row = await loadTokenRow();
      if (!row) return null;
      if (row.invalid_at) {
        const err = new Error(
          "Schwab refresh token is invalid; re-run scripts/schwab-auth.ts"
        );
        err.name = "SchwabAuthError";
        throw err;
      }
      _lastLoadedUpdatedAt = row.updated_at;
      return {
        accessToken: "",
        refreshToken: row.refresh_token,
        expiresAt: 0,
      };
    },
    save: async (tokens) => {
      if (!tokens.refreshToken) return;
      if (_lastLoadedUpdatedAt) {
        const { data, error } = await supabase
          .from("schwab_tokens")
          .update({
            refresh_token: tokens.refreshToken,
            updated_at: new Date().toISOString(),
            invalid_at: null,
          })
          .eq("id", SINGLETON_ID)
          .eq("updated_at", _lastLoadedUpdatedAt)
          .select("updated_at")
          .maybeSingle();
        if (error) throw error;
        if (data) {
          _lastLoadedUpdatedAt = (data as { updated_at: string }).updated_at;
          return;
        }
        const fresh = await loadTokenRow();
        if (fresh) _lastLoadedUpdatedAt = fresh.updated_at;
        return;
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("schwab_tokens").upsert(
        {
          id: SINGLETON_ID,
          refresh_token: tokens.refreshToken,
          updated_at: now,
          invalid_at: null,
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      _lastLoadedUpdatedAt = now;
    },
  });

  _client = createApiClient({ auth: tokenManager });
  return _client;
}

export async function markRefreshTokenInvalid(): Promise<void> {
  await supabase
    .from("schwab_tokens")
    .update({ invalid_at: new Date().toISOString() })
    .eq("id", SINGLETON_ID);
}
