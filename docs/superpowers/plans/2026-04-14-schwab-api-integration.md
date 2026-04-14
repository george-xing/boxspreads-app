# Schwab API Integration — Live SPX Option Chain

## Context

The calculator currently estimates box spread rates from Treasury yields + 30bps spread. Without live option chain data, we can't show real strikes, real mid prices, or real open interest. The Schwab Trader API (Individual tier, approved) gives us access to SPX option chain data through George's own Schwab account. This is a development/staging step — once Commercial tier is approved, the same code supports multi-user OAuth.

## What the API gives us

**Endpoint:** `GET https://api.schwabapi.com/marketdata/v1/chains`

**Key params:**
- `symbol`: `$SPX` (dollar sign prefix for indices)
- `contractType`: `ALL` (both calls and puts)
- `fromDate` / `toDate`: filter by expiration range
- `includeUnderlyingQuote`: `true` (gives us current SPX price)
- `optionType`: `S` (standard only, filters out non-standard)

**Response gives us per contract:**
- `bidPrice`, `askPrice`, `markPrice` — real pricing
- `openInterest`, `totalVolume` — liquidity
- `strikePrice`, `daysToExpiration`, `expirationDate`
- `optionRoot`: `SPX` vs `SPXW` (we want `SPX` for AM-settled monthlies)
- `settlementType`: `AM` (what we want)

**Underlying quote gives us:**
- Current SPX price (`last`, `mark`)
- This replaces `CURRENT_SPX = 5500`

**Auth:** OAuth 2.0, access token lasts 30 min, refresh token 7 days.
**Rate limit:** 120 req/min.

## TypeScript library

Use `@sudowealth/schwab-api` — best TypeScript support:
- Full types with Zod validation
- Built-in rate limiting middleware
- OAuth helpers (auth URL, code exchange, refresh)
- Method: `schwab.marketData.options.getOptionChain({ queryParams: { symbol: '$SPX', ... } })`

Install: `npm install @sudowealth/schwab-api`

## What we compute from the chain

For each expiration, find the best box spread by:

1. Filter to `optionRoot === "SPX"` and `settlementType === "AM"` (standard monthly)
2. For each pair of round strikes (e.g., 5000/6000):
   - Box credit = (lower call bid - upper call ask) + (upper put bid - lower put ask)
   - Box rate = (strikeWidth - boxCredit) / boxCredit × 365 / DTE
   - Track: open interest (min across 4 legs), bid/ask spread quality
3. Rank by rate (best rate with minimum OI threshold, e.g., > 100)
4. Return the best strike pair and its rate for each expiration

This gives us:
- **Real rates** per expiration (replaces Treasury estimate)
- **Real strikes** with confirmed liquidity (replaces hardcoded 5500)
- **Real mid prices** (replaces estimated mid)
- **Current SPX price** (replaces CURRENT_SPX constant)

## Architecture

### Phase 1: Server-side API route (George's account only)

```
Browser → GET /api/schwab/chains?from=2026-05-01&to=2027-12-31
                ↓
         Next.js API route
                ↓
         Schwab API (with George's tokens)
                ↓
         Process chain → compute box rates per expiration
                ↓
         Return: { expirations: [{ date, dte, rate, strikes, midPrice, openInterest }] }
```

**Token management:**
- Store refresh token in env var (`SCHWAB_REFRESH_TOKEN`)
- API route refreshes access token on each call (or caches for 25 min)
- When refresh token expires (7 days), George re-authenticates manually
- For development/staging only — acceptable UX for one user

**Caching:**
- Cache chain response for 5 minutes (Vercel edge cache or in-memory)
- Option chain doesn't change fast enough to need real-time for our use case

### Phase 2: Multi-user OAuth (after Commercial approval)

- Add "Connect Schwab" button
- OAuth flow: user authenticates → we get their tokens
- Store tokens in Supabase (encrypted)
- Each user sees their own chain data
- Same compute logic, different token source

## New files

```
src/app/api/schwab/chains/route.ts    — API route, fetches + processes chain
src/lib/schwab.ts                     — Schwab client setup, token management
src/lib/boxrate.ts                    — Compute best box spread from raw chain data
```

## Calculator changes

When live data is available:
- `boxRatesMap` comes from `/api/schwab/chains` instead of Treasury estimate
- `CURRENT_SPX` replaced by `underlying.last` from the chain response
- Each expiration row shows the real rate + recommended strikes
- The order section shows real strikes with confirmed open interest
- The "estimate" callout changes to "Live rates from Schwab" or similar

Fallback: if Schwab API is unavailable, fall back to current Treasury estimate.

## Implementation steps

### Step 1: Install library, set up auth helper
- `npm install @sudowealth/schwab-api`
- Create `src/lib/schwab.ts` with token management
- Add env vars: `SCHWAB_APP_KEY`, `SCHWAB_APP_SECRET`, `SCHWAB_REFRESH_TOKEN`
- Create a one-time auth script to get initial tokens

### Step 2: Create box rate computation logic
- `src/lib/boxrate.ts`
- Function: `computeBoxRates(chainData) → BoxRateResult[]`
- Filters SPX AM-settled, finds best strike pairs, computes rates
- Pure function, fully testable

### Step 3: Create API route
- `src/app/api/schwab/chains/route.ts`
- Fetches chain for all expirations (or a date range)
- Processes through `computeBoxRates`
- Returns processed results with 5-min cache
- Falls back to Treasury estimate on error

### Step 4: Wire into Calculator
- Calculator fetches `/api/schwab/chains` alongside `/api/rates/treasury`
- If Schwab data available: use real rates, real strikes, real mid prices
- If not: fall back to Treasury estimate (current behavior)
- Update callout text based on data source
- Order section uses real strikes when available

### Step 5: Tests
- Unit tests for `computeBoxRates` with sample chain data
- Integration test for the API route with mocked Schwab response
- Verify fallback behavior when Schwab is unavailable

## What NOT to build yet

- Multi-user OAuth (wait for Commercial approval)
- Order placement via API (regulatory concerns)
- Real-time streaming (unnecessary for our use case)
- WebSocket market data (overkill)
