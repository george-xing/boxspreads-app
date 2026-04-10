# Calculator v2 — Unified Design

Replaces: `2026-04-08-calculator-ux-redesign-design.md` (two-tab design)
Builds on: `2026-04-07-boxspreads-app-design.md` (original product spec, still canonical for order page, learn page, architecture, data model)

## Product positioning

**boxtrades.com** answers: "What rate can I get?"
**boxspreads.app** answers: "What will this actually cost me, and is it worth it?"

boxtrades is a market data viewer. We are a decision tool. The differentiation comes from three things no other tool does:

1. **Personalization** — after-tax rate based on YOUR tax bracket, comparison against YOUR alternatives
2. **Transparency** — every number has a visible derivation, rate convention is explicit
3. **Confidence** — order builder with safety checks turns "I'm terrified of mis-entering a $250K options trade" into "I can see exactly what I'm submitting"

## Problems with current design

1. **"For how long?" is the wrong question.** Box spreads aren't fixed-term loans. Users pick an expiration based on rate, not a duration based on need. The tenor picker (3mo/6mo/1yr...) forces a commitment before showing the rate landscape.
2. **Two tabs is artificial friction.** Estimate vs From Quotes forces users to declare intent. In practice, users start with an estimate and progressively override with real data — a single calculator with editable defaults serves both flows.
3. **Abstract tenors miss real expirations.** SPX has specific expiry dates. "1Y" maps to a computed 3rd Friday that may not match what the user sees in their brokerage. Show actual dates.
4. **No context for the rate.** A rate of 4.02% means nothing without: How does it compare to Treasury? What does it cost after tax? How much do I save vs. a margin loan?

## Design

### Page structure

```
┌─────────────────────────────────────────┐
│  "Borrow at near-Treasury rates"        │
│  How much? [$250,000          ]         │
├─────────────────────────────────────────┤
│  Yield curve (SVG, interactive)         │
│    ● box spread rate per expiration     │
│    ┄ Treasury yield (dashed baseline)   │
│    Click a dot to select expiration     │
├─────────────────────────────────────────┤
│  Expiration table                       │
│    Date | DTE | Rate | Treasury | Spread│
│    Click a row to select expiration     │
│    Selected row highlighted             │
├─────────────────────────────────────────┤
│  Calculator (for selected expiration)   │
│    All fields pre-filled, all editable  │
│    Rate ↔ Price bidirectional           │
│    "est." badge on model-derived values │
├─────────────────────────────────────────┤
│  Cost comparison                        │
│    Box spread vs margin vs SBLOC vs HELOC│
│    After-tax, total dollar cost         │
├─────────────────────────────────────────┤
│  [ Build My Order → ]                   │
└─────────────────────────────────────────┘
```

### Amount input

Same as current. Free-form dollar input, top of page. Changing amount:
- Updates strike width (= amount / 100 for 1 contract)
- Recalculates fee impact (fees are fixed, but their annualized % changes with amount)
- Updates cost comparison dollar amounts
- Does NOT change selected expiration or rate

### Yield curve chart

Interactive SVG. Replaces the current `MaturityCurve` component.

**Two data series:**
- **Box spread estimated rate** (solid green line + dots) — Treasury yield + spread at each expiration
- **Treasury yield** (dashed gray line) — interpolated FRED curve at each expiration's DTE

**Interactions:**
- Click a dot → selects that expiration (updates table highlight + calculator)
- Hover a dot → tooltip with date, DTE, rate, Treasury yield, spread over Treasury

**X-axis:** Expiration dates (labeled as "May '26", "Dec '27", etc.), spaced proportionally by DTE.
**Y-axis:** Rate (%).

When the user overrides the rate in the calculator (enters their own quote data), the selected dot changes color to indicate "user rate" vs "estimated rate."

### Expiration table

Replaces the `DurationPicker` tenor pill bar. A scrollable table showing all available SPX expirations.

| Expiration | DTE | Est. Rate | After-tax | Treasury | Spread |
|---|---|---|---|---|---|
| May 15, 2026 | 37 | 4.16% | 3.01% | 4.06% | +10bp |
| Jun 19, 2026 | 72 | 4.08% | 2.95% | 3.98% | +10bp |
| ► **Dec 19, 2027** | **620** | **4.02%** | **2.91%** | **3.92%** | **+10bp** |
| Dec 20, 2028 | 984 | 3.99% | 2.89% | 3.90% | +9bp |

