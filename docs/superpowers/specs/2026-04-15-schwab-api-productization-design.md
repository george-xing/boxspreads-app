# Schwab API Productization — Design

**Date:** 2026-04-15
**Branch:** `claude/elated-chatterjee`
**Status:** Design approved; implementation plan to follow.
**Supersedes (partially):** `docs/superpowers/plans/2026-04-14-schwab-api-integration.md`.

## 1. Product framing

boxspreads.app becomes a **Schwab-connected SPX box spread optimizer**. The user gives a target borrow amount; the app returns ranked strike-pair candidates and a Schwab-pasteable order, using real option chain data.

This reframes the product from a *calculator* ("I'll do the math given your inputs") to a *quote optimizer* ("tell me what you want, I'll find the best way to do it"). Strike width and contract count are implementation details the app chooses — not user inputs.

### Two user states

**Connected (Schwab linked):** full optimizer with live chain data. Today's only connected user is George, via a dev auth path (admin cookie route + env-held refresh token). Post Commercial-tier approval, standard Schwab OAuth populates the same session.

**Not connected:** page renders with:
- **Kept** — yield curve, per-expiration Treasury-estimate rates, target-borrow input, tax rates, and aggregate estimated pre/after-tax rate + interest cost + tax savings for the chosen target. These are real math on real data.
- **Empty-state panels** — candidates and the pastable order. Each has its own Connect CTA.
- **Nav bar** — a disabled "+ Connect Schwab · coming soon" button (active post-Commercial).
- **Explain bar** — one blue banner near the top naming what connection unlocks.

No fake strikes, no fabricated open interest, no invented option symbols.

### Primary user flow (connected)

1. Pick expiration (table / yield curve).
2. Enter target borrow (single dollar input).
3. Review ranked candidates (new panel) — top row is the recommendation, pre-selected.
4. Paste the recommended order into Schwab (step-by-step guide below order).

### Scope boundaries

- `/learn` page untouched.
- Tax rate inputs untouched.
- Multi-brokerage guides (IBKR, Fidelity) are removed from UI. Existing code stays in the repo but is no longer rendered. A single Schwab-scoped guide remains in the order section.
- `/order` remains a redirect to `/`.

## 2. Architecture

### Core: per-request Schwab client factory

```
getSchwabClientForRequest(req) → SchwabClient | null
```

Phase 1 and Phase 2 share this signature. The call site (API routes) is oblivious to which phase is active.

**Phase 1 behavior:** read signed session cookie → look up row in Supabase `schwab_connections (session_id, refresh_token, connected_at)` → if found, return a `SchwabClient` with a freshly-refreshed access token. Else return `null`. George is row #1.

**Phase 2 behavior:** identical. OAuth callback just writes additional rows.

### New API routes

- `GET /api/schwab/status` → `{ connected: boolean }`. Client polls on mount to pick UI state.
- `GET /api/schwab/chain?expiration=YYYY-MM-DD&target=500000` → `{ underlying, expiration, candidates: [...], selected, asOf, reason? }`. Returns 401 if not connected.
- `POST /api/schwab/admin/login` *(Phase 1 only)* — accepts an admin key (compared to `ADMIN_KEY` env). On success, reads George's Schwab refresh token from `SCHWAB_REFRESH_TOKEN` env, upserts it into Supabase, signs + sets the session cookie, done. Env is the *seed source*; Supabase is the *source of truth* from there on (and is what Phase 2 OAuth will write to for every user).
- `POST /api/schwab/disconnect` — deletes the row and clears the cookie.
- *(Phase 2)* `GET /api/schwab/oauth/start`, `GET /api/schwab/oauth/callback`.

### Two architectural decisions

1. **Use Supabase from day 1.** `@supabase/ssr` and `@supabase/supabase-js` are already in the stack. A one-column-meaningful table costs nothing and makes Phase 2 a literal zero-refactor swap.
2. **Session cookie = simple signed HttpOnly cookie.** Not Supabase Auth. We don't need user accounts, just "is this browser connected?" Keeps auth UX out of the product.

### Library & limits

- `@sudowealth/schwab-api` — TypeScript types, Zod validation, built-in rate-limit middleware, OAuth helpers.
- Schwab rate limit: 120 req/min. Trivial for George alone. Phase 2 will need a per-session throttle.
- Token lifetimes: access 30 min, refresh 7 days. Refresh is auto-handled by the client factory.

### Admin path (George, Phase 1)

Refresh tokens last 7 days. George's loop:

