# Session Context

## Current Work
Schwab API productization — transformed boxspreads.app from a Treasury-estimate calculator into a Schwab-connected SPX box spread optimizer. User enters target borrow amount → app ranks real strike-pair candidates from the live Schwab option chain → outputs a Schwab-pasteable order. End-to-end pipeline verified with live Schwab data (SPX @ $7,041.28, rates ~4.05-4.20%).

## Recent Changes
- `src/lib/schwab/` — client factory (EnhancedTokenManager), chain fetcher (direct REST, bypasses SDK Zod), computeCandidates ranker, types, connections data-access
- `src/app/api/schwab/` — status, chain, admin/login, disconnect routes
- `src/components/calculator/` — Calculator.tsx rewire, TargetBorrowInput, CandidatesPanel, ConnectStatus, ConnectBanner
- `src/components/order/` — LegTable (liveLegs with bid/ask), BrokerageGuide (Schwab-only)
- `src/app/admin/page.tsx` — form-based admin login (no URL params)
- `scripts/schwab-auth.mjs` — one-off OAuth helper for refresh token
- `supabase/migrations/002_schwab_connections.sql` — applied to prod Supabase
- `.env.local` — populated with Supabase, FRED, Schwab creds, session secret, admin key

## Stable Features
- Treasury yield curve (FRED API) works independently of Schwab connection
- Session cookie auth (HMAC-signed, HttpOnly) with Supabase schwab_connections table
- computeCandidates: round-number strikes (500pt multiples), mark-based rates, MIN_STRIKE_WIDTH=500
- After-hours detection + mark-price fallback in normalizer
- Admin login at /admin with password form (no URL key exposure)
- 98/98 tests pass

## Build
```bash
pnpm install && pnpm dev   # dev server (autoPort enabled)
pnpm test                  # 98 tests, vitest
```

## Key Patterns
- SDK used ONLY for auth (EnhancedTokenManager). Market data uses direct fetch() to avoid SDK Zod validation bugs.
- Raw Schwab API field names: `bid`/`ask`/`mark` (NOT `bidPrice`/`askPrice`/`markPrice`).
- Schwab zeroes `openInterest` after hours; `totalVolume` is the real activity indicator.
- `getSchwabClientForRequest()` returns `SchwabSession { getAccessToken() }`, not `SchwabApiClient`.

## Next Steps
1. Retest during market hours (9:30 AM – 4:00 PM ET) to see live bid/ask candidates + executable rates
2. Deploy to Vercel — set env vars (SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REFRESH_TOKEN, SESSION_SECRET, ADMIN_KEY)
3. Consider merging branch `claude/elated-chatterjee` to main via PR
4. Phase 2 prep: Schwab Commercial tier OAuth routes (scaffolded in design spec, not built yet)
