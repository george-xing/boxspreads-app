# Calculator UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Advanced mode toggle with a two-tab calculator (Estimate / From Quotes), add maturity curve and math breakdown, remove brokerage picker and comparison strip.

**Architecture:** The Calculator component is restructured from a single-mode calculator with a hidden advanced panel into a two-tab layout. Shared state (amount, tenor, tax rates) lives in Calculator. Each tab renders its own rate calculation and breakdown. New components: TabSwitcher, MaturityCurve, RateBreakdown, TaxRateInputs, QuoteInputs.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS v4, Vitest

---

### Task 1: Update DEFAULT_SPREAD_BPS constant

**Files:**
- Modify: `src/lib/constants.ts:40`
- Modify: `__tests__/calc.test.ts:13`

- [ ] **Step 1: Update the constant**

In `src/lib/constants.ts`, change line 40:

```typescript
export const DEFAULT_SPREAD_BPS = 10;
```

- [ ] **Step 2: Update the test that uses the old spread value**

In `__tests__/calc.test.ts`, update the first test in `calcBoxRateSimple` to use 10bps:

```typescript
it("adds spread to treasury yield", () => {
  expect(calcBoxRateSimple(0.0382, 10)).toBeCloseTo(0.0392, 4);
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts __tests__/calc.test.ts
git commit -m "chore: lower DEFAULT_SPREAD_BPS from 30 to 10"
```

---

### Task 2: Create TabSwitcher component

**Files:**
- Create: `src/components/calculator/TabSwitcher.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

export type CalcTab = "estimate" | "from-quotes";

interface TabSwitcherProps {
  value: CalcTab;
  onChange: (tab: CalcTab) => void;
}

const TABS: { value: CalcTab; label: string }[] = [
  { value: "estimate", label: "Estimate" },
  { value: "from-quotes", label: "From Quotes" },
];

export function TabSwitcher({ value, onChange }: TabSwitcherProps) {
  return (
    <div className="flex border-b-2 border-gray-800">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-5 py-2.5 text-sm transition-colors ${
            value === tab.value
              ? "border-b-2 border-green-500 -mb-[2px] font-semibold text-green-400"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/TabSwitcher.tsx
git commit -m "feat: add TabSwitcher component"
```

---

### Task 3: Create TaxRateInputs component

**Files:**
- Create: `src/components/calculator/TaxRateInputs.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

interface TaxRateInputsProps {
  federalRate: number;
  stateRate: number;
  onFederalChange: (rate: number) => void;
  onStateChange: (rate: number) => void;
}

export function TaxRateInputs({
  federalRate,
  stateRate,
  onFederalChange,
  onStateChange,
}: TaxRateInputsProps) {
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (rate: number) => void
  ) {
    const val = parseFloat(e.target.value);
    setter(Number.isFinite(val) ? val / 100 : 0);
  }

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span>Tax rates:</span>
      <label className="flex items-center gap-1">
        <span>Federal</span>
        <input
          type="text"
          inputMode="decimal"
          value={(federalRate * 100).toString()}
          onChange={(e) => handleChange(e, onFederalChange)}
          className="w-12 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-center text-xs text-gray-300 outline-none focus:border-gray-500"
        />
        <span>%</span>
      </label>
      <label className="flex items-center gap-1">
        <span>State</span>
        <input
          type="text"
          inputMode="decimal"
          value={(stateRate * 100).toString()}
          onChange={(e) => handleChange(e, onStateChange)}
          className="w-12 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-center text-xs text-gray-300 outline-none focus:border-gray-500"
        />
        <span>%</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/TaxRateInputs.tsx
git commit -m "feat: add TaxRateInputs component"
```

---

### Task 4: Create QuoteInputs component

