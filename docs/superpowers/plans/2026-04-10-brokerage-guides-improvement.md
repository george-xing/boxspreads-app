# Brokerage Guide Improvement Plan

## Key findings from research

### IBKR — Current guide is decent, but missing critical details
- **Strategy Builder has a "Box" template** — our guide says "Spread Trader" which is outdated. Strategy Builder is the recommended approach.
- Missing: buy/sell direction confusion (the #1 mistake — IBKR's Credit/Debit label is the source of truth)
- Missing: strike selection guidance (round numbers only, near current SPX, wider = better rates)
- Missing: pricing guidance (never use market orders, start near midpoint)
- Missing: margin context (Reg T = full notional locked up, PM = near zero)
- Commission is correct ($0.65/contract)

### Schwab — Current guide needs significant rework
- **Level 3 required** (not mentioned), $25K minimum
- **thinkorswim has NO "Box" template** — must use Ctrl+click custom build or iron condor workaround
- **Walk Limit order** is a unique Schwab feature worth mentioning
- **Reg T penalty is ~25%** — selling a $20K box consumes ~$25K buying power
- **PM requires $125K minimum** at Schwab (higher than IBKR's $110K)
- **IRA: NOT allowed** for short boxes
- Commission: $0.65 + ~$0.65 CBOE fee = ~$1.30/contract (higher than our guide says)

### Fidelity — Current guide needs significant rework  
- **Tier 2 required** (different naming than Schwab), $10K minimum
- **Must use "Custom" strategy** — no box spread preset
- **Citadel routing issue** — orders may get cancelled, workaround is two separate spreads
- **May not pass through CBOE proprietary fee** — potentially cheapest option
- **Margin credit, not cash** — credit goes to margin balance, not direct cash
- **IRA: NOT allowed** for short boxes
- The Finance Buff has detailed Fidelity-specific guides (valuable reference)

## What to change in each guide

### IBKR (5 → 7 steps)
1. Open Strategy Builder (not "Spread Trader") in TWS or IBKR Desktop
2. Enter SPX, set view to Put/Calls side by side
3. Select expiration — add tip about near-term = better liquidity
4. Select "Box" strategy template (or manually click legs)
5. Verify all 4 legs — emphasize checking Credit/Debit label
6. Set limit price — NEVER market order, start near midpoint, use boxtrades.com for reference
7. Submit and wait — fills can take hours, leave GTC

Add prereqs callout: Level 2+, margin account, Portfolio Margin strongly recommended

### Schwab (5 → 7 steps)  
1. Open thinkorswim desktop (recommended) or web
2. Enter $SPX in Trade tab, expand option chain
3. Select expiration
4. Ctrl+click to build 4-leg custom spread (detailed leg-by-leg instructions with Bid/Ask clicks)
5. Verify legs — confirm net Credit
6. Set limit price — mention Walk Limit order as alternative
7. Submit GTC

Add prereqs callout: Level 3 required ($25K min), PM requires $125K, not available in IRAs

### Fidelity (5 → 7 steps)
1. Open options trade on Fidelity.com or Fidelity Trader+
2. Enter .SPX (note the leading dot), select "Custom" strategy, expand to 4 legs
3. Select expiration — same for all legs
4. Configure all 4 legs (table showing each leg's action/type/strike)
5. Set limit price as Net Credit — NEVER market order
6. Preview and triple-check — mention Citadel cancellation risk
7. If order cancels: workaround is two separate spreads (call spread + put spread)

Add prereqs callout: Tier 2 required ($10K min), not available in IRAs, may need to call desk for margin recognition

### Shared improvements
- Add **Prerequisites** callout above each guide (options level, account type, margin tier)
- Add **Fees** line showing total cost for the specific order
- Pre-submit checklist: add "Verify Credit/Debit label matches your intention"
- Fill tip: add "Start near the midpoint. If no fill, walk the price $0.50-1.00 at a time"

## Implementation

Single file change: `src/components/order/BrokerageGuide.tsx`

- Rewrite IbkrGuide, SchwabGuide, FidelityGuide with researched steps
- Add `Prerequisites` callout component (rendered above steps)
- Keep StepList shared component
- Keep pre-submit checklist at bottom (shared across all)
- Update fill tip with more specific guidance
