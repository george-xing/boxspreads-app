# Security & ranking follow-ups

Tracked items deferred from the Apr 16 review pass. Each is too large to
land in the same PR as the dead-code/UX cleanup, but should be planned
before any non-Phase-1 (i.e. multi-user) deployment.

## H1 — Refresh tokens stored plaintext, anon-key-readable — DONE

Shipped in `claude/h1-encrypt-refresh-tokens` (see PR description for the
operator runbook).

What landed:
- `src/lib/supabase-admin.ts` — server-only client built from
  `SUPABASE_SERVICE_ROLE_KEY`. All `src/lib/schwab/*` data-access flows
  through it. The browser-side anon client (`src/lib/supabase.ts`) is
  now used only by `treasury_rates`.
- `supabase/migrations/003_schwab_connections_rls.sql` — enables RLS on
  `schwab_connections`, adds explicit restrictive `no_anon_access` and
  `no_authenticated_access` policies, and adds the `key_version` column.
  Idempotent; safe to run against a Supabase that already has data.
- `src/lib/schwab/refresh-token-crypto.ts` — AES-256-GCM envelope
  encryption with sentinel-prefixed (`enc:v<N>:<base64url>`) ciphertext.
  Key sourced from `REFRESH_TOKEN_KMS_KEY` (32 bytes, base64). Encrypts
  on upsert / refresh-rotation; decrypts inside `findConnection`.
  Round-trip + wrong-key + tampered-ciphertext + legacy-passthrough tests.
- `scripts/encrypt-existing-refresh-tokens.mjs` — idempotent one-shot
  data migration. Skips already-encrypted rows by sentinel detection.
  Supports `--dry-run`.

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
