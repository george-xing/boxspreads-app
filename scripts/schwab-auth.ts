/**
 * One-shot Schwab auth flow. Run with: `npx tsx scripts/schwab-auth.ts`.
 *
 * Requires in .env.local:
 *   SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REDIRECT_URI (https://127.0.0.1:3000/callback)
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { EnhancedTokenManager } from "@sudowealth/schwab-api";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "node:http";
import { URL } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

const {
  SCHWAB_APP_KEY,
  SCHWAB_APP_SECRET,
  SCHWAB_REDIRECT_URI,
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
} = process.env;

if (
  !SCHWAB_APP_KEY ||
  !SCHWAB_APP_SECRET ||
  !SCHWAB_REDIRECT_URI ||
  !NEXT_PUBLIC_SUPABASE_URL ||
  !NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  console.error("Missing required env vars. See .env.local.example.");
  process.exit(1);
}

async function main() {
  const tokenManager = new EnhancedTokenManager({
    clientId: SCHWAB_APP_KEY!,
    clientSecret: SCHWAB_APP_SECRET!,
    redirectUri: SCHWAB_REDIRECT_URI!,
  });

  const { authUrl } = await tokenManager.getAuthorizationUrl();
  console.log("\n1. Open this URL in your browser and log in to Schwab:\n");
  console.log(authUrl);
  console.log("\n2. After approval, you'll be redirected to the callback URL.");
  console.log("   This script will capture the code and exchange it.\n");

  const code: string = await new Promise((resolve, reject) => {
    const redirect = new URL(SCHWAB_REDIRECT_URI!);
    const server = createServer((req, res) => {
      if (!req.url) return;
      const reqUrl = new URL(req.url, `http://${req.headers.host}`);
      const got = reqUrl.searchParams.get("code");
      if (got) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Code received. You can close this tab.");
        server.close();
        resolve(got);
      } else {
        res.writeHead(400).end("Missing code");
      }
    });
    server.on("error", reject);
    server.listen(Number(redirect.port || 3000), "127.0.0.1");
  });

  const tokens = await tokenManager.exchangeCode(code);
  if (!tokens.refreshToken) {
    throw new Error("No refresh token in exchange response");
  }

  const supabase = createClient(
    NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await supabase.from("schwab_tokens").upsert(
    {
      id: "singleton",
      refresh_token: tokens.refreshToken,
      updated_at: new Date().toISOString(),
      invalid_at: null,
    },
    { onConflict: "id" }
  );
  if (error) throw error;

  console.log("\u2713 Refresh token saved to Supabase. App is ready.");
}

main().catch((err) => {
  console.error("Auth failed:", err);
  process.exit(1);
});
