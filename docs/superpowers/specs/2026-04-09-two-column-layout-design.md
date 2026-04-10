# Two-Column Layout Redesign

Replaces the single-column vertical stack with a two-column layout. Calculator and order builder on one page, responsive to mobile.

## Design

### Structure (3 sections)

```
┌─────────────────────────────────────────────────────┐
│            Borrow at near-Treasury rates             │
│              SPX box spread calculator               │
├────────────────────────┬────────────────────────────┤
│                        │  CONFIGURE                  │
│  RATE BY EXPIRATION    │  Amount       [$250,000  ]  │
│  ┌──────────────────┐  │  Expiration   Dec 19, 2027  │
│  │  Yield curve     │  │  Strike width [$2,500    ]  │
│  │  (flex height,   │  │  Mid price    [$2,440.00 ]  │
│  │   fills space)   │  │                             │
│  └──────────────────┘  │  ─────────────────────────  │
│  ┌──────────────────┐  │        4.02%                │
│  │ Expiration table │  │    estimated rate            │
│  │ (scrollable,     │  │  ┌─────────────────────┐   │
│  │  max-height)     │  │  │ Borrow $244K today,  │   │
│  └──────────────────┘  │  │ repay $250K Dec 2027 │   │
│                        │  │ Cost: $6,000         │   │
│                        │  └─────────────────────┘   │
│                        │                             │
│                        │  AFTER-TAX ANALYSIS         │
│                        │  Federal  [37]%  State [0]% │
│                        │  After-tax rate    2.91%    │
├────────────────────────┴────────────────────────────┤
│  YOUR ORDER                                          │
│  ┌─────────────┬──────────────┬─────────────┐       │
│  │ Box spread  │ Order params │ Fees        │       │
│  │ legs (4)    │ Limit price  │ Commission  │       │
│  │             │ You receive  │ Exchange    │       │
│  │             │ Interest     │ Total       │       │
│  └─────────────┴──────────────┴─────────────┘       │
├─────────────────────────────────────────────────────┤
│  Enter this order at your brokerage                  │
│  [IBKR →]  [Schwab soon]  [Fidelity soon]           │
│  (clicking IBKR expands guide inline below)          │
└─────────────────────────────────────────────────────┘
```

### Mobile (<768px)

Columns stack vertically. Left column (chart + table) first, then right column (calculator). Order section switches from 3-column grid to single column. Brokerage buttons stack.

### Key changes from current implementation

1. **Two-column grid** — `md:grid-cols-2` at `md:` breakpoint, single column below
2. **Amount input** — moves from hero input at page top into the calculator card as a regular field
3. **Chart height** — uses `flex: 1` to fill remaining left-column height (min-height 200px)
4. **Expiration table** — scrollable with `max-height` and `overflow-y: auto`, sticky header
5. **No lend direction** — hardcode "borrow" everywhere. Remove the toggle from UI. Pass `"borrow"` to `buildBoxLegs`, `OrderParams`, `BorrowSummary`. Remove `Direction` type from user-facing components (keep in lib for future use).
6. **Rate is read-only** — displayed as output, not an editable field. Mid price is the only user-editable price input. Rate is always derived from `calcRateFromMid(midPrice, strikeWidth, dte)`.
7. **Rate displayed once** — big number in calculator card only
8. **After-tax** — own sub-section at bottom of calculator card with federal/state inputs (absorbs `TaxRateInputs`)
9. **Borrow summary** — prominent dark card under the rate with white/orange text (absorbs `BorrowSummary` inline)
10. **Order section** — `md:grid-cols-3` grid (legs | params | fees), single column on mobile
11. **Brokerage CTA** — plain buttons. Clicking IBKR sets `selectedBrokerage` state and expands `BrokerageGuide` + `PreSubmitChecklist` inline below the buttons.
12. **RateResult** — absorbed inline into calculator card (no separate component in render)
13. **`/order` route** — redirect to `/` since the calculator page now has everything. Keep the route file but make it a redirect.