1. Run a one-off auth script (CLI, out of scope of this design) to complete the Schwab OAuth dance and get a fresh refresh token.
2. Put the token in the `SCHWAB_REFRESH_TOKEN` env var (locally, or in Vercel deployment env).
3. Visit `/admin?key=...` — the admin route reads `SCHWAB_REFRESH_TOKEN`, upserts George's row in Supabase, signs + sets the session cookie, redirects home. Repeat every ≤7 days.

## 3. Data flow & candidate compute

### Pipeline for a connected request

1. Client mounts → `/api/schwab/status` → state `connected` or `disconnected`.
2. User sets expiration + target → debounced fetch to `/api/schwab/chain`.
3. Server resolves a `SchwabClient`, fetches the chain (`symbol=$SPX`, `includeUnderlyingQuote=true`, `optionType=S`, `contractType=ALL`), using `fromDate/toDate` to fetch all expirations within range once and cache.
4. Server runs `computeCandidates` (pure function).
5. Server returns `{ underlying, expiration, candidates: [...], selected, asOf, reason? }`.
6. Client renders candidates panel + order section from `selected`. Clicking another candidate re-renders the order.

### `computeCandidates` — algorithm

For a given chain snapshot, expiration, and target borrow:

1. Filter to `optionRoot === "SPX" && settlementType === "AM"` (standard monthly).
2. For every strike pair `(lower, upper)` where all 4 legs exist:
   - `boxCredit = (lowerCallBid − upperCallAsk) + (upperPutBid − lowerPutAsk)`
   - `strikeWidth = upper − lower`
   - `rate = ((strikeWidth − boxCredit) / boxCredit) × (365 / DTE)`
   - `minOI = min(OI across 4 legs)`
   - `spreadWidth = Σ (ask − bid) across 4 legs`
   - `contracts = round(target / (boxCredit × 100))` *(SPX multiplier = 100)*
   - `actualBorrow = boxCredit × 100 × contracts`
3. Filter: `|actualBorrow − target| / target ≤ 0.15` (**±15% tolerance**).
4. Score: `rate − liquidityPenalty(minOI, contracts × 10) − spreadPenalty(spreadWidth, boxCredit)`.
   - Liquidity safety multiplier = **10×**. When `minOI < contracts × 10`, the candidate is *muted* (visible but penalized), not removed.
5. Sort by score descending, take top **5**. The highest-scoring row is the default selection.

### Caching & freshness

- Server-side cache per chain pull, keyed by date range (effectively "all expirations in the next 2 years"). TTL = **5 min**.
- Target-borrow changes re-run the ranking against cache, no Schwab call.
- Client shows `asOf` as "updated Ns ago." Manual refresh button in the nav bypasses cache. **No auto-polling** (unnecessary; saves Schwab quota).
- Cache disabled outside market hours (chain is static).

### Edge cases in the return shape

- Target too small for this expiration → `candidates: []`, `reason: "min_credit_exceeds_target"`, plus a suggested minimum.
- Target large but nothing passes liquidity → `candidates` returned with all rows muted + `reason: "thin_liquidity"`; UI suggests a shorter DTE.

## 4. UI composition & file layout

### New files

```
src/components/calculator/
  TargetBorrowInput.tsx     — replaces UnifiedCalculator
  CandidatesPanel.tsx       — ranked picker; renders live rows or empty state
  ConnectStatus.tsx         — nav pill: connected/timestamp/refresh OR disabled CTA
  ConnectBanner.tsx         — blue explain-bar for disconnected state

src/app/admin/
  page.tsx                  — Phase 1 only; sets George's cookie

src/app/api/schwab/
  status/route.ts
  chain/route.ts
  admin/login/route.ts      — Phase 1 only
  disconnect/route.ts

src/lib/schwab/
  client.ts                 — getSchwabClientForRequest + token refresh
  compute-candidates.ts     — pure ranking function (heavily unit-tested)
  types.ts                  — Candidate, ChainSnapshot, BoxRateRow

src/lib/
  session.ts                — signed-cookie sign/verify

supabase/migrations/
  <timestamp>_schwab_connections.sql   — one table: (session_id PK, refresh_token, connected_at)
```

### Edited files

- `src/components/calculator/Calculator.tsx` — fetches `/status` on mount, branches on connected state; when connected, fetches `/chain` on expiration/target changes. Removes width / mid-price / contracts state (derived from selected candidate).
- `src/components/order/LegTable.tsx`, `OrderParams.tsx` — accept real option symbols + per-leg bid/ask + real limit price; fall back to illustrative structure for disconnected state (same legs, prices replaced with `"est."`).
- `src/components/order/BrokerageGuide.tsx` — drop `brokerage` prop; Schwab-only content.
- `src/app/layout.tsx` — mount `ConnectStatus` in the nav.

