#!/usr/bin/env node
// One-off Schwab OAuth helper for Phase 1 (George only).
//
// Purpose: complete the Schwab authorization-code flow once, extract the
// resulting refresh_token, and print it so you can paste into .env.local
// as SCHWAB_REFRESH_TOKEN. Refresh tokens last 7 days; re-run this script
// before each expiry (or after any account password change).
//
// Usage:
//   SCHWAB_APP_KEY=... SCHWAB_APP_SECRET=... node scripts/schwab-auth.mjs
//
// Prerequisite: register an app at developer.schwab.com with the callback
// URL set to exactly "https://127.0.0.1" (no port, no trailing slash).
// That's what we pass as redirectUri below; Schwab requires an exact match.

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createSchwabAuth } from "@sudowealth/schwab-api";

const clientId = process.env.SCHWAB_APP_KEY;
const clientSecret = process.env.SCHWAB_APP_SECRET;
const redirectUri = process.env.SCHWAB_REDIRECT_URI ?? "https://127.0.0.1";

if (!clientId || !clientSecret) {
  console.error("Error: set SCHWAB_APP_KEY and SCHWAB_APP_SECRET env vars first.");
  console.error("Example:");
  console.error("  SCHWAB_APP_KEY=xxx SCHWAB_APP_SECRET=yyy node scripts/schwab-auth.mjs");
  process.exit(1);
}

const auth = createSchwabAuth({
  oauthConfig: { clientId, clientSecret, redirectUri },
});

const { authUrl } = await auth.getAuthorizationUrl();

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Schwab OAuth flow — Phase 1 setup");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("Step 1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\nStep 2. Log into Schwab and authorize the app.");
console.log("\nStep 3. Your browser will redirect to " + redirectUri + " and probably show");
console.log("        'This site can't be reached' — that is expected.");
console.log("        Copy the FULL URL from the address bar (contains ?code=...).\n");

const rl = readline.createInterface({ input, output });
const redirectUrl = (await rl.question("Paste the full redirect URL here: ")).trim();
rl.close();

let code;
try {
  const u = new URL(redirectUrl);
  code = u.searchParams.get("code");
} catch {
  console.error("\n✗ That did not look like a valid URL. Expected something like:");
  console.error("   https://127.0.0.1/?code=C0.b2F1dGgyLmJkYy5z...%40...&session=...");
  process.exit(1);
}

if (!code) {
  console.error("\n✗ No ?code= parameter in that URL. Try again from Step 1.");
  process.exit(1);
}

console.log("\nExchanging code for tokens…");
let tokens;
try {
  tokens = await auth.exchangeCode(code);
} catch (err) {
  console.error("\n✗ Exchange failed:", err instanceof Error ? err.message : err);
  console.error("  Common causes: code already used, expired (>30s), or clientId/Secret wrong.");
  process.exit(1);
}

if (!tokens.refreshToken) {
  console.error("\n✗ Schwab returned tokens without a refresh_token.");
  console.error("  Make sure your Schwab app has 'offline_access' scope enabled.");
  process.exit(1);
}

console.log("\n✓ Success!\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Add this line to your .env.local:");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log(`SCHWAB_REFRESH_TOKEN=${tokens.refreshToken}\n`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("This token is valid for 7 days. Re-run this script before it expires.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
