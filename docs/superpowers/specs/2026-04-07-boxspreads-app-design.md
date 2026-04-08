# boxspreads.app — Product Spec

## Context

Box spreads let investors borrow at near-Treasury rates (~30bps over), far cheaper than margin loans (11%+), SBLOCs (6-8%), or HELOCs (7-9%). The strategy is well-understood by the Bogleheads community but has high activation energy: confusing brokerage UIs, fear of mis-entering the 4-leg order, no good tooling for rate comparison or execution guidance.

The current landscape has a gap between:
- **Free but scary** DIY tools (boxtrades.com shows inaccurate rates; ibkrbox is a 14-commit Python CLI)
- **Easy but expensive** managed services (SyntheticFi charges 0.50%/yr, SpreadWise 0.60%/yr — on a $500K loan, that's $2,500-3,000/yr)

**boxspreads.app** fills this gap: a polished web calculator + error-proof order builder that makes DIY execution safe and simple.

## Product Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Name | boxspreads.app | Exact-match SEO keyword, $28/yr, covers all box spread use cases (borrowing, lending, tax strategy, leverage) |
| Form factor | Web app (SaaS) | Widest reach, fastest iteration, best SEO |
| Tech stack | Next.js + Supabase + Vercel | Supabase has first-class Next.js integration; you know both from LemmeCook; all free tiers sufficient for launch |
| Target user | Progressive disclosure | Simple mode for newcomers, advanced mode for power users — same UI, layers of detail |
| Approach | Calculator-first | Landing page IS the calculator. No signup, instant value. SEO goldmine. |
| v1 scope | Rate calculator + order builder | Instructions-only (no brokerage API integration). User enters their own order. |
| Rate data | Hybrid | Treasury yield + configurable spread as default; advanced mode accepts actual market quotes from user's brokerage |
| Business model | TBD | Build first, validate demand, monetize later |
| Regulatory posture | Calculator + education (category 2) | User always clicks submit themselves. Framed as calculation, not advice. No SEC registration needed. |

## Competitive Landscape

### Managed Services (50-60bps/yr)

**SyntheticFi** — SEC-registered RIA (CRD #330200). 0.50%/yr fee (or max $200/mo). ~$993M AUM, 824 clients. Supports Schwab, Fidelity, IBKR, Pershing. Chrome extension + managed rolling. Also offers self-service quotes at app.syntheticfi.com.

**SpreadWise** — SEC-registered (mid-2025, newer). 0.60%/yr fee. Schwab + IBKR only. Zero public user reviews found.

### DIY Tools (free)

**boxtrades.com** — Yield curve visualization + historical data. Rates are "wildly inaccurate" per Bogleheads. Went down for weeks. Data sourced from SyntheticFi. No execution, no public calculator.

**ibkrbox** (github.com/asemx/ibkrbox) — Python CLI that auto-constructs box spread orders for IBKR. Treasury rate integration, dry-run mode. 14 commits, IBKR only, no rolling/position tracking, bug on 1st of month.

### Unserved Needs (from Bogleheads community)

1. Error-proof order builder (users lost $3,500+ from mis-entered legs)
2. Smart fill logic / price walk-down automation
3. Position dashboard (open boxes, effective rates, days to expiry)
4. Roll management (timing, replacement box construction)
5. Fee-inclusive rate calculation (4 legs × per-leg fees)
6. Eligibility checker + borrowing alternative comparison

---

## v1 Design

### Page 1: Calculator (Landing Page — `/`)

The product's front door. No signup required. Instant value.

**Inputs (simple mode):**
- **Amount**: How much to borrow (free-form dollar input)
- **Duration**: 3mo, 6mo, 1yr, 2yr, 3yr, 5yr (preset buttons)
- **Brokerage**: IBKR, Fidelity, Schwab (changes fee math)

**Inputs (advanced mode — toggle):**
- Market quote override: bid/ask prices from user's brokerage option chain
- Custom tax brackets: federal + state marginal rates
- Spread over Treasury: configurable bps (default 30)

**Output:**
- **Estimated rate**: Large, prominent (e.g., "4.12%")
- **After-tax effective rate**: Section 1256 60/40 treatment (e.g., "~3.10%")
- **Methodology line**: "Based on 1-yr Treasury (3.82%) + 30bps spread · Fee-inclusive (4 legs × $0.65)"
- **Comparison strip**: Side-by-side vs. margin loan, SBLOC, HELOC — always visible
- **CTA**: "Build My Order →" leading to the order builder

**Behavior:**
- All calculations client-side for instant reactivity
- Rate updates live as inputs change
- ⓘ tooltips expand into educational content for newcomers
- Advanced mode panel animates open/closed

### Page 2: Order Builder (`/order`)

User clicked "Build My Order." Parameters carried from calculator via URL query params (e.g., `/order?amount=250000&duration=1y&brokerage=ibkr`).

**Section A: Order Summary**
- Carried params: amount, duration, rate, brokerage
- Auto-calculated 4-leg table:

| Leg | Contract | Action | Type | Strike |
|-----|----------|--------|------|--------|
| 1 | SPX Dec 2026 4000 Call | BUY | Call | 4000 |
| 2 | SPX Dec 2026 6500 Call | SELL | Call | 6500 |
| 3 | SPX Dec 2026 4000 Put | SELL | Put | 4000 |
| 4 | SPX Dec 2026 6500 Put | BUY | Put | 6500 |

- Strike selection reasoning: "Spread width of $2,500 × 100 multiplier = $250,000 notional. Strikes at 4000/6500 selected for high open interest at Dec 2026 expiry."

**Section B: Order Parameters**
- Order type: Limit (combo order)
- Limit price (net debit): e.g., $2,401.50 per contract
- Quantity: e.g., 1 contract
- Total cost to repay at expiry: $250,000 (= spread width × 100)
- You receive today (premium): $240,150 (= limit price × 100)
- Implied interest cost: $9,850 (= repayment - premium)

**Section C: Fee Breakdown**
- Commission: 4 legs × $0.65 = $2.60
- Exchange fees (CBOE SPX): $2.72
- Regulatory fees (SEC, OCC, FINRA TAF): $0.84
- Total: $6.16
- Fee impact note: "Adds ~0.003% to your effective rate on a $250K box."

**Section D: Brokerage-Specific Walkthrough**
Different content per brokerage. For IBKR:
1. Open Spread Trader in TWS (not regular order entry)
2. Select expiration (standard SPX monthly, European-style, not SPXW)
3. Build the combo — enter all 4 legs exactly as shown
4. Set limit price + GTC time-in-force
5. Preview and submit

**Safety features:**
- Warning about reversed legs (turns defined-risk box into naked options)
- Pre-submit checklist (all 4 legs match, combo shows net credit to you, margin impact is small, correct expiration, correct limit price)
- Margin impact sanity check ("if ~$250K margin impact, you're on Reg T, not Portfolio Margin")
- Fill guidance: "Box spreads often fill within hours to 1-3 days. If no fill in 24h, raise limit price by $1-2."

### Page 3: Brokerage Walkthroughs (`/order/[brokerage]`)

Dedicated pages with annotated screenshots for IBKR, Fidelity, Schwab. Same step-by-step content from the order builder but expanded with visual guides. Good SEO targets ("how to enter box spread on IBKR").

### Page 4: Education Hub (`/learn`)

SEO content + trust building:
- What are box spreads?
- Prerequisites (account type, margin tier, options level)
- Risks (margin calls, liquidity, settlement timing)
- Tax treatment (Section 1256, 60/40, carry-back)
- Box spreads vs. other borrowing methods

Future: `/learn/eligibility` — interactive eligibility checker.

---

## Architecture

### System Overview

```
Client (Next.js App Router)
  ├── Calculator page (client-side interactivity)
  ├── Order builder page
  └── Learn pages (static/MDX)
        │
        ▼
API Routes (Next.js Route Handlers on Vercel)
  ├── GET /api/rates/treasury    — cached Treasury yields
  ├── GET /api/rates/comparison  — margin/SBLOC rates by brokerage
  ├── GET /api/fees/[brokerage]  — per-leg fee structure
  └── GET /api/strikes           — suggested strikes for amount + expiry
        │
        ▼
Supabase (Postgres)
  ├── treasury_rates   — daily cache from FRED API
  ├── brokerage_rates  — margin/SBLOC comparison rates
  └── brokerage_fees   — per-leg trading costs
```

### Rate Calculation Engine

All calculations happen **client-side** for instant feedback. The API serves cached data only.

**Simple mode (Treasury + spread):**
```
boxRate = treasuryYield[tenor] + spreadBps / 10000
```

**Advanced mode (from actual quotes):**
```
boxPrice = (bid + ask) / 2
impliedRate = (strikeWidth - boxPrice) / boxPrice × (365 / DTE)
```

**After-tax effective rate (Section 1256):**
```
blendedTaxRate = 0.60 × ltcgRate + 0.40 × stcgRate
afterTaxRate = boxRate × (1 - blendedTaxRate)
```

**Fee-inclusive rate:**
```
totalFees = (commission × 4) + (exchangeFee × 4) + regulatoryFees
feeImpact = totalFees / borrowAmount × (365 / DTE)
allInRate = impliedRate + feeImpact
```

### Strike Selection Logic

```
1. spreadWidth = borrowAmount / (100 × numContracts)
2. Find nearest standard SPX monthly expiration to target duration
3. lowerStrike = roundDown(currentSPX, 500)
4. upperStrike = lowerStrike + spreadWidth
5. Validate both strikes exist and are round numbers
```

v1 uses heuristic selection (round numbers near current SPX). Optimization using live open interest data deferred to v2 (requires market data).

### Data Model (Supabase)

**treasury_rates** — cached daily from FRED API
- `id` uuid PK
- `date` date (unique together with tenor)
- `tenor` text ('1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '10Y', '30Y')
- `yield_pct` numeric(5,3)
- `source` text ('FRED')
- `fetched_at` timestamptz

**brokerage_rates** — margin/SBLOC rates for comparison
- `id` uuid PK
- `brokerage` text ('ibkr', 'fidelity', 'schwab')
- `product` text ('margin', 'sbloc')
- `rate_pct` numeric(5,3)
- `min_balance` numeric (rate tier threshold)
- `updated_at` timestamptz
- `source_url` text

**brokerage_fees** — per-leg trading costs
- `id` uuid PK
- `brokerage` text
- `commission` numeric(6,2)
- `exchange_fee` numeric(6,2)
- `regulatory_fee` numeric(6,4)
- `updated_at` timestamptz

### External Data Sources

| Source | Data | Cost | Update Frequency |
|--------|------|------|------------------|
| FRED API | Treasury yields (DGS1MO–DGS30) | Free (API key required) | Daily by ~3:30 PM ET |
| NY Fed | SOFR rate | Free | Daily |
| Brokerage websites | Published margin loan rates | Free (manual/scrape) | As needed |
| Treasury.gov | Par yield curve | Free (no API key) | Daily |

### Deployment

- **Vercel**: Next.js hosting. Free tier sufficient. Edge functions for API routes. Preview deploys on PR.
- **Supabase**: Postgres for rate caching. Free tier (500MB, 2 projects). pg_cron for daily FRED fetch.
- **Domain**: boxspreads.app — $28/yr. .app TLD requires HTTPS (enforced by HSTS preload).

---

## Future Roadmap

### v2: Chrome Extension (Live Data + Order Pre-Fill)

A Chrome extension that:
1. **Reads** live SPX option chain data from the brokerage's own page (no market data licensing — the brokerage is the distributor, not us)
2. **Calculates** optimal box spread parameters locally
3. **Displays** an overlay showing the calculated rate + comparison
4. **Pre-fills** all 4 legs of the order form on the brokerage's Spread Trader / combo order UI

User reviews and clicks submit themselves (maintains regulatory posture).

**Technical approach:** Manifest V3 content scripts injected into brokerage domains (`portal.interactivebrokers.com`, `client.schwab.com`). DOM selectors to read option chains and fill order forms. React-based brokerage UIs need synthetic event dispatch for state updates. All calculation logic bundled locally (MV3 requirement).

**Precedent:** SyntheticFi's Chrome extension (chrome.google.com/webstore) does exactly this. Proven model on Chrome Web Store.

**Brokerage priority:** IBKR first (most box spread users), then Schwab (has developer API as fallback).

**Risk:** DOM selectors are fragile — break when brokerages update their UI. Mitigation: robust selectors, automated smoke tests, quick update cycle.

**Alternative (web app + OAuth):** Schwab has a public developer portal with standard OAuth 2.0 and an option chain endpoint (free, 1-3 day approval). IBKR requires 3-6 week vendor approval for third-party OAuth. Fidelity has no public API. SnapTrade offers a unified API across 20+ brokerages with an option chain endpoint (B2B pricing). Market data redistribution is a gray area when the web app renders user-authenticated data — the Chrome extension approach avoids this entirely.

### v3: Lifecycle Management

- Position dashboard: track open boxes, effective rates, days to expiry
- Roll deadline alerts (push notifications / email)
- Rate refinancing suggestions (when new boxes are cheaper)
- User accounts + saved comparisons (Supabase Auth)
- This is where monetization kicks in (subscription for alerts/tracking)

---

## Verification Plan

### Manual Testing (v1)
1. Load calculator, verify Treasury rates are current (compare to FRED website)
2. Enter $250K / 1yr / IBKR — verify rate matches Treasury + 30bps + fees
3. Toggle advanced mode — enter known bid/ask, verify implied rate calculation
4. Enter custom tax brackets — verify after-tax rate uses Section 1256 60/40 correctly
5. Click "Build My Order" — verify all 4 legs, limit price, and order parameters carry correctly
6. Switch brokerage to Fidelity/Schwab — verify fee breakdown and instructions change
7. Check comparison strip rates against published brokerage margin rates
8. Test responsive layout on mobile
9. Verify /learn pages render correctly

### Rate Calculation Accuracy
- Cross-reference box spread rate with boxtrades.com for same tenor (expect ~15-40bps difference due to their use of live market quotes vs. our Treasury + spread model)
- Verify after-tax calculation against manual spreadsheet for known tax brackets
- Verify fee math against published IBKR/Schwab/Fidelity fee schedules

### SEO Verification
- Confirm SSR renders calculator content for crawlers
- Verify meta tags, Open Graph, structured data on key pages
- Check that `/order?amount=250000&duration=1y&brokerage=ibkr` produces a shareable URL with meaningful preview