### Removed from UI

- `BrokerageCTA.tsx` (no longer rendered).
- IBKR / Fidelity branches in `BrokerageGuide.tsx`.
- `UnifiedCalculator.tsx` (replaced by `TargetBorrowInput.tsx`).

### Data-fetching pattern (client)

1. Mount → `/api/schwab/status` → state `connected` or `disconnected`.
2. *Connected:* `{expiration, target}` change → debounced `/api/schwab/chain`. Response hydrates candidates and default-selected order. All downstream UI derives from `selected`.
3. *Disconnected:* existing `/api/rates/treasury` powers yield curve, expiration table rates, and the aggregate estimate panel. Candidate and order surfaces render empty states with per-panel Connect CTAs.

### Page composition, final states

**Connected:**

```
nav (ConnectStatus — live pill)
[ YieldCurve + ExpirationTable   |   TargetBorrowInput + TaxRateInputs ]
CandidatesPanel (live rows, selected highlighted)
OrderSection (LegTable + OrderParams + FeeBreakdown, populated from selected)
BrokerageGuide (Schwab-only step-by-step)
```

**Not connected:**

```
nav (ConnectStatus — disabled "+ Connect Schwab · coming soon")
ConnectBanner (one blue bar: "Connect Schwab for accurate rates and a pastable order.")
[ YieldCurve + ExpirationTable (Treasury-estimated)   |   TargetBorrowInput + TaxRateInputs ]
EstimateTotals panel (pre-tax, after-tax, interest cost, tax savings — all Treasury-derived)
CandidatesPanel (empty state, Connect CTA)
OrderSection (empty state, Connect CTA)
```

No BrokerageGuide in disconnected state.

## 5. Errors, testing, non-goals

### Error handling & fallback

- **Schwab transient failure on `/chain`** — return cache if within 15 min past TTL; else 503 `{ error: "chain_unavailable" }`. Client shows a non-blocking banner, keeps the last successful candidates visible, highlights the refresh button.
- **Refresh token expired** — `getSchwabClientForRequest` returns `null`. App flips to disconnected state with "Schwab connection expired — please reconnect."
- **Supabase lookup error** — 500 with a generic temporary-problem banner.
- **No candidates pass filters** — normal empty state with a `reason` code (`min_credit_exceeds_target` / `thin_liquidity`), not an error.
- **Invalid target borrow** (≤ 0, NaN, above a sane cap of $10M) — client-side validation, no request fired.

### Testing

- `compute-candidates.ts` — unit tests against a recorded SPX chain fixture. Cases: best-pick selection, ±15% boundary, 10× liquidity mute, target-too-small, thin-liquidity-all-muted.
- `/api/schwab/chain` route — integration test with a mocked `SchwabClient` returning the fixture. Asserts candidate count, selection, caching headers.
- `/api/schwab/admin/login` — valid key writes row + signs cookie; wrong key → 403 + no write.
- `getSchwabClientForRequest` — cookie present → client; cookie missing → null; expired refresh token → null + row cleared.
- UI: snapshot tests for `CandidatesPanel` connected vs empty states, and `ConnectStatus` connected vs disabled.
- **No live Schwab calls in CI.** All tests run against recorded fixtures.

### What NOT to build yet

- Multi-user OAuth UI (activate post-Commercial). Routes are scaffolded but inert.
- Order placement via API.
- Real-time streaming / WebSocket market data.
- Per-candidate Greeks, IV, scenario analysis.
- Trade history, P&L, user accounts.
- IBKR / Fidelity live chain integrations.

## 6. Tunables & open questions

Defaults chosen now; revisit after first real use:

- **Borrow tolerance** = ±15%. Tighter = fewer candidates more often.
- **Liquidity safety multiplier** = 10×. Common rule of thumb; no empirical basis.
- **Cache TTL** = 5 min during market hours; disabled after-hours.
- **Top-N candidates returned** = 5.

All are simple constants in `compute-candidates.ts` / the chain route; easy to tune.

## 7. Implementation order (for the writing-plans step that follows)

1. Supabase table + migration.
2. Signed-cookie session helper (`src/lib/session.ts`).
3. Schwab client factory + token refresh.
4. `computeCandidates` pure function + fixtures + unit tests.
5. API routes (`status`, `chain`, `admin/login`, `disconnect`) + integration tests.
6. Admin page (`/admin`).
7. UI components (`ConnectStatus`, `ConnectBanner`, `TargetBorrowInput`, `CandidatesPanel`).
8. `Calculator.tsx` rewire.
9. Leg/Order/BrokerageGuide edits.
10. End-to-end manual test of both states.