- Click a row → selects that expiration
- Selected row has left accent border + bold text
- Chart and table stay synced (clicking either updates both)
- Default selection: nearest expiration ~12 months out
- "After-tax" column uses the user's current tax bracket inputs
- "Spread" column shows `est. rate − Treasury`, making the spread visible per tenor

### Calculator

Single unified calculator for the selected expiration. Every field is pre-filled with estimates from the Treasury model. Every field is editable.

**Fields:**

| Field | Default value | Source | Editable? |
|---|---|---|---|
| Direction | Borrow | — | Yes (Borrow/Lend toggle) |
| Expiration | (selected above) | table/chart click | Yes (dropdown of all expirations) |
| DTE | (computed from expiration) | deterministic | No (read-only, derived) |
| Strike width | amount / 100 | from amount input | Yes |
| Mid price | width / (1 + rate × DTE/365) | derived from estimated rate | Yes |
| Rate | Treasury[DTE] + spread | Treasury model | Yes |
| Commission | $0.65/leg | constant | Yes |

**Bidirectional rate ↔ price:**

When user edits **mid price** → rate recalculates:
```
rate = (width − mid) / mid × 365 / DTE
```

When user edits **rate** → mid price recalculates:
```
mid = width / (1 + rate × DTE / 365)
```

Price snaps to $0.05 tick increments (SPX standard). Rate is then re-derived from the snapped price for consistency. Same pattern as boxtrades.

**"est." indicator:**
- When mid price and rate are model-derived: show a small `est.` badge next to each
- When the user types into either field: badge disappears — these are now the user's values
- A "Reset to estimate" link appears to restore model defaults

**Fields specific to user override scenario:**
When the user edits mid price, we could optionally split it into bid/ask fields. But for simplicity in v1, keep it as a single mid price field. Users who want to enter bid/ask can compute the mid themselves. This avoids the 4-field quote entry (bid, ask, width, DTE) that was confusing in the old design.

### Natural language summary

Below the calculator fields, a plain-English summary:

> **Borrow $243,875 today, repay $250,000 on Dec 19, 2027.**
> Cost of borrowing: $6,125 over 620 days (4.02% annualized, 2.91% after tax).

Updates live as any input changes. Same pattern as boxtrades but with after-tax cost added.

### Rate breakdown

Waterfall showing the derivation. Adapts based on whether values are estimated or user-entered:

**When all estimated:**
```
Treasury yield (interpolated at 620 days)     3.92%
+ Liquidity spread                            0.10%
+ Estimated fees (4 × $0.65 / $250K, ann.)   0.00%
= All-in rate                                 4.02%

Section 1256 blended tax rate                28.2%
After-tax effective rate                      2.91%
```

**When user entered mid price:**
```
Strike width                               $2,500.00
Mid price (your input)                     $2,440.00
Days to expiry                                   620

Implied rate: (2500 − 2440) / 2440 × 365/620  3.58%
+ Estimated fees                               0.00%
= All-in rate                                  3.58%

Section 1256 blended tax rate                  28.2%
After-tax effective rate                        2.57%
```

The breakdown always shows the actual formula used, not a generic label.

### Tax rate inputs

Federal and state marginal rate fields. Inline below the after-tax line in the breakdown.
- Default: 37% federal, 0% state
- Changing these updates: after-tax rate, after-tax column in the expiration table, and dollar costs in the comparison

### Cost comparison

**This is the primary differentiator.** No other tool shows this.

A table comparing the total cost of borrowing $X for the selected term across all alternatives:

```
                      Box Spread    Margin Loan    SBLOC       HELOC
Rate                  4.02%         11.33%         6.50%       7.50%
After-tax rate        2.91%         11.33%         6.50%       5.40%*
620-day cost          $6,125        $48,200        $27,650     $22,950
vs. box spread        —             +$42,075       +$21,525    +$16,825
```

\* HELOC interest deductible only for home improvements; SBLOC/margin not deductible.