**Files:**
- Create: `src/components/calculator/QuoteInputs.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

interface QuoteInputsProps {
  bidPrice: number | null;
  askPrice: number | null;
  strikeWidth: number | null;
  dteOverride: number | null;
  autoDte: number;
  onBidChange: (v: number | null) => void;
  onAskChange: (v: number | null) => void;
  onStrikeWidthChange: (v: number | null) => void;
  onDteOverrideChange: (v: number | null) => void;
}

function parseFloat_(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseInt_(v: string): number | null {
  const n = parseInt(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 text-xs text-gray-600">{label}</div>
      <div className="flex items-center rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
        />
        {suffix && (
          <span className="ml-1 text-xs text-gray-600">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export function QuoteInputs({
  bidPrice,
  askPrice,
  strikeWidth,
  dteOverride,
  autoDte,
  onBidChange,
  onAskChange,
  onStrikeWidthChange,
  onDteOverrideChange,
}: QuoteInputsProps) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-gray-500">
        Enter from your SPX option chain
      </div>
      <div className="flex gap-3">
        <Field
          label="Bid price"
          value={bidPrice?.toString() ?? ""}
          placeholder="e.g. 956.20"
          onChange={(v) => onBidChange(v ? parseFloat_(v) : null)}
        />
        <Field
          label="Ask price"
          value={askPrice?.toString() ?? ""}
          placeholder="e.g. 958.80"
          onChange={(v) => onAskChange(v ? parseFloat_(v) : null)}
        />
        <Field
          label="Width"
          value={strikeWidth?.toString() ?? ""}
          placeholder="e.g. 1000"
          onChange={(v) => onStrikeWidthChange(v ? parseFloat_(v) : null)}
          suffix="$"
        />
        <Field
          label="DTE"
          value={dteOverride?.toString() ?? ""}
          placeholder={autoDte.toString()}
          onChange={(v) => onDteOverrideChange(v ? parseInt_(v) : null)}
        />
      </div>
      <div className="mt-2 text-xs text-gray-700">
        Enter bid/ask from your brokerage&apos;s option chain for the box at your target expiry
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/QuoteInputs.tsx
git commit -m "feat: add QuoteInputs component"
```

---

### Task 5: Create MaturityCurve component

**Files:**
- Create: `src/components/calculator/MaturityCurve.tsx`
- Create: `__tests__/maturity-curve-data.test.ts`

- [ ] **Step 1: Write the test for curve data computation**

Create `__tests__/maturity-curve-data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calcBoxRateSimple, calcFeeImpact, calcAllInRate } from "@/lib/calc";
import { findNearestExpiry, calcDte } from "@/lib/strikes";
import { TENORS } from "@/lib/constants";
import type { BrokerageFees } from "@/lib/types";

const FEES: BrokerageFees = { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 };

describe("maturity curve data", () => {
  it("computes a rate for every tenor given treasury rates", () => {
    const treasuryRates = {
      "3M": 0.048,
      "6M": 0.046,
      "1Y": 0.043,
      "2Y": 0.041,
      "3Y": 0.040,
      "5Y": 0.039,
    };
    const spreadBps = 10;
    const amount = 100000;

    const curveData = TENORS.map(({ value }) => {
      const dte = calcDte(findNearestExpiry(value, new Date()));
      const impliedRate = calcBoxRateSimple(treasuryRates[value] ?? 0.04, spreadBps);
      const feeImpact = calcFeeImpact(FEES, 1, amount, dte);
      return {
        tenor: value,
        rate: calcAllInRate(impliedRate, feeImpact),
      };
    });

    expect(curveData).toHaveLength(6);
    curveData.forEach((point) => {
      expect(point.rate).toBeGreaterThan(0);
      expect(point.rate).toBeLessThan(0.10);
    });
    // Short tenors should have higher rates than long tenors (inverted yield curve)
    expect(curveData[0].rate).toBeGreaterThan(curveData[5].rate);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run __tests__/maturity-curve-data.test.ts`
Expected: PASS (this tests existing lib functions, not new code).

- [ ] **Step 3: Create the MaturityCurve component**

Create `src/components/calculator/MaturityCurve.tsx`:

