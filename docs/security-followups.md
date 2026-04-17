# Security & ranking follow-ups

Tracked items deferred from the Apr 16 review pass. Each is too large to
land in the same PR as the dead-code/UX cleanup, but should be planned
before any non-Phase-1 (i.e. multi-user) deployment.

## H1 — Refresh tokens stored plaintext, anon-key-readable

**Files:** `src/lib/supabase.ts`, `supabase/migrations/002_schwab_connections.sql`,
`src/lib/schwab/connections.ts`, `src/lib/schwab/client.ts`.

The `schwab_connections` table has no row-level security, and the singleton
Supabase client is built with `NEXT_PUBLIC_SUPABASE_ANON_KEY` — a key shipped
in the public JS bundle. Anyone can `select * from schwab_connections` via
PostgREST and exfiltrate the long-lived Schwab refresh token, which grants
account-level read access until revoked.

**Fix plan:**
1. Add a server-only Supabase client built from `SUPABASE_SERVICE_ROLE_KEY`
   (introduce as a new env var; do NOT expose with `NEXT_PUBLIC_`). Use it
   from every `src/lib/schwab/*` data-access call. The browser-side anon
   client should only ever touch `treasury_rates` (already public-safe).
2. Migration: `alter table schwab_connections enable row level security;`
   plus an explicit no-anon policy. The service-role key bypasses RLS, so
   server code keeps working.
3. Envelope-encrypt `refresh_token` before insert. AEAD with a key from
   `REFRESH_TOKEN_KMS_KEY` (32 raw bytes, base64-encoded env var).
   Decrypt only inside `findConnection()`. Plan a key-rotation path that
   stores `key_version` alongside ciphertext.

**Why deferred:** requires a Supabase migration, a new env var in every
deploy slot, and a one-time data migration to encrypt existing rows. Not
safe to land alongside a UX cleanup.

## H2 — Forced-refresh race (silent logout)

**Status:** PARTIALLY MITIGATED by `hasActiveSession()` (this PR).

`/api/schwab/status` no longer triggers a token refresh, so the common
"two status callers race on page load" path is gone. But two **chain**
requests in parallel (e.g. user clicks refresh then immediately changes
expiration) can still race the rotated token. To fully close it:

1. Add a per-`session_id` in-process refresh lock around the
   `tm.refresh()` call in `getSchwabClientForRequest`.
2. Before deleting on `invalid_grant`, re-`findConnection` and try the
   newly-stored refresh token once — the parallel request may have
   already rotated successfully.

## H3 — After-hours candidate corruption — DONE

After hours the normalizer synthesized `bid = ask = mark`, so the
ranker's `spreadWidth` was mechanically zero for every candidate, the
spread penalty term was a silent no-op, and the ranker degenerated into
"highest raw rate wins" — which on SPX picked deep-ITM/OTM strikes
(e.g. 1000/2000 when spot was $7,041) over realistic ATM combos.

Fix landed:
- `ChainContract` and `CandidateLeg` now carry both synthesized
  `bid`/`ask` (used by ranker) and `liveBid`/`liveAsk` (real Schwab
  quote, nullable after-hours).
- `compute-candidates` returns `spreadWidth: null` and skips the spread
  penalty entirely when `chain.isAfterHours` is true. Score becomes
  `rate − liquidityPenalty`.
- `LegTable` reads `liveBid`/`liveAsk` and renders "—" after-hours
  rather than the misleading bid==ask synthesized values.

## H3-bis — Zero-mark / stale-mark mid-market — DONE

Replaced `c.mark ?? c.closePrice ?? c.last ?? null` in `chain.ts` with
an explicit positive-value check — `mark > 0`, then `closePrice > 0`,
then `last > 0`, else null — so a literal `0` mark falls through to the
next field instead of being treated as a real quote.

## Notes on what shipped in this pass

- M1 (dead `lastKnownCache`) — DELETED.
- M2 (dead `UnifiedCalculator`, `BrokerageCTA`) — DELETED.
- M3 (`.single()` → `.maybeSingle()`) — DONE.
- M4 (admin-login oracle) — collapsed 500/403 into single 403.
- M5 (chain 401 leaves cookie) — chain 401 now `Set-Cookie`s a clear.
- M6 (Schwab error body leak) — body no longer included in thrown message.
- M7 (`totalVolume` ignored after-hours) — normalizer + ranker now use
  `totalVolume` as the liquidity signal when `isAfterHours` is true.