Key design choices:
- **Dollar amounts, not just rates.** "$42,075 savings" is more compelling than "7.31% cheaper."
- **After-tax rates are the real comparison.** Box spreads get Section 1256 60/40 treatment. Margin loan interest is non-deductible for investment use. This advantage is invisible in every other tool.
- **"vs. box spread" row** makes the savings concrete.
- Comparison rates from published brokerage schedules (manually maintained, same data source as current `COMPARISON_RATES` constant).
- Footnote explaining tax treatment differences.

### Brokerage picker

NOT on the calculator page. Appears on the order page only. Rationale: box spread rates and fees are identical across brokerages — the brokerage only matters for execution instructions.

The comparison rates (margin, SBLOC) use the worst-case rates across brokerages. Users who want brokerage-specific comparison see it on the order page.

## Data: SPX expirations

Computed deterministically — no market data dependency.

```typescript
function generateSpxExpirations(from: Date): Expiration[] {
  // Monthly: next 15 months (every month has standard SPX options)
  // Quarterly: 15-36 months (Mar/Jun/Sep/Dec only)
  // Annual: 36-72 months (Dec only)
  // All dates are 3rd Friday of the month (thirdFriday function already exists)
  // Filter out expirations < 7 DTE (too close to trade)
}
```

This produces ~18-22 expirations, matching what boxtrades.com and SyntheticFi show.

### Treasury yield interpolation

For expirations that don't land exactly on a FRED tenor (3M, 6M, 1Y, 2Y, 3Y, 5Y), linearly interpolate between the two nearest tenors.

```typescript
function interpolateTreasuryYield(dte: number, rates: TreasuryRates): number {
  const anchors = [
    { dte: 91, rate: rates["3M"] },
    { dte: 182, rate: rates["6M"] },
    { dte: 365, rate: rates["1Y"] },
    { dte: 730, rate: rates["2Y"] },
    { dte: 1095, rate: rates["3Y"] },
    { dte: 1825, rate: rates["5Y"] },
  ];
  // For DTE below 91 or above 1825, clamp to nearest anchor
  // Otherwise, linear interpolation between surrounding anchors
}
```

## Components

### New

- **`YieldCurve`** — interactive SVG chart. Props: `expirations: Expiration[]`, `selectedExpiry: string`, `onSelect: (expiry: string) => void`, `treasuryRates: TreasuryRates`. Renders two series (box spread rate + Treasury), clickable dots, hover tooltips.
- **`ExpirationTable`** — clickable table of expirations. Props: `expirations: Expiration[]`, `selectedExpiry: string`, `onSelect: (expiry: string) => void`. Shows date, DTE, rate, after-tax rate, Treasury, spread.
- **`UnifiedCalculator`** — fields for the selected expiration with bidirectional rate/price. Props: rate/price state and handlers. Contains direction toggle, strike width, mid price, rate, commission.
- **`CostComparison`** — the differentiating comparison table. Props: `boxRate: number`, `afterTaxRate: number`, `amount: number`, `dte: number`. Shows box vs margin vs SBLOC vs HELOC with dollar costs.
- **`BorrowSummary`** — natural language one-liner. Props: `amount: number`, `repayment: number`, `expiry: string`, `rate: number`, `afterTaxRate: number`.

### Modified

- **`Calculator`** — main orchestrator. Gains: expiration list generation, yield interpolation, bidirectional rate/price state, comparison data. Loses: tab state, tenor state, quote input state.
- **`RateBreakdown`** — single mode (no more `estimate` vs `quotes` discriminated union). Shows Treasury-model breakdown when estimated, shows price-derived breakdown when user has overridden.
- **`TaxRateInputs`** — unchanged.
- **`AmountInput`** — unchanged.
- **`RateResult`** — unchanged.

### Removed

- **`DurationPicker`** — replaced by ExpirationTable + YieldCurve
- **`TabSwitcher`** — deleted (no tabs)
- **`QuoteInputs`** — absorbed into UnifiedCalculator
- **`MaturityCurve`** — replaced by YieldCurve (interactive, with Treasury overlay)
- **`ComparisonStrip`** — replaced by CostComparison

## Types

```typescript
// Replaces Tenor as the primary selection mechanism
interface Expiration {
  date: string;        // ISO date, e.g. "2027-12-17"
  dte: number;         // days to expiration
  label: string;       // display label, e.g. "Dec 17, 2027"
}

// Tenor type is kept for Treasury rate lookups but is no longer user-facing
type Tenor = "3M" | "6M" | "1Y" | "2Y" | "3Y" | "5Y";

// TreasuryRates unchanged — still keyed by Tenor from FRED
type TreasuryRates = Partial<Record<Tenor, number>>;
```