```tsx
"use client";

import { TENORS } from "@/lib/constants";
import type { Tenor } from "@/lib/types";

interface CurvePoint {
  tenor: Tenor;
  rate: number;
}

interface MaturityCurveProps {
  data: CurvePoint[];
  selectedTenor: Tenor;
}

const CHART_W = 400;
const CHART_H = 100;
const PAD_L = 44;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 22;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function MaturityCurve({ data, selectedTenor }: MaturityCurveProps) {
  if (data.length === 0) return null;

  const rates = data.map((d) => d.rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const range = maxRate - minRate || 0.005; // avoid zero range
  const padded = range * 0.15;

  function yForRate(rate: number): number {
    return PAD_T + PLOT_H * (1 - (rate - (minRate - padded)) / (range + padded * 2));
  }

  function xForIndex(i: number): number {
    return PAD_L + (i / (data.length - 1)) * PLOT_W;
  }

  const points = data.map((d, i) => ({ x: xForIndex(i), y: yForRate(d.rate), ...d }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  const yMid = (minRate + maxRate) / 2;
  const yTop = maxRate + padded * 0.5;
  const yBot = minRate - padded * 0.5;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
        Rate by maturity
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: 90 }}>
        {/* Grid */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={CHART_H - PAD_B} stroke="#1f2937" />
        <line x1={PAD_L} y1={CHART_H - PAD_B} x2={CHART_W - PAD_R} y2={CHART_H - PAD_B} stroke="#1f2937" />
        <line x1={PAD_L} y1={yForRate(yMid)} x2={CHART_W - PAD_R} y2={yForRate(yMid)} stroke="#1f2937" strokeWidth={0.5} strokeDasharray="4" />

        {/* Y labels */}
        <text x={PAD_L - 4} y={yForRate(yBot) + 3} fill="#4b5563" fontSize={7} textAnchor="end">{formatPct(yBot)}</text>
        <text x={PAD_L - 4} y={yForRate(yMid) + 3} fill="#4b5563" fontSize={7} textAnchor="end">{formatPct(yMid)}</text>
        <text x={PAD_L - 4} y={yForRate(yTop) + 3} fill="#4b5563" fontSize={7} textAnchor="end">{formatPct(yTop)}</text>

        {/* Curve line */}
        <polyline points={polyline} fill="none" stroke="#4ade80" strokeWidth={2} />

        {/* Data points and labels */}
        {points.map((p) => {
          const isSelected = p.tenor === selectedTenor;
          const tenorLabel = TENORS.find((t) => t.value === p.tenor)?.label ?? p.tenor;
          return (
            <g key={p.tenor}>
              {isSelected && (
                <line x1={p.x} y1={p.y} x2={p.x} y2={CHART_H - PAD_B} stroke="#22c55e" strokeWidth={1} strokeDasharray="3" />
              )}
              <circle cx={p.x} cy={p.y} r={isSelected ? 4.5 : 2.5} fill="#4ade80" stroke={isSelected ? "#0f1117" : "none"} strokeWidth={isSelected ? 2 : 0} />
              <text x={p.x} y={p.y - 7} fill={isSelected ? "#22c55e" : "#4ade80"} fontSize={isSelected ? 8 : 7} textAnchor="middle" fontWeight={isSelected ? 700 : 500}>
                {formatPct(p.rate)}
              </text>
              <text x={p.x} y={CHART_H - 4} fill={isSelected ? "#22c55e" : "#6b7280"} fontSize={isSelected ? 8 : 7} textAnchor="middle" fontWeight={isSelected ? 600 : 400}>
                {tenorLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add __tests__/maturity-curve-data.test.ts src/components/calculator/MaturityCurve.tsx
git commit -m "feat: add MaturityCurve component and curve data test"
```

---

### Task 6: Create RateBreakdown component

**Files:**
- Create: `src/components/calculator/RateBreakdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

interface EstimateBreakdownProps {
  mode: "estimate";
  treasuryYield: number;
  spreadBps: number;
  feeImpact: number;
  allInRate: number;
  tenor: string;
}

interface QuotesBreakdownProps {
  mode: "quotes";
  midPrice: number;
  strikeWidth: number;
  dte: number;
  impliedRate: number;
  feeImpact: number;
  allInRate: number;
}

type RateBreakdownProps = EstimateBreakdownProps | QuotesBreakdownProps;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function RateBreakdown(props: RateBreakdownProps) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
        Rate breakdown
      </div>
      <div className="space-y-1.5">
        {props.mode === "estimate" ? (
          <>
            <Row label={`${props.tenor} Treasury yield`} value={formatPct(props.treasuryYield)} />
            <Row label="+ Liquidity spread" value={formatPct(props.spreadBps / 10000)} />
            <Row label="+ Estimated fees" value={formatPct(props.feeImpact)} />
          </>
        ) : (
          <>
            <Row label="Box mid price" value={props.midPrice.toFixed(2)} />
            <Row label="Strike width" value={`$${props.strikeWidth.toLocaleString()}`} />
            <Row label="Days to expiry" value={props.dte.toString()} />
            <div className="my-1 border-t border-gray-700" />
            <Row
              label={`Implied rate: (${props.strikeWidth} − ${props.midPrice.toFixed(2)}) / ${props.midPrice.toFixed(2)} × 365/${props.dte}`}
              value={formatPct(props.impliedRate)}
            />
            <Row label="+ Estimated fees" value={formatPct(props.feeImpact)} />
          </>
        )}
        <div className="mt-1 border-t border-gray-700 pt-2">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-200">All-in rate</span>
            <span className="text-green-400">{formatPct(props.allInRate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/RateBreakdown.tsx
git commit -m "feat: add RateBreakdown component for estimate and quotes modes"
```

