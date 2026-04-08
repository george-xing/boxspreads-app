# Calculator UX Redesign

Replace the Advanced mode toggle with a two-tab calculator, simplify inputs, and add transparency into rate calculations.

## Problem

The current calculator has three UX issues:

1. **Mode confusion**: Toggling off Advanced mode doesn't clear bid/ask/strikeWidth state, so the calculation silently stays in advanced mode while the UI suggests simple mode. This produces misleading rates (e.g., 0.75% for a 5-year box using stale 1-year quotes).
2. **Black box**: The single rate number gives no visibility into how it was derived — no maturity curve, no math breakdown.
3. **Bolted-on feel**: The Advanced toggle + hidden panel feels like an afterthought rather than a natural part of the flow.

Additionally:
- The brokerage picker doesn't affect the box spread rate (fees are identical across brokerages) — it only matters for the comparison strip and order execution.
- The default spread of 30bps over Treasury overstates borrowing cost. Real fills show ~5–15bps spread.

## Design

### Two-tab calculator

Replace the toggle with two explicit tabs: **Estimate** and **From Quotes**. Each tab has isolated state — switching tabs never leaks values.

### Shared inputs (above tabs)

- **Amount** — dollar amount to borrow (existing component)
- **Tenor** — 3mo, 6mo, 1yr, 2yr, 3yr, 5yr pills (existing component)
- No brokerage picker. Brokerage selection moves to the order page.

### Estimate tab (default)

Shows a Treasury-model-based estimate. This is what casual users see.

1. **Rate card** — large rate display + after-tax effective rate
2. **Tax rate fields** — federal and state rate inputs, inline near the after-tax line. Default: 37% federal, 0% state. Editable.
3. **Maturity curve** — SVG chart showing the implied box spread rate at each tenor. The selected tenor is highlighted with a larger dot and dashed vertical line. Each point labeled with its rate value.
4. **Math breakdown** — line-item waterfall:
   - Treasury yield (from FRED API for selected tenor)
   - \+ Liquidity spread (default 10bps)
   - \+ Estimated fees (per-contract × 4 legs, annualized)
   - = All-in rate

Data for the maturity curve: compute the rate for all 6 tenors using `calcBoxRateSimple(treasuryYield, spreadBps)` with the corresponding Treasury yield for each tenor. This requires the full `treasuryRates` map from the API.

### From Quotes tab

For power users who have their brokerage's option chain open.

1. **Quote inputs** — four fields in a row:
   - Bid price
   - Ask price
   - Strike width ($)
   - DTE (auto-fills from selected tenor, user can override)
2. **Rate card** — same component as Estimate tab, displays rate derived from quotes
3. **Tax rate fields** — same as Estimate tab, inline near after-tax line
4. **Math breakdown** — shows the calculation transparently:
   - Box mid price: (bid + ask) / 2
   - Strike width
   - Days to expiry
   - Implied rate: `(width − mid) / mid × 365 / DTE`
   - \+ Estimated fees
   - = All-in rate

### State isolation rules

- Each tab owns its own rate calculation inputs. Switching tabs does not transfer state.
- **Tenor change clears From Quotes inputs** (bid, ask, width, DTE override) — quotes are tenor-specific and stale quotes from a different tenor produce nonsensical rates. This fixes the original bug.
- The Estimate tab has no user-entered quote state — it always derives from Treasury + spread.
- Shared state (amount, tenor, tax rates) lives above the tabs and is used by both.

### Removed components

- **AdvancedPanel** — replaced by tabs + From Quotes inputs
- **BrokeragePicker** — moves to order page
- **ComparisonStrip** — removed from calculator page entirely

### Constants changes

- `DEFAULT_SPREAD_BPS`: 30 → 10 (reflects real market fills at ~5–15bps over Treasury)

## Components

### New

- **`TabSwitcher`** — "Estimate" | "From Quotes" tab bar. Controls which tab body is rendered. Purely presentational — does not own state.
- **`MaturityCurve`** — SVG chart component. Props: `rates: Record<Tenor, number>`, `selectedTenor: Tenor`. Renders the yield curve with highlighted selected point.
- **`RateBreakdown`** — renders the line-item math waterfall. Props differ by mode:
  - Estimate mode: `{ treasuryYield, spreadBps, feeImpact, allInRate }`
  - Quotes mode: `{ midPrice, strikeWidth, dte, impliedRate, feeImpact, allInRate }`
- **`TaxRateInputs`** — inline federal/state rate fields. Props: `federalRate, stateRate, onChange`.

### Modified

- **`Calculator`** — main component. Gains tab state, maturity curve data computation, and state isolation logic. Loses brokerage state, advanced panel state, and comparison rates.
- **`RateResult`** — keep as-is but remove methodology string (replaced by RateBreakdown).

### Removed

- **`AdvancedPanel`** — deleted
- **`BrokeragePicker`** — deleted from calculator (may be reused on order page)
- **`ComparisonStrip`** — deleted from calculator page

## Data flow

```
Shared state: amount, tenor, federalTaxRate, stateTaxRate
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    Estimate Tab          From Quotes Tab
         │                     │
   treasuryRates[tenor]   bid, ask, width, dteOverride
   + spreadBps (10)            │
         │                midpoint = (bid+ask)/2
         ▼                     ▼
   calcBoxRateSimple()    calcBoxRateFromQuotes()
         │                     │
         └──────────┬──────────┘
                    ▼
            calcFeeImpact()
            calcAllInRate()
            calcBlendedTaxRate()
            calcAfterTaxRate()
                    │
                    ▼
              RateResult card
              RateBreakdown
              (+ MaturityCurve on Estimate tab)
```

## Maturity curve data

On the Estimate tab, compute rates for all tenors to populate the curve:

```typescript
const curveData = TENORS.map(({ value }) => ({
  tenor: value,
  rate: calcAllInRate(
    calcBoxRateSimple(treasuryRates[value] ?? 0.04, spreadBps),
    calcFeeImpact(fees, 1, amount, calcDte(findNearestExpiry(value, new Date())))
  ),
}));
```

The curve is only shown on the Estimate tab since it represents the Treasury model. The From Quotes tab shows the rate for the specific quote entered.

## Tax rate placement

Tax rate fields appear inline below the after-tax effective rate line in the rate card, on both tabs. They are small inputs (federal % / state %) with the current values visible. Shared state — changing on one tab updates the other.

## Migration notes

- The `calcBoxRateSimple`, `calcBoxRateFromQuotes`, and all other `calc.ts` functions are unchanged.
- `strikes.ts` functions unchanged.
- The Treasury API route is unchanged.
- The order page continues to work — it receives rate/tenor/amount via URL params. Brokerage picker will be added to the order page in a separate task.
- Fee calculation uses a fixed fee structure (currently identical across brokerages) rather than a brokerage-specific lookup since brokerage is no longer selected at this stage.