### Components

**Modified:**
- `Calculator.tsx` — complete rewrite of render to two-column grid layout. Absorbs RateResult, BorrowSummary, TaxRateInputs inline. Adds `selectedBrokerage` state for CTA.
- `AmountInput.tsx` — add compact inline variant via prop (`compact?: boolean`)
- `YieldCurve.tsx` — flex height instead of fixed, `preserveAspectRatio="xMidYMid meet"`
- `ExpirationTable.tsx` — add scrollable container with `max-height: 180px`, `overflow-y: auto`, sticky header via `sticky top-0`
- `UnifiedCalculator.tsx` — remove direction toggle, remove rate as editable field. Keep amount, expiration, strike width, mid price.
- `OrderParams.tsx` — hardcode `direction="borrow"`, remove prop. Add responsive `md:grid-cols-2 grid-cols-1`.
- `FeeBreakdown.tsx` — no structural changes needed
- `LegTable.tsx` — add responsive overflow handling
- `BrokerageGuide.tsx` — absorb `PreSubmitChecklist` content at the bottom

**Removed from Calculator render (files kept):**
- `RateResult.tsx` — rate display absorbed inline into Calculator
- `RateBreakdown.tsx` — removed for now
- `BorrowSummary.tsx` — summary absorbed inline into Calculator
- `TaxRateInputs.tsx` — tax inputs absorbed inline into Calculator
- `CostComparison.tsx` — already not rendered

**New:**
- `BrokerageCTA.tsx` — row of brokerage buttons. Props: `selected: Brokerage | null`, `onSelect: (b: Brokerage) => void`. Renders IBKR (active), Schwab/Fidelity (disabled "soon").

**Route changes:**
- `src/app/order/page.tsx` — replace content with redirect to `/`
- `OrderSummary.tsx` — no longer rendered anywhere. File kept for potential future use.

### State model

```
// Calculator.tsx state
amount: number                    // default 100000
selectedExpiry: string            // default ~12mo out
federalTaxRate: number            // default 0.37
stateTaxRate: number              // default 0.0
strikeWidth: number               // default amount / 100
userMidPrice: number | null       // null = use estimate
selectedBrokerage: Brokerage | null  // null = no guide shown

// Derived (not state)
expirations[]                     // from generateSpxExpirations()
dte                               // from selectedExpiry
treasuryYield                     // interpolated from FRED rates
estimatedRate                     // Treasury + spread
activeMidPrice                    // userMidPrice ?? calcMidFromRate(estimatedRate, ...)
activeRate                        // calcRateFromMid(activeMidPrice, ...)
isUserOverride                    // userMidPrice !== null (drives "est." badge)
feeImpact, allInRate, afterTaxRate // standard calc chain
order { legs, spreadWidth, limitPrice, contracts }  // always computed
```

### "est." badge behavior

Driven by `userMidPrice !== null`:
- When `null`: mid price shows "est." badge, derived from Treasury model
- When set: badge disappears, rate recalculates from user's mid price
- "Reset to estimate" link appears, sets `userMidPrice` back to `null`
- Changing expiration resets `userMidPrice` to `null` (quotes are expiration-specific)

### Responsive breakpoints

- `>= 768px` (md): two-column grid, 3-column order section, horizontal brokerage buttons
- `< 768px`: single column stack, single column order section, stacked brokerage buttons

## Verification

1. Desktop: two columns side by side, chart fills left column height
2. Mobile: single column, all sections stack correctly
3. Click expiration in table → chart dot highlights, calculator updates
4. Click chart dot → table row highlights, calculator updates
5. Edit amount → strike width and mid price update, rates in table do NOT change
6. Edit mid price → rate recalculates, "est." badge disappears, "Reset to estimate" appears
7. Order section shows correct legs, limit price, fees for selected expiration
8. Click IBKR → guide expands inline below the buttons with checklist
9. `/order` redirects to `/`
10. All 45 tests pass
11. Production build succeeds