---

### Task 7: Update RateResult to remove methodology string

**Files:**
- Modify: `src/components/calculator/RateResult.tsx`

- [ ] **Step 1: Simplify RateResult**

Replace the full contents of `src/components/calculator/RateResult.tsx` with:

```tsx
"use client";

import { Tooltip } from "@/components/ui/Tooltip";

interface RateResultProps {
  boxRate: number;
  afterTaxRate: number;
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function RateResult({ boxRate, afterTaxRate }: RateResultProps) {
  return (
    <div className="rounded-xl border border-green-700 bg-green-900/15 p-5 text-center">
      <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">
        Your estimated rate
      </div>
      <div className="text-5xl font-bold tracking-tight text-green-400">
        {formatPct(boxRate)}
      </div>
      <div className="mt-1 text-sm text-gray-400">
        After-tax effective:{" "}
        <strong className="text-green-300">~{formatPct(afterTaxRate)}</strong>
        <Tooltip content="SPX options are Section 1256 contracts: 60% taxed as long-term capital gains, 40% as short-term. The implied interest is deductible at this blended rate." />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/RateResult.tsx
git commit -m "refactor: simplify RateResult, remove methodology string"
```

---

### Task 8: Rewrite Calculator with two-tab layout

**Files:**
- Modify: `src/components/calculator/Calculator.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Calculator.tsx**

Replace the full contents of `src/components/calculator/Calculator.tsx` with:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AmountInput } from "./AmountInput";
import { DurationPicker } from "./DurationPicker";
import { TabSwitcher, type CalcTab } from "./TabSwitcher";
import { QuoteInputs } from "./QuoteInputs";
import { RateResult } from "./RateResult";
import { RateBreakdown } from "./RateBreakdown";
import { MaturityCurve } from "./MaturityCurve";
import { TaxRateInputs } from "./TaxRateInputs";
import {
  calcBoxRateSimple,
  calcBoxRateFromQuotes,
  calcBlendedTaxRate,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
} from "@/lib/calc";
import { findNearestExpiry, calcDte } from "@/lib/strikes";
import {
  BROKERAGE_FEES,
  DEFAULT_SPREAD_BPS,
  DEFAULT_FEDERAL_TAX_RATE,
  DEFAULT_STATE_TAX_RATE,
  LTCG_RATE_FEDERAL,
  TENORS,
} from "@/lib/constants";
import type { Tenor, TreasuryRates } from "@/lib/types";

// Fees are identical across brokerages — use any
const FEES = BROKERAGE_FEES.ibkr;

export function Calculator() {
  // Shared state
  const [amount, setAmount] = useState(100000);
  const [tenor, setTenor] = useState<Tenor>("1Y");
  const [federalTaxRate, setFederalTaxRate] = useState(DEFAULT_FEDERAL_TAX_RATE);
  const [stateTaxRate, setStateTaxRate] = useState(DEFAULT_STATE_TAX_RATE);
  const [treasuryRates, setTreasuryRates] = useState<TreasuryRates>({});
  const [ratesError, setRatesError] = useState(false);

  // Tab state
  const [tab, setTab] = useState<CalcTab>("estimate");

  // From Quotes state (isolated to tab)
  const [bidPrice, setBidPrice] = useState<number | null>(null);
  const [askPrice, setAskPrice] = useState<number | null>(null);
  const [strikeWidth, setStrikeWidth] = useState<number | null>(null);
  const [dteOverride, setDteOverride] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/rates/treasury")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        if (data.error || Object.keys(data).length === 0) {
          setRatesError(true);
        } else {
          setTreasuryRates(data);
        }
      })
      .catch(() => setRatesError(true));
  }, []);

  // Clear quote inputs when tenor changes (quotes are tenor-specific)
  function handleTenorChange(newTenor: Tenor) {
    setTenor(newTenor);
    setBidPrice(null);
    setAskPrice(null);
    setStrikeWidth(null);
    setDteOverride(null);
  }

  const expiry = findNearestExpiry(tenor, new Date());
  const tenorDte = calcDte(expiry);
  const dte = dteOverride !== null && dteOverride > 0 ? dteOverride : tenorDte;

  // Tax calculation (shared)
  const ltcg = federalTaxRate <= 0.24 ? 0.15 : LTCG_RATE_FEDERAL;
  const stcg = federalTaxRate;
  const blendedTax = calcBlendedTaxRate(ltcg, stcg, stateTaxRate);

  // Estimate tab result
  const estimateResult = useMemo(() => {
    const treasuryYield = treasuryRates[tenor] ?? 0.04;
    const impliedRate = calcBoxRateSimple(treasuryYield, DEFAULT_SPREAD_BPS);
    const feeImpact = calcFeeImpact(FEES, 1, amount, tenorDte);
    const allInRate = calcAllInRate(impliedRate, feeImpact);
    const afterTaxRate = calcAfterTaxRate(allInRate, blendedTax);
    return { impliedRate, allInRate, afterTaxRate, feeImpact, treasuryYield };
  }, [amount, tenor, treasuryRates, blendedTax, tenorDte]);

  // From Quotes tab result
  const hasQuotes = bidPrice !== null && askPrice !== null && strikeWidth !== null;
  const quotesResult = useMemo(() => {
    if (!hasQuotes) return null;
    const midpoint = (bidPrice! + askPrice!) / 2;
    const impliedRate = calcBoxRateFromQuotes(midpoint, strikeWidth!, dte);
    const feeImpact = calcFeeImpact(FEES, 1, amount, dte);
    const allInRate = calcAllInRate(impliedRate, feeImpact);
    const afterTaxRate = calcAfterTaxRate(allInRate, blendedTax);
    return { midpoint, impliedRate, allInRate, afterTaxRate, feeImpact };
  }, [bidPrice, askPrice, strikeWidth, dte, amount, blendedTax, hasQuotes]);

  // Maturity curve data (for Estimate tab)
  const curveData = useMemo(() => {
    return TENORS.map(({ value }) => {
      const tYield = treasuryRates[value] ?? 0.04;
      const tDte = calcDte(findNearestExpiry(value, new Date()));
      const rate = calcAllInRate(
        calcBoxRateSimple(tYield, DEFAULT_SPREAD_BPS),
        calcFeeImpact(FEES, 1, amount, tDte)
      );
      return { tenor: value, rate };
    });
  }, [treasuryRates, amount]);

  // Active result for the CTA link
  const activeResult = tab === "from-quotes" && quotesResult ? quotesResult : estimateResult;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Borrow at near-Treasury rates
        </h1>
        <p className="mt-2 text-gray-500">
          Calculate your box spread borrowing cost
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-700 bg-gray-900 p-6">
        <AmountInput value={amount} onChange={setAmount} />
        <DurationPicker value={tenor} onChange={handleTenorChange} />
        <TabSwitcher value={tab} onChange={setTab} />

        {tab === "estimate" ? (
          <div className="space-y-3">
            <RateResult
              boxRate={estimateResult.allInRate}
              afterTaxRate={estimateResult.afterTaxRate}
            />
            <TaxRateInputs
              federalRate={federalTaxRate}
              stateRate={stateTaxRate}
              onFederalChange={setFederalTaxRate}
              onStateChange={setStateTaxRate}
            />
            <MaturityCurve data={curveData} selectedTenor={tenor} />
            <RateBreakdown
              mode="estimate"
              treasuryYield={estimateResult.treasuryYield}
              spreadBps={DEFAULT_SPREAD_BPS}
              feeImpact={estimateResult.feeImpact}
              allInRate={estimateResult.allInRate}
              tenor={TENORS.find((t) => t.value === tenor)?.label ?? tenor}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <QuoteInputs
              bidPrice={bidPrice}
              askPrice={askPrice}
              strikeWidth={strikeWidth}
              dteOverride={dteOverride}
              autoDte={tenorDte}
              onBidChange={setBidPrice}
              onAskChange={setAskPrice}
              onStrikeWidthChange={setStrikeWidth}
              onDteOverrideChange={setDteOverride}
            />
            {quotesResult ? (
              <>
                <RateResult
                  boxRate={quotesResult.allInRate}
                  afterTaxRate={quotesResult.afterTaxRate}
                />
                <TaxRateInputs
                  federalRate={federalTaxRate}
                  stateRate={stateTaxRate}
                  onFederalChange={setFederalTaxRate}
                  onStateChange={setStateTaxRate}
                />
                <RateBreakdown
                  mode="quotes"
                  midPrice={quotesResult.midpoint}
                  strikeWidth={strikeWidth!}
                  dte={dte}
                  impliedRate={quotesResult.impliedRate}
                  feeImpact={quotesResult.feeImpact}
                  allInRate={quotesResult.allInRate}
                />
              </>
            ) : (
              <div className="rounded-xl border border-gray-700 bg-gray-800/30 p-8 text-center text-sm text-gray-500">
                Enter bid, ask, and width above to calculate your rate from market quotes.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center">
        <Link
          href={`/order?amount=${amount}&tenor=${tenor}&rate=${activeResult.impliedRate}&dte=${dte}`}
          className="inline-block rounded-xl bg-green-500 px-8 py-3.5 text-base font-semibold text-gray-950 transition-colors hover:bg-green-400"
        >
          Build My Order →
        </Link>
        <p className="mt-2 text-xs text-gray-600">
          Choose your brokerage &amp; get step-by-step instructions
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/Calculator.tsx
git commit -m "feat: rewrite Calculator with two-tab layout, maturity curve, and math breakdown"
```

