import { createApiClient } from "@sudowealth/schwab-api";
import type { SchwabApiClient } from "@sudowealth/schwab-api";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
  getSessionSecret,
} from "@/lib/session";
import { findConnection, deleteConnection } from "@/lib/schwab/connections";
import { supabase } from "@/lib/supabase";

export type { SchwabApiClient };

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
): Promise<SchwabApiClient | null> {
  // 1. Read and verify session cookie
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  if (!cookie) return null;

  const sessionId = verifySessionCookie(cookie, getSessionSecret());
  if (!sessionId) return null;

  // 2. Look up connection row in Supabase
  const row = await findConnection(sessionId);
  if (!row) return null;

  // 3. Check env vars
  const clientId = process.env.SCHWAB_APP_KEY;
  const clientSecret = process.env.SCHWAB_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SCHWAB_APP_KEY / SCHWAB_APP_SECRET env vars required");
  }

  // 4. Build client with token load/save wired to Supabase
  try {
    const client = await createApiClient({
      auth: {
        oauthConfig: {
          clientId,
          clientSecret,
          redirectUri: "https://127.0.0.1", // required by SDK; unused in server-side refresh
          load: async () => ({
            accessToken: "", // empty — forces refresh from refreshToken
            refreshToken: row.refresh_token,
            expiresAt: 0, // expired — triggers immediate refresh
          }),
          save: async (tokens: {
            accessToken: string;
            refreshToken?: string;
            expiresAt?: number;
          }) => {
            // Persist rotated refresh token back to Supabase
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
        },
      },
    });
    return client;
  } catch (err) {
    // If refresh token is expired/revoked, Schwab returns invalid_grant
    if (err instanceof Error && err.message.includes("invalid_grant")) {
      await deleteConnection(sessionId);
      return null;
    }
    throw err;
  }
}
