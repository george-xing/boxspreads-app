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
└─────────────────────────────────────────────────────┘
```

### Mobile (<768px)

Columns stack vertically. Left column (chart + table) first, then right column (calculator). Order section switches from 3-column grid to single column. Brokerage buttons stack.

### Key changes from current implementation

1. **Two-column grid** — `grid-template-columns: 1fr 1fr` at `md:` breakpoint, single column below
2. **Amount input** — moves from hero input at page top into the calculator card as a regular field
3. **Chart height** — uses `flex: 1` to fill remaining left-column height (min-height 200px)
4. **Expiration table** — scrollable with `max-height` and `overflow-y: auto`, sticky header
5. **No lend direction** — remove the Borrow/Lend toggle, always borrow
6. **Rate is read-only** — displayed as output, not an editable field. Mid price is the only user-editable price input.
7. **Rate displayed once** — big number in calculator card only, not repeated
8. **After-tax** — own sub-section at bottom of calculator card with federal/state inputs
9. **Borrow summary** — prominent dark card under the rate with white/orange text
10. **Order section** — 3-column grid (legs | params | fees), full width below both columns
11. **Brokerage CTA** — plain buttons at bottom, IBKR active, Schwab/Fidelity "soon"
12. **No OrderSummary** — removed (redundant)
13. **No RateBreakdown** — removed for now (the math waterfall adds clutter, rate derivation is transparent from the inputs)
14. **No CostComparison** — already removed
15. **No PreSubmitChecklist** — moves into brokerage guide (shown after clicking a brokerage)

### Components

**Modified:**
- `Calculator.tsx` — complete rewrite of render to two-column grid layout
- `AmountInput.tsx` — compact inline variant (no hero sizing)
- `YieldCurve.tsx` — flex height instead of fixed, `preserveAspectRatio="xMidYMid meet"`
- `ExpirationTable.tsx` — add scrollable container with max-height, sticky header
- `UnifiedCalculator.tsx` — remove direction toggle, remove rate as editable field, add after-tax sub-section inline

**Removed from render:**
- `RateBreakdown` — removed from calculator page
- `BorrowSummary` — absorbed into UnifiedCalculator
- `OrderSummary` — already removed
- `TaxRateInputs` — absorbed into UnifiedCalculator after-tax section
- `PreSubmitChecklist` — moves into BrokerageGuide

**New:**
- `BrokerageCTA.tsx` — row of brokerage buttons at bottom of page

### Responsive breakpoints

- `>= 768px` (md): two-column grid, 3-column order section
- `< 768px`: single column stack, single column order section, brokerage buttons stack

### State changes

- Remove `direction` state (always "borrow")
- Remove `isUserRate` / `userRate` — rate is always derived, never directly edited
- Keep `userMidPrice` — user can override mid price, rate recalculates
- Remove `commission` from editable fields — use constant (simplifies UI)

## Verification

1. Desktop: two columns side by side, chart fills left column height
2. Mobile: single column, all sections stack
3. Click expiration in table → chart dot highlights, calculator updates
4. Click chart dot → table row highlights, calculator updates
5. Edit amount → strike width and mid price update, rates in table do NOT change
6. Edit mid price → rate recalculates, "est." badge disappears
7. Order section shows correct legs, limit price, fees
8. IBKR button expands brokerage guide inline
9. All 45 tests pass
10. Production build succeeds
