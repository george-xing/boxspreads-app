#!/usr/bin/env node
/**
 * One-shot data migration: re-store every plaintext `refresh_token` in
 * `schwab_connections` as AES-256-GCM ciphertext under the current
 * REFRESH_TOKEN_KMS_KEY.
 *
 * Idempotent — rows that already look like `enc:v<N>:...` are skipped.
 * Safe to re-run after a partial failure or after rotating the key
 * (rotation will require a different script that decrypts-then-re-encrypts;
 * this one only handles plaintext → v1).
 *
 * Run AFTER:
 *   1. `supabase/migrations/003_schwab_connections_rls.sql` is applied
 *      (so the `key_version` column exists and RLS blocks anon).
 *   2. `REFRESH_TOKEN_KMS_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set
 *      in the runtime env.
 *
 * Usage:
 *   node scripts/encrypt-existing-refresh-tokens.mjs           # do it
 *   node scripts/encrypt-existing-refresh-tokens.mjs --dry-run # report only
 */

import { createCipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

function die(msg) {
  console.error(`encrypt-existing-refresh-tokens: ${msg}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const kmsKeyB64 = process.env.REFRESH_TOKEN_KMS_KEY;

if (!supabaseUrl) die("NEXT_PUBLIC_SUPABASE_URL is required");
if (!serviceRoleKey) die("SUPABASE_SERVICE_ROLE_KEY is required");
if (!kmsKeyB64) die("REFRESH_TOKEN_KMS_KEY is required (openssl rand -base64 32)");

const kmsKey = Buffer.from(kmsKeyB64, "base64");
if (kmsKey.length !== 32) {
  die(
    `REFRESH_TOKEN_KMS_KEY must decode to 32 bytes (got ${kmsKey.length}). ` +
      `Generate with: openssl rand -base64 32`,
  );
}

const SENTINEL_RE = /^enc:v\d+:[A-Za-z0-9_-]+$/;
const KEY_VERSION = 1;

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kmsKey, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, enc, tag]).toString("base64url");
  return `enc:v${KEY_VERSION}:${blob}`;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await supabase
  .from("schwab_connections")
  .select("session_id, refresh_token, key_version");

if (error) die(`select failed: ${error.message}`);
if (!rows || rows.length === 0) {
  console.log("no rows in schwab_connections — nothing to do.");
  process.exit(0);
}

let encrypted = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const looksEncrypted =
    typeof row.refresh_token === "string" && SENTINEL_RE.test(row.refresh_token);
  if (looksEncrypted) {
    skipped++;
    console.log(`skip ${row.session_id}: already encrypted (key_version=${row.key_version ?? "null"})`);
    continue;
  }
  if (typeof row.refresh_token !== "string" || row.refresh_token.length === 0) {
    failed++;
    console.error(`skip ${row.session_id}: empty/non-string refresh_token`);
    continue;
  }
  const ciphertext = encrypt(row.refresh_token);
  if (DRY_RUN) {
    encrypted++;
    console.log(`would encrypt ${row.session_id} (plaintext len=${row.refresh_token.length})`);
    continue;
  }
  const { error: updateErr } = await supabase
    .from("schwab_connections")
    .update({ refresh_token: ciphertext, key_version: KEY_VERSION })
    .eq("session_id", row.session_id);
  if (updateErr) {
    failed++;
    console.error(`FAIL ${row.session_id}: ${updateErr.message}`);
    continue;
  }
  encrypted++;
  console.log(`encrypted ${row.session_id}`);
}

console.log(
  `\ndone — encrypted=${encrypted} skipped=${skipped} failed=${failed} ` +
    `(dry_run=${DRY_RUN ? "yes" : "no"})`,
);
process.exit(failed > 0 ? 1 : 0);
