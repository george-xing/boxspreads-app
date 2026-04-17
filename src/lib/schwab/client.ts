import { EnhancedTokenManager } from "@sudowealth/schwab-api";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
  getSessionSecret,
} from "@/lib/session";
import { findConnection, deleteConnection } from "@/lib/schwab/connections";
import { supabase } from "@/lib/supabase";

/**
 * SchwabSession is what the rest of the app gets back when a request is
 * Schwab-connected. It wraps an EnhancedTokenManager (ETM) and exposes a
 * narrow surface: `getAccessToken()` returns a fresh bearer token, auto-
 * refreshing via the stored refresh_token when needed.
 *
 * We deliberately do NOT return the SDK's full `SchwabApiClient` here —
 * its built-in Zod response validator chokes on some real SPX responses
 * (e.g. `exchangeName: "Index"`, which is not in the SDK's enum). Market
 * data is fetched via direct `fetch()` in `chain.ts` using this access
 * token. The SDK is still the right tool for OAuth / PKCE / refresh.
 */
export interface SchwabSession {
  getAccessToken(): Promise<string>;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    if (p.slice(0, eq) === name) return decodeURIComponent(p.slice(eq + 1));
  }
  return null;
}

export async function getSchwabClientForRequest(
  req: Request,
): Promise<SchwabSession | null> {
  // 1. Read + verify session cookie
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  if (!cookie) return null;

  const sessionId = verifySessionCookie(cookie, getSessionSecret());
  if (!sessionId) return null;

  // 2. Look up connection row in Supabase
  const row = await findConnection(sessionId);
  if (!row) return null;

  // 3. Read app creds
  const clientId = process.env.SCHWAB_APP_KEY;
  const clientSecret = process.env.SCHWAB_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SCHWAB_APP_KEY / SCHWAB_APP_SECRET env vars required");
  }

  // 4. Build ETM. `load` lets ETM pull the refresh_token from Supabase if
  //    its in-memory token expires mid-request; `save` writes back any
  //    rotated refresh token so Phase 2 users get persistent sessions.
  const tm = new EnhancedTokenManager({
    clientId,
    clientSecret,
    redirectUri: "https://127.0.0.1",
    load: async () => ({
      accessToken: "",
      refreshToken: row.refresh_token,
      expiresAt: 0, // force refresh on first use
    }),
    save: async (tokens) => {
      if (tokens.refreshToken) {
        await supabase
          .from("schwab_connections")
          .update({
            refresh_token: tokens.refreshToken,
            last_refreshed_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId);
      }
    },
  });

  // 5. Force an initial refresh so we fail fast on bad/expired tokens —
  //    rather than letting the first downstream API call 401 deep in the
  //    chain-fetch code. If this throws invalid_grant, the refresh token
  //    is dead (Schwab revoked, >7 days old, etc.); clear Supabase so
  //    the user sees a clean disconnected UI.
  try {
    await tm.refresh(row.refresh_token, { force: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("invalid_grant") || msg.includes("unauthorized")) {
      await deleteConnection(sessionId);
      return null;
    }
    throw err;
  }

  return {
    async getAccessToken(): Promise<string> {
      const token = await tm.getAccessToken();
      if (!token) throw new Error("no_access_token");
      return token;
    },
  };
}