---

### Task 9: Update order page link (remove brokerage param)

**Files:**
- Modify: `src/app/order/page.tsx:39`

- [ ] **Step 1: Make brokerage default to ibkr (no longer passed from calculator)**

In `src/app/order/page.tsx`, line 39 already defaults to `"ibkr"` when the param is missing:

```typescript
const brokerage: Brokerage = isValidBrokerage(rawBrokerage) ? rawBrokerage : "ibkr";
```

No code change needed — the order page already handles missing brokerage gracefully. The calculator no longer passes `&brokerage=` in the URL, so the default kicks in.

- [ ] **Step 2: Verify the order page CTA text update**

The Calculator's CTA subtitle was updated in Task 8 to say "Choose your brokerage & get step-by-step instructions" which is accurate since the brokerage will be selected on the order page.

No commit needed — this task is a verification step.

---

### Task 10: Delete unused components

**Files:**
- Delete: `src/components/calculator/AdvancedPanel.tsx`
- Delete: `src/components/calculator/BrokeragePicker.tsx`
- Delete: `src/components/calculator/ComparisonStrip.tsx`

- [ ] **Step 1: Delete unused files**

```bash
git rm src/components/calculator/AdvancedPanel.tsx
git rm src/components/calculator/BrokeragePicker.tsx
git rm src/components/calculator/ComparisonStrip.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "AdvancedPanel\|BrokeragePicker\|ComparisonStrip" src/`
Expected: No results (Calculator.tsx no longer imports them).

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete AdvancedPanel, BrokeragePicker, ComparisonStrip"
```

---

### Task 11: Run full test suite and build

- [ ] **Step 1: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npx next build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit any fixes if needed**

If there are type or lint errors, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build/test issues from calculator redesign"
```

---

### Task 12: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `npx next dev`

- [ ] **Step 2: Test Estimate tab**

1. Open `http://localhost:3000`
2. Verify amount input works, default 100,000
3. Click each tenor pill — rate card and maturity curve should update
4. Verify maturity curve shows 6 data points with selected tenor highlighted
5. Verify math breakdown shows Treasury yield + spread + fees = all-in rate
6. Verify tax rate inputs change the after-tax rate

- [ ] **Step 3: Test From Quotes tab**

1. Click "From Quotes" tab
2. Verify empty state message shows
3. Enter bid: 956.20, ask: 958.80, width: 1000
4. Verify rate card appears with calculated rate
5. Verify math breakdown shows the formula
6. Change tenor — verify quote inputs are cleared

- [ ] **Step 4: Test Build My Order link**

1. Click "Build My Order →"
2. Verify order page loads with amount, tenor, and rate from URL params
3. Verify order page defaults brokerage to IBKR