## State model

All state lives in the `Calculator` component:

```
amount                    -- user input, default 100000
selectedExpiry            -- ISO date string, default ~12mo out
federalTaxRate            -- default 0.37
stateTaxRate              -- default 0.0
direction                 -- "borrow" | "lend", default "borrow"

// Calculator fields (all derived initially, user can override)
strikeWidth               -- default: amount / 100
midPrice                  -- default: derived from estimated rate
rate                      -- default: interpolated Treasury + spread
commission                -- default: 0.65
isUserRate                -- tracks whether rate/price was user-entered

// Derived (not state)
dte                       -- from selectedExpiry
treasuryYield             -- interpolated from TreasuryRates at dte
feeImpact                 -- from commission, amount, dte
allInRate                 -- rate + feeImpact
blendedTax                -- from federal/state rates
afterTaxRate              -- allInRate × (1 - blendedTax)
expirations[]             -- generated from generateSpxExpirations()
```

### State reset rules

- **Changing amount:** updates strikeWidth and midPrice (maintains rate). Does NOT change expiration.
- **Changing expiration:** resets rate and midPrice to estimates for the new expiration. Clears `isUserRate`. (Quotes are expiration-specific — stale quotes from a different expiration are meaningless.)
- **Editing rate:** updates midPrice (bidirectional). Sets `isUserRate = true`.
- **Editing midPrice:** updates rate (bidirectional). Sets `isUserRate = true`.
- **Changing direction:** recalculates price sign. Rate magnitude stays the same.

## Data flow

```
amount ──────────────────────────────────┐
                                         │
selectedExpiry ─── dte ──┐               │
                         ├── interpolateTreasuryYield() ── estimatedRate
treasuryRates ───────────┘               │
                                         │
rate (user or estimated) ────────────────┤
                                         │
midPrice (bidirectional with rate) ──────┤
                                         │
commission ── calcFeeImpact() ── feeImpact
                                         │
                      allInRate = rate + feeImpact
                                         │
federalTax ──┐                           │
stateTax  ───┴── calcBlendedTaxRate() ── afterTaxRate
                                         │
                 ┌───────────────────────┘
                 │
    ┌────────────┼──────────────┐
    ▼            ▼              ▼
RateResult   CostComparison  BorrowSummary
RateBreakdown                 OrderPage CTA
ExpirationTable (after-tax col)
```

## Order page changes

The order page currently receives `tenor` as a URL param and calls `findNearestExpiry(tenor)`. Updated to receive `expiry` directly:

```
/order?amount=250000&expiry=2027-12-17&rate=0.0402&brokerage=ibkr
```

- Remove `tenor` param, add `expiry` (ISO date string)
- Remove `dte` param — compute from `expiry`
- Remove the `dteOverridden` warning — no longer possible
- Add `brokerage` param (picker now lives on order page)
- `selectStrikes` unchanged — still uses amount + currentSpx

## Differentiation summary

| Feature | boxtrades.com | SyntheticFi | Us |
|---|---|---|---|
| Rate calculation | Linear/BEY, opaque | Daily compounding/360, opaque | Transparent formula, shown in breakdown |
| After-tax rate | No | No | **Yes — Section 1256 60/40 with editable brackets** |
| Treasury comparison | No | No | **Yes — overlay on yield curve + spread column** |
| Cost comparison | No | No | **Yes — box vs margin vs SBLOC vs HELOC in dollars** |
| Order builder | Shows leg text | Behind advisor agreement | **Guided flow with safety checks, free** |
| Real expirations | Yes | Yes | Yes (computed, no data dependency) |
| Bidirectional rate↔price | Yes | No | Yes |
| Natural language summary | Yes | No | **Yes, with after-tax cost** |
| Execution guides | No | For advisors only | **Yes — IBKR, Fidelity, Schwab** |
| Login required | Optional | Required for advisor tools | **Never** |

The moat is not any single feature — it's the combination of personalization (tax, broker), transparency (math breakdown), and confidence (order builder) that no existing tool provides together.
