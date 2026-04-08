# boxspreads.app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web calculator that shows box spread borrowing rates, compares them to alternatives, and generates error-proof order instructions for IBKR/Fidelity/Schwab.

**Architecture:** Next.js 15 App Router with client-side rate calculations for instant reactivity. Supabase Postgres caches Treasury yields (fetched daily from FRED API) and brokerage fee data. API route handlers serve cached data. No auth in v1.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres), Vercel, FRED API

**Spec:** `docs/superpowers/specs/2026-04-07-boxspreads-app-design.md`

---

## File Structure

```
boxspreads-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx              — Root layout, fonts, metadata
│   │   ├── page.tsx                — Calculator landing page
│   │   ├── order/
│   │   │   └── page.tsx            — Order builder (reads query params)
│   │   ├── learn/
│   │   │   └── page.tsx            — Education hub
│   │   └── api/
│   │       ├── rates/
│   │       │   ├── treasury/route.ts   — GET cached Treasury yields
│   │       │   └── comparison/route.ts — GET margin/SBLOC rates
│   │       ├── fees/
│   │       │   └── [brokerage]/route.ts — GET per-leg fees
│   │       └── strikes/route.ts        — GET suggested strikes
│   ├── lib/
│   │   ├── calc.ts                 — All rate calculation functions (pure, no deps)
│   │   ├── strikes.ts              — Strike selection logic (pure)
│   │   ├── types.ts                — Shared TypeScript types
│   │   ├── constants.ts            — Brokerage fees, tenor mappings, FRED series IDs
│   │   └── supabase.ts             — Supabase client singleton
│   └── components/
│       ├── calculator/
│       │   ├── Calculator.tsx       — Main calculator orchestrator (client component)
│       │   ├── AmountInput.tsx      — Dollar amount input with formatting
│       │   ├── DurationPicker.tsx   — Tenor button group
│       │   ├── BrokeragePicker.tsx  — Brokerage selector
│       │   ├── AdvancedPanel.tsx    — Advanced mode toggle + inputs
│       │   ├── RateResult.tsx       — Big rate number + after-tax
│       │   └── ComparisonStrip.tsx  — Side-by-side rate comparison
│       ├── order/
│       │   ├── OrderSummary.tsx     — Carried params display
│       │   ├── LegTable.tsx         — 4-leg order table
│       │   ├── OrderParams.tsx      — Limit price, quantity, premium
│       │   ├── FeeBreakdown.tsx     — Commission/exchange/regulatory
│       │   ├── BrokerageGuide.tsx   — Step-by-step walkthrough
│       │   └── PreSubmitChecklist.tsx — Safety checklist
│       └── ui/
│           ├── Tooltip.tsx          — Info tooltip (ⓘ icon)
│           └── ButtonGroup.tsx      — Reusable toggle button group
├── __tests__/
│   ├── calc.test.ts                — Rate calculation tests
│   ├── strikes.test.ts             — Strike selection tests
│   └── api/
│       └── treasury.test.ts        — API route tests
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  — Tables + seed data
├── .env.local.example              — Required env vars template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `boxspreads-app/` (entire project root)
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.local.example`

- [ ] **Step 1: Create Next.js project**

```bash
cd ~/projects
npx create-next-app@latest boxspreads-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
cd boxspreads-app
```

Expected: Project scaffolded with App Router, TypeScript, Tailwind, pnpm.

- [ ] **Step 2: Install dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create env template**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
FRED_API_KEY=your-fred-api-key
```

- [ ] **Step 5: Verify scaffolding works**

```bash
pnpm dev
```

Expected: Next.js dev server starts on localhost:3000 with default page.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 15 project with Tailwind, Vitest, Supabase deps"
```

---

## Task 2: Types & Constants

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Define types**

Create `src/lib/types.ts`:

```ts
export type Tenor = "3M" | "6M" | "1Y" | "2Y" | "3Y" | "5Y";

export type Brokerage = "ibkr" | "fidelity" | "schwab";

export type OptionType = "call" | "put";
export type OrderAction = "buy" | "sell";

export interface BoxLeg {
  strike: number;
  type: OptionType;
  action: OrderAction;
  expiry: string; // ISO date
}

export interface BoxOrder {
  legs: [BoxLeg, BoxLeg, BoxLeg, BoxLeg];
  spreadWidth: number;
  contracts: number;
  limitPrice: number;
  expiry: string;
}

export interface RateResult {
  boxRate: number; // annualized, e.g. 0.0412
  afterTaxRate: number;
  feeImpact: number;
  allInRate: number;
}

export interface TreasuryRates {
  [tenor: string]: number; // e.g. { "1Y": 0.0382 }
}

export interface BrokerageFees {
  commission: number; // per contract per leg
  exchangeFee: number;
  regulatoryFee: number;
}

export interface ComparisonRates {
  marginLoan: number;
  sbloc: number | null;
  heloc: number;
}

export interface CalculatorInputs {
  amount: number;
  tenor: Tenor;
  brokerage: Brokerage;
  spreadBps: number;
  // Advanced mode
  bidPrice: number | null;
  askPrice: number | null;
  strikeWidth: number | null;
  federalTaxRate: number;
  stateTaxRate: number;
}
```

- [ ] **Step 2: Define constants**

Create `src/lib/constants.ts`:

```ts
import type { Tenor, Brokerage, BrokerageFees, ComparisonRates } from "./types";

export const TENORS: { value: Tenor; label: string; months: number }[] = [
  { value: "3M", label: "3 mo", months: 3 },
  { value: "6M", label: "6 mo", months: 6 },
  { value: "1Y", label: "1 yr", months: 12 },
  { value: "2Y", label: "2 yr", months: 24 },
  { value: "3Y", label: "3 yr", months: 36 },
  { value: "5Y", label: "5 yr", months: 60 },
];

export const TENOR_TO_FRED_SERIES: Record<Tenor, string> = {
  "3M": "DGS3MO",
  "6M": "DGS6MO",
  "1Y": "DGS1",
  "2Y": "DGS2",
  "3Y": "DGS3",
  "5Y": "DGS5",
};

export const BROKERAGES: { value: Brokerage; label: string }[] = [
  { value: "ibkr", label: "IBKR" },
  { value: "fidelity", label: "Fidelity" },
  { value: "schwab", label: "Schwab" },
];

export const BROKERAGE_FEES: Record<Brokerage, BrokerageFees> = {
  ibkr: { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
  fidelity: { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
  schwab: { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
};

// Published brokerage margin rates (updated manually, approx as of 2026)
export const COMPARISON_RATES: Record<Brokerage, ComparisonRates> = {
  ibkr: { marginLoan: 0.1133, sbloc: null, heloc: 0.075 },
  fidelity: { marginLoan: 0.1175, sbloc: 0.068, heloc: 0.075 },
  schwab: { marginLoan: 0.1125, sbloc: 0.065, heloc: 0.075 },
};

export const DEFAULT_SPREAD_BPS = 30;
export const SPX_MULTIPLIER = 100;
export const DEFAULT_FEDERAL_TAX_RATE = 0.37;
export const DEFAULT_STATE_TAX_RATE = 0.0;
export const LTCG_RATE_FEDERAL = 0.238; // top bracket including NIIT
export const STCG_RATE_FEDERAL = 0.37; // same as ordinary income top bracket
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add types and constants for box spread calculations"
```

---

## Task 3: Rate Calculation Engine (TDD)

**Files:**
- Create: `src/lib/calc.ts`
- Create: `__tests__/calc.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/calc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  calcBoxRateSimple,
  calcBoxRateFromQuotes,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
  calcBlendedTaxRate,
} from "@/lib/calc";

describe("calcBoxRateSimple", () => {
  it("adds spread to treasury yield", () => {
    // 1Y Treasury at 3.82% + 30bps = 4.12%
    expect(calcBoxRateSimple(0.0382, 30)).toBeCloseTo(0.0412, 4);
  });

  it("handles zero spread", () => {
    expect(calcBoxRateSimple(0.0382, 0)).toBeCloseTo(0.0382, 4);
  });
});

describe("calcBoxRateFromQuotes", () => {
  it("calculates implied rate from bid/ask midpoint", () => {
    // $2,500 wide box, midpoint $2,401.50, 365 DTE
    const rate = calcBoxRateFromQuotes(2401.5, 2500, 365);
    // (2500 - 2401.5) / 2401.5 * (365/365) = 0.041016...
    expect(rate).toBeCloseTo(0.041, 3);
  });

  it("annualizes correctly for shorter durations", () => {
    // 182 DTE (6 months), box price $2,450, width $2,500
    const rate = calcBoxRateFromQuotes(2450, 2500, 182);
    // (2500 - 2450) / 2450 * (365/182) = 0.04095...
    expect(rate).toBeCloseTo(0.0410, 3);
  });
});

describe("calcBlendedTaxRate", () => {
  it("calculates Section 1256 blended rate (60/40)", () => {
    // Federal: LTCG 23.8%, STCG 37%, no state
    const rate = calcBlendedTaxRate(0.238, 0.37, 0);
    // 0.60 * 0.238 + 0.40 * 0.37 = 0.1428 + 0.148 = 0.2908
    expect(rate).toBeCloseTo(0.2908, 4);
  });

  it("includes state tax", () => {
    // Federal LTCG 23.8%, STCG 37%, CA state 13.3% (applied flat)
    const rate = calcBlendedTaxRate(0.238, 0.37, 0.133);
    // federal blended: 0.2908, + state: 0.133 = 0.4238
    expect(rate).toBeCloseTo(0.4238, 4);
  });
});

describe("calcAfterTaxRate", () => {
  it("reduces rate by blended tax rate", () => {
    // 4.12% rate, 29.08% blended tax
    const afterTax = calcAfterTaxRate(0.0412, 0.2908);
    // 0.0412 * (1 - 0.2908) = 0.02921...
    expect(afterTax).toBeCloseTo(0.0292, 3);
  });
});

describe("calcFeeImpact", () => {
  it("calculates annualized fee impact", () => {
    // IBKR: commission $0.65, exchange $0.68, regulatory $0.21
    // 4 legs, $250K borrow, 365 DTE
    const impact = calcFeeImpact(
      { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
      1, // 1 contract
      250000,
      365
    );
    // total = (0.65*4 + 0.68*4 + 0.21) * 1 = 5.53
    // Wait — regulatory is total, not per-leg. Let's be precise:
    // total = (0.65 + 0.68) * 4 + 0.21 = 5.53
    // Actually per spec: (commission × 4) + (exchangeFee × 4) + regulatoryFees
    // = 2.60 + 2.72 + 0.21 = 5.53 — but spec says total $6.16 with regulatory $0.84
    // Regulatory is also per-leg in the constant. So: (0.65 + 0.68 + 0.21) * 4 = 6.16
    // annualized: 6.16 / 250000 * (365/365) = 0.00002464
    expect(impact).toBeCloseTo(0.0000246, 5);
  });

  it("scales with number of contracts", () => {
    const impact1 = calcFeeImpact(
      { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
      1,
      250000,
      365
    );
    const impact2 = calcFeeImpact(
      { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
      2,
      250000,
      365
    );
    expect(impact2).toBeCloseTo(impact1 * 2, 6);
  });
});

describe("calcAllInRate", () => {
  it("combines implied rate and fee impact", () => {
    expect(calcAllInRate(0.0412, 0.0000246)).toBeCloseTo(0.0412246, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test
```

Expected: All tests FAIL — `calc` module doesn't exist yet.

- [ ] **Step 3: Implement calculation functions**

Create `src/lib/calc.ts`:

```ts
import type { BrokerageFees } from "./types";

/**
 * Simple mode: Treasury yield + spread in basis points.
 */
export function calcBoxRateSimple(
  treasuryYield: number,
  spreadBps: number
): number {
  return treasuryYield + spreadBps / 10000;
}

/**
 * Advanced mode: implied rate from actual box spread price.
 * boxPrice = midpoint of bid/ask (or bid for conservative estimate)
 * strikeWidth = upper strike - lower strike
 * dte = days to expiration
 */
export function calcBoxRateFromQuotes(
  boxPrice: number,
  strikeWidth: number,
  dte: number
): number {
  return ((strikeWidth - boxPrice) / boxPrice) * (365 / dte);
}

/**
 * Section 1256 blended tax rate: 60% LTCG + 40% STCG, plus state tax.
 * State tax is applied flat (not blended) since states don't differentiate LTCG/STCG.
 */
export function calcBlendedTaxRate(
  ltcgRate: number,
  stcgRate: number,
  stateTaxRate: number
): number {
  const federalBlended = 0.6 * ltcgRate + 0.4 * stcgRate;
  return federalBlended + stateTaxRate;
}

/**
 * After-tax effective rate: reduces borrowing cost by tax deduction value.
 */
export function calcAfterTaxRate(
  boxRate: number,
  blendedTaxRate: number
): number {
  return boxRate * (1 - blendedTaxRate);
}

/**
 * Fee impact: annualized cost of trading fees relative to borrow amount.
 * All fee fields are per-contract-per-leg.
 */
export function calcFeeImpact(
  fees: BrokerageFees,
  contracts: number,
  borrowAmount: number,
  dte: number
): number {
  const perContract =
    (fees.commission + fees.exchangeFee + fees.regulatoryFee) * 4;
  const totalFees = perContract * contracts;
  return (totalFees / borrowAmount) * (365 / dte);
}

/**
 * All-in rate: implied rate + fee impact.
 */
export function calcAllInRate(
  impliedRate: number,
  feeImpact: number
): number {
  return impliedRate + feeImpact;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc.ts __tests__/calc.test.ts
git commit -m "feat: add rate calculation engine with tests (TDD)"
```

---

## Task 4: Strike Selection Logic (TDD)

**Files:**
- Create: `src/lib/strikes.ts`
- Create: `__tests__/strikes.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/strikes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  calcSpreadWidth,
  selectStrikes,
  findNearestExpiry,
  buildBoxLegs,
} from "@/lib/strikes";

describe("calcSpreadWidth", () => {
  it("calculates spread width for 1 contract", () => {
    // $250K / (100 * 1) = 2500
    expect(calcSpreadWidth(250000, 1)).toBe(2500);
  });

  it("calculates spread width for multiple contracts", () => {
    // $500K / (100 * 2) = 2500
    expect(calcSpreadWidth(500000, 2)).toBe(2500);
  });
});

describe("selectStrikes", () => {
  it("selects round strikes near current SPX level", () => {
    const { lower, upper } = selectStrikes(250000, 1, 5500);
    expect(lower).toBe(5500);
    expect(upper).toBe(8000); // 5500 + 2500
  });

  it("rounds down to nearest 500", () => {
    const { lower, upper } = selectStrikes(250000, 1, 5732);
    expect(lower).toBe(5500);
    expect(upper).toBe(8000);
  });

  it("adjusts for non-round spread widths", () => {
    // $100K borrow: width = 1000
    const { lower, upper } = selectStrikes(100000, 1, 5500);
    expect(lower).toBe(5500);
    expect(upper).toBe(6500);
  });
});

describe("findNearestExpiry", () => {
  it("finds the third Friday of the target month", () => {
    // 1Y from 2026-04-07 → target Dec 2026
    // Third Friday of Dec 2026 is Dec 18, 2026
    const expiry = findNearestExpiry("1Y", new Date("2026-04-07"));
    expect(expiry).toBe("2026-12-18");
  });

  it("finds 6M expiry", () => {
    // 6M from 2026-04-07 → target Oct 2026
    // Third Friday of Oct 2026 is Oct 16, 2026
    const expiry = findNearestExpiry("6M", new Date("2026-04-07"));
    expect(expiry).toBe("2026-10-16");
  });

  it("finds 3M expiry", () => {
    // 3M from 2026-04-07 → target Jul 2026
    // Third Friday of Jul 2026 is Jul 17, 2026
    const expiry = findNearestExpiry("3M", new Date("2026-04-07"));
    expect(expiry).toBe("2026-07-17");
  });
});

describe("buildBoxLegs", () => {
  it("builds 4 correct legs for a short box (borrowing)", () => {
    const legs = buildBoxLegs(4000, 6500, "2026-12-18");
    expect(legs).toHaveLength(4);
    // Leg 1: Buy lower call
    expect(legs[0]).toEqual({
      strike: 4000,
      type: "call",
      action: "buy",
      expiry: "2026-12-18",
    });
    // Leg 2: Sell upper call
    expect(legs[1]).toEqual({
      strike: 6500,
      type: "call",
      action: "sell",
      expiry: "2026-12-18",
    });
    // Leg 3: Sell lower put
    expect(legs[2]).toEqual({
      strike: 4000,
      type: "put",
      action: "sell",
      expiry: "2026-12-18",
    });
    // Leg 4: Buy upper put
    expect(legs[3]).toEqual({
      strike: 6500,
      type: "put",
      action: "buy",
      expiry: "2026-12-18",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test
```

Expected: All new tests FAIL.

- [ ] **Step 3: Implement strike selection**

Create `src/lib/strikes.ts`:

```ts
import type { Tenor, BoxLeg } from "./types";
import { SPX_MULTIPLIER, TENORS } from "./constants";

/**
 * Calculate the spread width needed for a given borrow amount.
 */
export function calcSpreadWidth(
  borrowAmount: number,
  contracts: number
): number {
  return borrowAmount / (SPX_MULTIPLIER * contracts);
}

/**
 * Select lower and upper strikes for the box spread.
 * Uses round numbers near current SPX level for liquidity.
 */
export function selectStrikes(
  borrowAmount: number,
  contracts: number,
  currentSpx: number
): { lower: number; upper: number } {
  const width = calcSpreadWidth(borrowAmount, contracts);
  const lower = Math.floor(currentSpx / 500) * 500;
  const upper = lower + width;
  return { lower, upper };
}

/**
 * Find the third Friday of a month (standard SPX monthly expiry).
 */
function thirdFriday(year: number, month: number): Date {
  // month is 0-indexed
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  // Days until first Friday: (5 - dayOfWeek + 7) % 7
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  const thirdFridayDay = firstFriday + 14;
  return new Date(year, month, thirdFridayDay);
}

/**
 * Find nearest standard SPX monthly expiry for a given tenor from a start date.
 * Returns ISO date string (YYYY-MM-DD).
 */
export function findNearestExpiry(tenor: Tenor, from: Date): string {
  const tenorInfo = TENORS.find((t) => t.value === tenor);
  if (!tenorInfo) throw new Error(`Unknown tenor: ${tenor}`);

  const targetDate = new Date(from);
  targetDate.setMonth(targetDate.getMonth() + tenorInfo.months);

  // Find the third Friday of the target month
  const expiry = thirdFriday(targetDate.getFullYear(), targetDate.getMonth());

  const year = expiry.getFullYear();
  const month = String(expiry.getMonth() + 1).padStart(2, "0");
  const day = String(expiry.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build the 4 legs of a short box spread (borrowing).
 * Short box = buy lower call spread + sell lower put spread.
 */
export function buildBoxLegs(
  lowerStrike: number,
  upperStrike: number,
  expiry: string
): [BoxLeg, BoxLeg, BoxLeg, BoxLeg] {
  return [
    { strike: lowerStrike, type: "call", action: "buy", expiry },
    { strike: upperStrike, type: "call", action: "sell", expiry },
    { strike: lowerStrike, type: "put", action: "sell", expiry },
    { strike: upperStrike, type: "put", action: "buy", expiry },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strikes.ts __tests__/strikes.test.ts
git commit -m "feat: add strike selection logic with tests (TDD)"
```

---

## Task 5: Supabase Schema & Seed Data

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Treasury rates cached daily from FRED API
create table treasury_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  tenor text not null,
  yield_pct numeric(5,3) not null,
  source text not null default 'FRED',
  fetched_at timestamptz not null default now(),
  unique (date, tenor)
);

create index idx_treasury_rates_date on treasury_rates (date desc);

-- Brokerage margin/SBLOC rates for comparison
create table brokerage_rates (
  id uuid primary key default gen_random_uuid(),
  brokerage text not null,
  product text not null,
  rate_pct numeric(5,3) not null,
  min_balance numeric,
  updated_at timestamptz not null default now(),
  source_url text
);

-- Brokerage per-leg trading fees
create table brokerage_fees (
  id uuid primary key default gen_random_uuid(),
  brokerage text not null unique,
  commission numeric(6,2) not null,
  exchange_fee numeric(6,2) not null,
  regulatory_fee numeric(6,4) not null,
  updated_at timestamptz not null default now()
);

-- Seed brokerage fees
insert into brokerage_fees (brokerage, commission, exchange_fee, regulatory_fee) values
  ('ibkr', 0.65, 0.68, 0.21),
  ('fidelity', 0.65, 0.68, 0.21),
  ('schwab', 0.65, 0.68, 0.21);

-- Seed comparison rates (approximate, updated manually)
insert into brokerage_rates (brokerage, product, rate_pct, source_url) values
  ('ibkr', 'margin', 11.33, 'https://www.interactivebrokers.com/en/trading/margin-rates.php'),
  ('fidelity', 'margin', 11.75, 'https://www.fidelity.com/trading/margin-loans/margin-rates'),
  ('fidelity', 'sbloc', 6.80, 'https://www.fidelity.com/lending/securities-backed-line-of-credit'),
  ('schwab', 'margin', 11.25, 'https://www.schwab.com/margin-rates'),
  ('schwab', 'sbloc', 6.50, 'https://www.schwab.com/pledged-asset-line');
```

- [ ] **Step 2: Create Supabase client**

Create `src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/ src/lib/supabase.ts
git commit -m "feat: add Supabase schema, seed data, and client"
```

---

## Task 6: API Route — Treasury Rates

**Files:**
- Create: `src/app/api/rates/treasury/route.ts`

- [ ] **Step 1: Implement treasury rates endpoint**

Create `src/app/api/rates/treasury/route.ts`:

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TENOR_TO_FRED_SERIES } from "@/lib/constants";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";
const CACHE_MAX_AGE_HOURS = 24;

async function fetchFromFred(
  seriesId: string
): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  const url = `${FRED_BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = await res.json();
  const value = data.observations?.[0]?.value;
  if (!value || value === ".") return null;
  return parseFloat(value) / 100; // FRED returns percentage, we want decimal
}

async function getLatestRates(): Promise<Record<string, number>> {
  // Try cache first
  const { data: cached } = await supabase
    .from("treasury_rates")
    .select("tenor, yield_pct, fetched_at")
    .order("date", { ascending: false })
    .limit(9);

  const now = new Date();
  const cacheValid =
    cached &&
    cached.length > 0 &&
    now.getTime() - new Date(cached[0].fetched_at).getTime() <
      CACHE_MAX_AGE_HOURS * 3600 * 1000;

  if (cacheValid && cached) {
    const rates: Record<string, number> = {};
    for (const row of cached) {
      rates[row.tenor] = Number(row.yield_pct) / 100;
    }
    return rates;
  }

  // Fetch fresh from FRED
  const rates: Record<string, number> = {};
  const today = new Date().toISOString().split("T")[0];

  for (const [tenor, seriesId] of Object.entries(TENOR_TO_FRED_SERIES)) {
    const yieldVal = await fetchFromFred(seriesId);
    if (yieldVal !== null) {
      rates[tenor] = yieldVal;
      // Upsert to cache
      await supabase.from("treasury_rates").upsert(
        {
          date: today,
          tenor,
          yield_pct: yieldVal * 100, // store as percentage
          source: "FRED",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "date,tenor" }
      );
    }
  }

  return rates;
}

export async function GET() {
  try {
    const rates = await getLatestRates();
    return NextResponse.json(rates, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to fetch treasury rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch rates" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/rates/treasury/route.ts
git commit -m "feat: add treasury rates API route with FRED integration and caching"
```

---

## Task 7: API Routes — Comparison Rates, Fees, Strikes

**Files:**
- Create: `src/app/api/rates/comparison/route.ts`
- Create: `src/app/api/fees/[brokerage]/route.ts`
- Create: `src/app/api/strikes/route.ts`

- [ ] **Step 1: Implement comparison rates endpoint**

Create `src/app/api/rates/comparison/route.ts`:

```ts
import { NextResponse } from "next/server";
import { COMPARISON_RATES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json(COMPARISON_RATES, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
```

- [ ] **Step 2: Implement fees endpoint**

Create `src/app/api/fees/[brokerage]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { BROKERAGE_FEES } from "@/lib/constants";
import type { Brokerage } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brokerage: string }> }
) {
  const { brokerage } = await params;

  if (!(brokerage in BROKERAGE_FEES)) {
    return NextResponse.json(
      { error: `Unknown brokerage: ${brokerage}` },
      { status: 400 }
    );
  }

  return NextResponse.json(BROKERAGE_FEES[brokerage as Brokerage]);
}
```

- [ ] **Step 3: Implement strikes endpoint**

Create `src/app/api/strikes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { selectStrikes, findNearestExpiry, calcSpreadWidth } from "@/lib/strikes";
import type { Tenor } from "@/lib/types";
import { TENORS } from "@/lib/constants";

// Hardcoded current SPX level — updated periodically or fetched from a free source
const CURRENT_SPX = 5500;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get("amount"));
  const tenor = searchParams.get("tenor") as Tenor;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!TENORS.some((t) => t.value === tenor)) {
    return NextResponse.json({ error: "Invalid tenor" }, { status: 400 });
  }

  const contracts = 1; // v1: always 1 contract
  const { lower, upper } = selectStrikes(amount, contracts, CURRENT_SPX);
  const expiry = findNearestExpiry(tenor, new Date());
  const width = calcSpreadWidth(amount, contracts);

  return NextResponse.json({
    lower,
    upper,
    width,
    contracts,
    expiry,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add comparison rates, fees, and strikes API routes"
```

---

## Task 8: UI Foundation — Layout, Shared Components

**Files:**
- Create: `src/components/ui/Tooltip.tsx`
- Create: `src/components/ui/ButtonGroup.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Set up root layout with dark theme**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "boxspreads.app — Borrow at Near-Treasury Rates",
  description:
    "Calculate box spread borrowing rates, compare to margin loans and HELOCs, and build error-proof orders for IBKR, Fidelity, and Schwab.",
  openGraph: {
    title: "boxspreads.app — Borrow at Near-Treasury Rates",
    description:
      "Calculate box spread borrowing rates and build error-proof orders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}
      >
        <main className="mx-auto max-w-2xl px-4 py-12">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Set up globals.css**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Create ButtonGroup component**

Create `src/components/ui/ButtonGroup.tsx`:

```tsx
"use client";

interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color?: "green" | "blue";
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  color = "green",
}: ButtonGroupProps<T>) {
  const activeClass =
    color === "green"
      ? "border-green-600 bg-green-900/30 text-green-400 font-semibold"
      : "border-blue-600 bg-blue-900/30 text-blue-400 font-semibold";

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
            value === opt.value
              ? activeClass
              : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create Tooltip component**

Create `src/components/ui/Tooltip.tsx`:

```tsx
"use client";

import { useState } from "react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="ml-1 cursor-help border-b border-dotted border-gray-500 text-xs text-gray-500"
        aria-label="More info"
      >
        {children ?? "ⓘ"}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 shadow-lg">
          {content}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/
git commit -m "feat: add root layout with dark theme, ButtonGroup, and Tooltip components"
```

---

## Task 9: Calculator Page — Components

**Files:**
- Create: `src/components/calculator/AmountInput.tsx`
- Create: `src/components/calculator/DurationPicker.tsx`
- Create: `src/components/calculator/BrokeragePicker.tsx`
- Create: `src/components/calculator/RateResult.tsx`
- Create: `src/components/calculator/ComparisonStrip.tsx`
- Create: `src/components/calculator/AdvancedPanel.tsx`

- [ ] **Step 1: Create AmountInput**

Create `src/components/calculator/AmountInput.tsx`:

```tsx
"use client";

interface AmountInputProps {
  value: number;
  onChange: (amount: number) => void;
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    onChange(Number(raw) || 0);
  }

  const formatted = value > 0 ? value.toLocaleString("en-US") : "";

  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-gray-500">
        How much do you want to borrow?
      </label>
      <div className="flex items-center rounded-xl border border-gray-600 bg-gray-800 px-4 py-3.5">
        <span className="mr-2 text-lg text-gray-500">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatted}
          onChange={handleChange}
          placeholder="250,000"
          className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-gray-600"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DurationPicker**

Create `src/components/calculator/DurationPicker.tsx`:

```tsx
"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { TENORS } from "@/lib/constants";
import type { Tenor } from "@/lib/types";

interface DurationPickerProps {
  value: Tenor;
  onChange: (tenor: Tenor) => void;
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-gray-500">
        For how long?
      </label>
      <ButtonGroup options={TENORS} value={value} onChange={onChange} />
    </div>
  );
}
```

- [ ] **Step 3: Create BrokeragePicker**

Create `src/components/calculator/BrokeragePicker.tsx`:

```tsx
"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { BROKERAGES } from "@/lib/constants";
import type { Brokerage } from "@/lib/types";

interface BrokeragePickerProps {
  value: Brokerage;
  onChange: (brokerage: Brokerage) => void;
}

export function BrokeragePicker({ value, onChange }: BrokeragePickerProps) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-gray-500">
        Your brokerage
      </label>
      <ButtonGroup
        options={BROKERAGES}
        value={value}
        onChange={onChange}
        color="blue"
      />
    </div>
  );
}
```

- [ ] **Step 4: Create RateResult**

Create `src/components/calculator/RateResult.tsx`:

```tsx
"use client";

import { Tooltip } from "@/components/ui/Tooltip";

interface RateResultProps {
  boxRate: number;
  afterTaxRate: number;
  methodology: string;
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function RateResult({
  boxRate,
  afterTaxRate,
  methodology,
}: RateResultProps) {
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
      <div className="mt-2 text-xs text-gray-600">{methodology}</div>
    </div>
  );
}
```

- [ ] **Step 5: Create ComparisonStrip**

Create `src/components/calculator/ComparisonStrip.tsx`:

```tsx
"use client";

interface ComparisonStripProps {
  boxRate: number;
  marginLoan: number;
  sbloc: number | null;
  heloc: number;
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(1) + "%";
}

function ComparisonCard({
  label,
  rate,
  boxRate,
  isBoxSpread,
}: {
  label: string;
  rate: number;
  boxRate: number;
  isBoxSpread?: boolean;
}) {
  const diff = rate - boxRate;
  return (
    <div
      className={`flex-1 rounded-lg border p-3.5 text-center ${
        isBoxSpread
          ? "border-green-700 bg-green-900/15"
          : "border-gray-700 bg-gray-900"
      }`}
    >
      <div
        className={`text-xs uppercase tracking-wide ${isBoxSpread ? "text-green-500" : "text-gray-500"}`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold ${
          isBoxSpread ? "text-green-400" : rate > boxRate * 1.5 ? "text-red-400" : "text-orange-400"
        }`}
      >
        {formatPct(rate)}
      </div>
      {isBoxSpread ? (
        <div className="mt-0.5 text-xs text-green-600">Best rate</div>
      ) : (
        <div className="mt-0.5 text-xs text-red-800">
          +{formatPct(diff)} more
        </div>
      )}
    </div>
  );
}

export function ComparisonStrip({
  boxRate,
  marginLoan,
  sbloc,
  heloc,
}: ComparisonStripProps) {
  return (
    <div className="flex gap-3">
      <ComparisonCard
        label="Margin Loan"
        rate={marginLoan}
        boxRate={boxRate}
      />
      {sbloc !== null && (
        <ComparisonCard label="SBLOC" rate={sbloc} boxRate={boxRate} />
      )}
      <ComparisonCard label="HELOC" rate={heloc} boxRate={boxRate} />
      <ComparisonCard
        label="Box Spread"
        rate={boxRate}
        boxRate={boxRate}
        isBoxSpread
      />
    </div>
  );
}
```

- [ ] **Step 6: Create AdvancedPanel**

Create `src/components/calculator/AdvancedPanel.tsx`:

```tsx
"use client";

import { useState } from "react";

interface AdvancedPanelProps {
  bidPrice: number | null;
  askPrice: number | null;
  strikeWidth: number | null;
  federalTaxRate: number;
  stateTaxRate: number;
  spreadBps: number;
  onBidChange: (v: number | null) => void;
  onAskChange: (v: number | null) => void;
  onStrikeWidthChange: (v: number | null) => void;
  onFederalTaxChange: (v: number) => void;
  onStateTaxChange: (v: number) => void;
  onSpreadBpsChange: (v: number) => void;
}

function NumericField({
  label,
  hint,
  value,
  onChange,
  suffix,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-gray-600">{label}</div>
      <div className="flex items-center rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none"
        />
        {suffix && <span className="ml-1 text-xs text-gray-500">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-700">{hint}</div>}
    </div>
  );
}

export function AdvancedPanel(props: AdvancedPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <div>
          <span className="text-sm font-medium text-gray-300">
            Advanced mode
          </span>
          <span className="ml-2 text-xs text-gray-600">
            Use actual market quotes & custom tax rate
          </span>
        </div>
        <div
          className={`h-5 w-9 rounded-full transition-colors ${open ? "bg-green-700" : "bg-gray-600"}`}
        >
          <div
            className={`h-4 w-4 translate-y-0.5 rounded-full transition-transform ${
              open
                ? "translate-x-4.5 bg-white"
                : "translate-x-0.5 bg-gray-400"
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-gray-700 pt-4">
          {/* Market Quote Override */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
              Option chain quote (override Treasury model)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumericField
                label="Bid price"
                value={props.bidPrice?.toString() ?? ""}
                onChange={(v) =>
                  props.onBidChange(v ? parseFloat(v) || null : null)
                }
              />
              <NumericField
                label="Ask price"
                value={props.askPrice?.toString() ?? ""}
                onChange={(v) =>
                  props.onAskChange(v ? parseFloat(v) || null : null)
                }
              />
              <NumericField
                label="Spread width"
                value={props.strikeWidth?.toString() ?? ""}
                onChange={(v) =>
                  props.onStrikeWidthChange(v ? parseFloat(v) || null : null)
                }
                suffix="$"
              />
            </div>
            <div className="mt-1 text-xs text-gray-700">
              Enter bid/ask from your brokerage&apos;s SPX option chain for the
              box spread at your target expiry
            </div>
          </div>

          {/* Tax Rates */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
              Your marginal tax rate
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumericField
                label="Federal"
                value={(props.federalTaxRate * 100).toString()}
                onChange={(v) =>
                  props.onFederalTaxChange((parseFloat(v) || 0) / 100)
                }
                suffix="%"
              />
              <NumericField
                label="State"
                value={(props.stateTaxRate * 100).toString()}
                onChange={(v) =>
                  props.onStateTaxChange((parseFloat(v) || 0) / 100)
                }
                suffix="%"
              />
            </div>
          </div>

          {/* Spread Override */}
          <NumericField
            label="Rate spread over Treasury"
            hint="Default 30bps. Lower = more aggressive limit, slower fill."
            value={props.spreadBps.toString()}
            onChange={(v) => props.onSpreadBpsChange(parseInt(v) || 30)}
            suffix="bps"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/calculator/
git commit -m "feat: add calculator UI components (AmountInput, DurationPicker, BrokeragePicker, RateResult, ComparisonStrip, AdvancedPanel)"
```

---

## Task 10: Calculator Page — Orchestrator

**Files:**
- Create: `src/components/calculator/Calculator.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create Calculator orchestrator**

Create `src/components/calculator/Calculator.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { AmountInput } from "./AmountInput";
import { DurationPicker } from "./DurationPicker";
import { BrokeragePicker } from "./BrokeragePicker";
import { AdvancedPanel } from "./AdvancedPanel";
import { RateResult } from "./RateResult";
import { ComparisonStrip } from "./ComparisonStrip";
import {
  calcBoxRateSimple,
  calcBoxRateFromQuotes,
  calcBlendedTaxRate,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
} from "@/lib/calc";
import {
  BROKERAGE_FEES,
  COMPARISON_RATES,
  DEFAULT_SPREAD_BPS,
  DEFAULT_FEDERAL_TAX_RATE,
  DEFAULT_STATE_TAX_RATE,
  LTCG_RATE_FEDERAL,
  STCG_RATE_FEDERAL,
  TENORS,
} from "@/lib/constants";
import type { Tenor, Brokerage, TreasuryRates } from "@/lib/types";

export function Calculator() {
  const [amount, setAmount] = useState(250000);
  const [tenor, setTenor] = useState<Tenor>("1Y");
  const [brokerage, setBrokerage] = useState<Brokerage>("ibkr");
  const [spreadBps, setSpreadBps] = useState(DEFAULT_SPREAD_BPS);
  const [bidPrice, setBidPrice] = useState<number | null>(null);
  const [askPrice, setAskPrice] = useState<number | null>(null);
  const [strikeWidth, setStrikeWidth] = useState<number | null>(null);
  const [federalTaxRate, setFederalTaxRate] = useState(DEFAULT_FEDERAL_TAX_RATE);
  const [stateTaxRate, setStateTaxRate] = useState(DEFAULT_STATE_TAX_RATE);
  const [treasuryRates, setTreasuryRates] = useState<TreasuryRates>({});

  useEffect(() => {
    fetch("/api/rates/treasury")
      .then((r) => r.json())
      .then(setTreasuryRates)
      .catch(console.error);
  }, []);

  const tenorMonths = TENORS.find((t) => t.value === tenor)?.months ?? 12;
  const dte = Math.round(tenorMonths * 30.44); // approximate days

  const result = useMemo(() => {
    const fees = BROKERAGE_FEES[brokerage];
    const useAdvanced =
      bidPrice !== null && askPrice !== null && strikeWidth !== null;

    let boxRate: number;
    if (useAdvanced) {
      const midpoint = (bidPrice + askPrice) / 2;
      boxRate = calcBoxRateFromQuotes(midpoint, strikeWidth, dte);
    } else {
      const treasuryYield = treasuryRates[tenor] ?? 0.04;
      boxRate = calcBoxRateSimple(treasuryYield, spreadBps);
    }

    const feeImpact = calcFeeImpact(fees, 1, amount, dte);
    const allInRate = calcAllInRate(boxRate, feeImpact);

    // Tax: use federal rates for LTCG/STCG, adjusted if user overrides federal rate
    const ltcg = federalTaxRate <= 0.24 ? 0.15 : LTCG_RATE_FEDERAL;
    const stcg = federalTaxRate;
    const blendedTax = calcBlendedTaxRate(ltcg, stcg, stateTaxRate);
    const afterTaxRate = calcAfterTaxRate(allInRate, blendedTax);

    return { boxRate: allInRate, afterTaxRate, feeImpact };
  }, [
    amount,
    tenor,
    brokerage,
    spreadBps,
    bidPrice,
    askPrice,
    strikeWidth,
    federalTaxRate,
    stateTaxRate,
    treasuryRates,
    dte,
  ]);

  const useAdvanced =
    bidPrice !== null && askPrice !== null && strikeWidth !== null;
  const treasuryYield = treasuryRates[tenor];

  const methodology = useAdvanced
    ? `From market quotes: mid ${((bidPrice! + askPrice!) / 2).toFixed(2)} on $${strikeWidth!.toLocaleString()} width · Fee-inclusive`
    : treasuryYield
      ? `Based on ${tenor} Treasury (${(treasuryYield * 100).toFixed(2)}%) + ${spreadBps}bps spread · Fee-inclusive (4 legs × $${BROKERAGE_FEES[brokerage].commission.toFixed(2)})`
      : "Loading rates...";

  const comparison = COMPARISON_RATES[brokerage];

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Borrow at near-Treasury rates
        </h1>
        <p className="mt-2 text-gray-500">
          Calculate your box spread borrowing rate and compare to alternatives
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-700 bg-gray-900 p-6">
        <AmountInput value={amount} onChange={setAmount} />
        <DurationPicker value={tenor} onChange={setTenor} />
        <BrokeragePicker value={brokerage} onChange={setBrokerage} />
        <AdvancedPanel
          bidPrice={bidPrice}
          askPrice={askPrice}
          strikeWidth={strikeWidth}
          federalTaxRate={federalTaxRate}
          stateTaxRate={stateTaxRate}
          spreadBps={spreadBps}
          onBidChange={setBidPrice}
          onAskChange={setAskPrice}
          onStrikeWidthChange={setStrikeWidth}
          onFederalTaxChange={setFederalTaxRate}
          onStateTaxChange={setStateTaxRate}
          onSpreadBpsChange={setSpreadBps}
        />
        <RateResult
          boxRate={result.boxRate}
          afterTaxRate={result.afterTaxRate}
          methodology={methodology}
        />
      </div>

      <ComparisonStrip
        boxRate={result.boxRate}
        marginLoan={comparison.marginLoan}
        sbloc={comparison.sbloc}
        heloc={comparison.heloc}
      />

      <div className="text-center">
        <a
          href={`/order?amount=${amount}&tenor=${tenor}&brokerage=${brokerage}&rate=${result.boxRate}`}
          className="inline-block rounded-xl bg-green-500 px-8 py-3.5 text-base font-semibold text-gray-950 transition-colors hover:bg-green-400"
        >
          Build My Order →
        </a>
        <p className="mt-2 text-xs text-gray-600">
          Step-by-step instructions for your brokerage. No account needed.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire up the landing page**

Replace `src/app/page.tsx`:

```tsx
import { Calculator } from "@/components/calculator/Calculator";

export default function Home() {
  return <Calculator />;
}
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev
```

Expected: Calculator renders at localhost:3000 with amount input, duration picker, brokerage selector, rate result, and comparison strip. Rate should show based on default values.

- [ ] **Step 4: Commit**

```bash
git add src/components/calculator/Calculator.tsx src/app/page.tsx
git commit -m "feat: wire up calculator page with live rate calculations"
```

---

## Task 11: Order Builder Page

**Files:**
- Create: `src/components/order/OrderSummary.tsx`
- Create: `src/components/order/LegTable.tsx`
- Create: `src/components/order/OrderParams.tsx`
- Create: `src/components/order/FeeBreakdown.tsx`
- Create: `src/components/order/PreSubmitChecklist.tsx`
- Create: `src/components/order/BrokerageGuide.tsx`
- Create: `src/app/order/page.tsx`

- [ ] **Step 1: Create OrderSummary**

Create `src/components/order/OrderSummary.tsx`:

```tsx
import type { Brokerage, Tenor } from "@/lib/types";
import { BROKERAGES } from "@/lib/constants";

interface OrderSummaryProps {
  amount: number;
  tenor: Tenor;
  rate: number;
  brokerage: Brokerage;
}

export function OrderSummary({ amount, tenor, rate, brokerage }: OrderSummaryProps) {
  const brokerageLabel = BROKERAGES.find((b) => b.value === brokerage)?.label ?? brokerage;
  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: "Borrowing", value: `$${amount.toLocaleString()}` },
        { label: "Duration", value: tenor },
        { label: "Rate", value: `${(rate * 100).toFixed(2)}%`, highlight: true },
        { label: "Brokerage", value: brokerageLabel, blue: true },
      ].map(({ label, value, highlight, blue }) => (
        <div key={label} className="rounded-lg border border-gray-700 bg-gray-900 p-3.5">
          <div className="text-xs uppercase tracking-wide text-gray-600">{label}</div>
          <div className={`mt-1 text-xl font-semibold ${highlight ? "text-green-400" : blue ? "text-blue-400" : "text-white"}`}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create LegTable**

Create `src/components/order/LegTable.tsx`:

```tsx
import type { BoxLeg } from "@/lib/types";

interface LegTableProps {
  legs: BoxLeg[];
  expiry: string;
}

export function LegTable({ legs, expiry }: LegTableProps) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      <div className="grid grid-cols-[40px_1fr_80px_60px_80px] border-b border-gray-800 px-4 py-2.5 text-xs uppercase tracking-wide text-gray-600">
        <div>Leg</div>
        <div>Contract</div>
        <div className="text-center">Action</div>
        <div className="text-center">Type</div>
        <div className="text-center">Strike</div>
      </div>
      {legs.map((leg, i) => (
        <div
          key={i}
          className="grid grid-cols-[40px_1fr_80px_60px_80px] items-center border-b border-gray-800/50 px-4 py-3 last:border-b-0"
        >
          <div className={`text-sm font-semibold ${leg.action === "buy" ? "text-green-400" : "text-red-400"}`}>
            {i + 1}
          </div>
          <div className="text-sm text-gray-300">
            SPX {expiryLabel} {leg.strike} {leg.type === "call" ? "Call" : "Put"}
          </div>
          <div className="text-center">
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                leg.action === "buy"
                  ? "bg-green-900/30 text-green-400"
                  : "bg-red-900/30 text-red-400"
              }`}
            >
              {leg.action.toUpperCase()}
            </span>
          </div>
          <div className="text-center text-sm capitalize text-gray-400">{leg.type}</div>
          <div className="text-center text-sm font-medium text-white">{leg.strike}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create OrderParams**

Create `src/components/order/OrderParams.tsx`:

```tsx
interface OrderParamsProps {
  spreadWidth: number;
  limitPrice: number;
  contracts: number;
}

export function OrderParams({ spreadWidth, limitPrice, contracts }: OrderParamsProps) {
  const repayment = spreadWidth * 100 * contracts;
  const premium = limitPrice * 100 * contracts;
  const interestCost = repayment - premium;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Order parameters</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {[
          { label: "Order type", value: "Limit (combo order)" },
          { label: "Limit price (net debit)", value: `$${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} per contract` },
          { label: "Quantity", value: `${contracts} contract${contracts > 1 ? "s" : ""}` },
          { label: "Total cost to repay at expiry", value: `$${repayment.toLocaleString()}` },
          { label: "You receive today (premium)", value: `$${premium.toLocaleString()}`, highlight: "green" },
          { label: "Implied interest cost", value: `$${interestCost.toLocaleString()}`, highlight: "orange" },
        ].map(({ label, value, highlight }) => (
          <div key={label}>
            <div className="text-xs uppercase tracking-wide text-gray-600">{label}</div>
            <div className={`mt-1 text-base ${highlight === "green" ? "text-green-400" : highlight === "orange" ? "text-orange-400" : "text-white"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create FeeBreakdown**

Create `src/components/order/FeeBreakdown.tsx`:

```tsx
import type { BrokerageFees } from "@/lib/types";

interface FeeBreakdownProps {
  fees: BrokerageFees;
  contracts: number;
  borrowAmount: number;
}

export function FeeBreakdown({ fees, contracts, borrowAmount }: FeeBreakdownProps) {
  const commissionTotal = fees.commission * 4 * contracts;
  const exchangeTotal = fees.exchangeFee * 4 * contracts;
  const regulatoryTotal = fees.regulatoryFee * 4 * contracts;
  const total = commissionTotal + exchangeTotal + regulatoryTotal;
  const pctImpact = (total / borrowAmount) * 100;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Fee breakdown</h3>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">Commission (4 legs × ${fees.commission.toFixed(2)})</span><span className="text-white">${commissionTotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Exchange fees (CBOE SPX)</span><span className="text-white">${exchangeTotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Regulatory fees (SEC, OCC, FINRA TAF)</span><span className="text-white">${regulatoryTotal.toFixed(2)}</span></div>
        <div className="mt-2 flex justify-between border-t border-gray-700 pt-2 font-semibold">
          <span className="text-gray-300">Total fees</span>
          <span className="text-white">${total.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-600">
        Adds ~{pctImpact.toFixed(3)}% to your effective rate on a ${borrowAmount.toLocaleString()} box.
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create PreSubmitChecklist**

Create `src/components/order/PreSubmitChecklist.tsx`:

```tsx
export function PreSubmitChecklist() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Pre-submit checklist</h3>
      <div className="space-y-2 text-sm text-gray-300">
        <div>☐ All 4 legs match the table above</div>
        <div>☐ Net effect shows as <span className="text-green-400">credit</span> (you receive money)</div>
        <div>☐ Margin impact is small (&lt; $10K for Portfolio Margin)</div>
        <div>☐ Expiration is a standard monthly, not a weekly (SPXW)</div>
        <div>☐ Order type is LMT at the limit price shown above</div>
      </div>

      <div className="mt-4 rounded-lg border border-orange-800 bg-orange-900/10 p-3">
        <p className="text-xs text-orange-400">
          <strong>⚠️ Double-check:</strong> A reversed buy/sell on any leg turns
          this from a defined-risk box into a naked options position. If margin
          impact is close to the full notional (~$250K), you may be on Reg T
          instead of Portfolio Margin.
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-blue-800 bg-blue-900/10 p-3">
        <p className="text-xs text-blue-400">
          <strong>💡 Fill tip:</strong> Box spreads often fill within a few hours
          during market hours, but can take 1–3 days. If no fill in 24h, raise
          the limit price by $1–2 (~0.04% in rate terms).
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create BrokerageGuide (IBKR)**

Create `src/components/order/BrokerageGuide.tsx`:

```tsx
import type { Brokerage } from "@/lib/types";

interface BrokerageGuideProps {
  brokerage: Brokerage;
  expiry: string;
  limitPrice: number;
}

function IbkrGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="space-y-4">
      {[
        { step: 1, title: "Open Spread Trader in TWS", desc: `Go to Trading Tools → Spread Trader. Select SPX as the underlying. This is NOT the same as regular order entry — Spread Trader handles multi-leg combos correctly.` },
        { step: 2, title: "Select the expiration", desc: `Choose ${expiryLabel} (SPX). Make sure you select SPX (European, AM-settled), NOT SPXW (weekly). European settlement means your box can only be exercised at expiry.` },
        { step: 3, title: "Build the combo: enter all 4 legs", desc: "Add each leg exactly as shown in the table above. Enter them in sequence: Buy Call (lower), Sell Call (upper), Sell Put (lower), Buy Put (upper)." },
        { step: 4, title: "Set the limit price", desc: `Enter $${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} as the limit price for the combo. Order type: LMT. Time in force: GTC (Good 'Til Cancelled).` },
        { step: 5, title: "Preview and submit", desc: "Click Preview Order. Verify the margin impact shows a small increase (not the full notional). Then submit." },
      ].map(({ step, title, desc }) => (
        <div key={step} className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
            {step}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{title}</div>
            <div className="mt-1 text-xs leading-relaxed text-gray-400">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GenericGuide({ brokerage }: { brokerage: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400">
      Detailed step-by-step instructions for {brokerage} coming soon. Use the
      leg table and order parameters above to enter the order manually in your
      brokerage&apos;s multi-leg / combo order interface.
    </div>
  );
}

export function BrokerageGuide({ brokerage, expiry, limitPrice }: BrokerageGuideProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-white">
        Step-by-step: Enter this order on{" "}
        {brokerage === "ibkr" ? "IBKR" : brokerage === "fidelity" ? "Fidelity" : "Schwab"}
      </h3>
      {brokerage === "ibkr" ? (
        <IbkrGuide expiry={expiry} limitPrice={limitPrice} />
      ) : (
        <GenericGuide brokerage={brokerage} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create Order page**

Create `src/app/order/page.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { OrderSummary } from "@/components/order/OrderSummary";
import { LegTable } from "@/components/order/LegTable";
import { OrderParams } from "@/components/order/OrderParams";
import { FeeBreakdown } from "@/components/order/FeeBreakdown";
import { PreSubmitChecklist } from "@/components/order/PreSubmitChecklist";
import { BrokerageGuide } from "@/components/order/BrokerageGuide";
import { selectStrikes, findNearestExpiry, buildBoxLegs, calcSpreadWidth } from "@/lib/strikes";
import { calcBoxRateSimple } from "@/lib/calc";
import { BROKERAGE_FEES } from "@/lib/constants";
import type { Brokerage, Tenor } from "@/lib/types";

const CURRENT_SPX = 5500;

function OrderContent() {
  const searchParams = useSearchParams();
  const amount = Number(searchParams.get("amount")) || 250000;
  const tenor = (searchParams.get("tenor") as Tenor) || "1Y";
  const brokerage = (searchParams.get("brokerage") as Brokerage) || "ibkr";
  const rate = Number(searchParams.get("rate")) || 0.0412;

  const order = useMemo(() => {
    const contracts = 1;
    const { lower, upper } = selectStrikes(amount, contracts, CURRENT_SPX);
    const expiry = findNearestExpiry(tenor, new Date());
    const legs = buildBoxLegs(lower, upper, expiry);
    const spreadWidth = calcSpreadWidth(amount, contracts);

    // Limit price = spread width - (spread width * rate * DTE/365)
    // Simplified: the price the market charges for the box
    const tenorMonths = { "3M": 3, "6M": 6, "1Y": 12, "2Y": 24, "3Y": 36, "5Y": 60 }[tenor] ?? 12;
    const dte = Math.round(tenorMonths * 30.44);
    const limitPrice = spreadWidth / (1 + rate * (dte / 365));

    return { legs, expiry, spreadWidth, limitPrice, contracts };
  }, [amount, tenor, rate]);

  const fees = BROKERAGE_FEES[brokerage];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Builder</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your box spread order, ready to enter at your brokerage.
        </p>
      </div>

      <OrderSummary amount={amount} tenor={tenor} rate={rate} brokerage={brokerage} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">
          Your box spread order{" "}
          <span className="font-normal text-gray-600">— 4 legs, auto-calculated</span>
        </h3>
        <LegTable legs={order.legs} expiry={order.expiry} />
        <div className="mt-3 rounded-lg border border-blue-800 bg-blue-900/10 p-3">
          <p className="text-xs text-blue-400">
            <strong>Why these strikes?</strong> Spread width of $
            {order.spreadWidth.toLocaleString()} × 100 multiplier = $
            {amount.toLocaleString()} notional. Strikes selected near current SPX
            level for liquidity.
          </p>
        </div>
      </div>

      <OrderParams
        spreadWidth={order.spreadWidth}
        limitPrice={order.limitPrice}
        contracts={order.contracts}
      />

      <FeeBreakdown fees={fees} contracts={order.contracts} borrowAmount={amount} />

      <BrokerageGuide
        brokerage={brokerage}
        expiry={order.expiry}
        limitPrice={order.limitPrice}
      />

      <PreSubmitChecklist />

      <div className="text-center">
        <a
          href="/"
          className="text-sm text-gray-500 underline hover:text-gray-300"
        >
          ← Back to calculator
        </a>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <OrderContent />
    </Suspense>
  );
}
```

- [ ] **Step 8: Run dev server and verify full flow**

```bash
pnpm dev
```

Expected: Navigate to localhost:3000, adjust calculator, click "Build My Order →", see order builder with 4-leg table, order params, fee breakdown, IBKR walkthrough, and pre-submit checklist.

- [ ] **Step 9: Commit**

```bash
git add src/components/order/ src/app/order/
git commit -m "feat: add order builder page with leg table, params, fees, walkthrough, and safety checklist"
```

---

## Task 12: Learn Page (SEO Content)

**Files:**
- Create: `src/app/learn/page.tsx`

- [ ] **Step 1: Create learn page**

Create `src/app/learn/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Box Spreads — boxspreads.app",
  description:
    "What are box spreads? Prerequisites, risks, tax treatment, and how they compare to margin loans, HELOCs, and SBLOCs.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-400">{children}</div>
    </section>
  );
}

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Box Spread Borrowing Guide
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Everything you need to know about borrowing at near-Treasury rates
          using SPX box spreads.
        </p>
      </div>

      <Section title="What is a box spread?">
        <p>
          A box spread is a combination of four SPX index options that creates a
          position with a fixed, known payoff at expiration — regardless of where
          the market goes. When you <strong className="text-gray-300">sell</strong> a box spread
          (short box), you receive cash today and owe a fixed amount at expiry.
          This is economically identical to a zero-coupon loan.
        </p>
        <p>
          The four legs: buy a call and sell a put at the lower strike (synthetic
          long), sell a call and buy a put at the upper strike (synthetic short).
          The payoff at expiry is always equal to the difference between the
          strikes × 100, no matter what.
        </p>
      </Section>

      <Section title="Prerequisites">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-gray-300">Portfolio Margin</strong> — Required at most brokerages. Reg T margin treats box spreads punitively (margin requirement ≈ full notional). Portfolio Margin recognizes the zero-risk nature and requires minimal collateral.</li>
          <li><strong className="text-gray-300">Level 3+ options approval</strong> — You need approval for spreads/combos. At IBKR this is straightforward; at Fidelity/Schwab it can require calling in.</li>
          <li><strong className="text-gray-300">$100K+ account</strong> — Portfolio Margin typically requires $100K-$175K minimum depending on the brokerage.</li>
          <li><strong className="text-gray-300">Taxable account</strong> — Cannot be done in retirement accounts (IRA, 401k).</li>
        </ul>
      </Section>

      <Section title="Risks">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-gray-300">Margin calls</strong> — The box spread uses margin capacity. A severe market downturn can trigger margin calls on your portfolio, potentially forcing liquidation of other positions.</li>
          <li><strong className="text-gray-300">Rolling risk</strong> — At expiry, if you don&apos;t roll into a new box, you owe the full repayment. If you miss the roll window, your broker may charge margin loan rates on the balance.</li>
          <li><strong className="text-gray-300">Execution risk</strong> — Mis-entering any of the 4 legs can create unintended exposure. Always use combo/spread order entry, not individual legs.</li>
          <li><strong className="text-gray-300">Liquidity risk</strong> — In extreme market conditions, SPX options may become illiquid, making it difficult to roll positions.</li>
        </ul>
      </Section>

      <Section title="Tax treatment (Section 1256)">
        <p>
          SPX options are Section 1256 contracts. Gains and losses receive
          favorable 60/40 treatment: 60% taxed as long-term capital gains, 40%
          as short-term — regardless of holding period. The implied
          &quot;interest&quot; on a box spread manifests as a capital loss, which is
          deductible at this blended rate.
        </p>
        <p>
          Unlike mortgage interest (capped at $750K principal) or margin interest
          (limited to investment income), box spread losses have no deduction
          cap. Section 1256 losses can also be carried back 3 years.
        </p>
      </Section>

      <Section title="Box spreads vs. alternatives">
        <div className="overflow-hidden rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-900">
                <th className="px-3 py-2 text-left text-xs text-gray-500">Method</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Typical Rate</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Tax Deductible?</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Key Tradeoff</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-b border-gray-800"><td className="px-3 py-2 font-medium text-green-400">Box Spread</td><td className="px-3 py-2">Treasury + ~30bps</td><td className="px-3 py-2">Yes (60/40)</td><td className="px-3 py-2">Complex execution, margin risk</td></tr>
              <tr className="border-b border-gray-800"><td className="px-3 py-2">Margin Loan</td><td className="px-3 py-2">10-12%</td><td className="px-3 py-2">Limited</td><td className="px-3 py-2">Simple but expensive</td></tr>
              <tr className="border-b border-gray-800"><td className="px-3 py-2">SBLOC / PAL</td><td className="px-3 py-2">5-8%</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Variable rate, call risk</td></tr>
              <tr><td className="px-3 py-2">HELOC</td><td className="px-3 py-2">7-9%</td><td className="px-3 py-2">Limited</td><td className="px-3 py-2">Requires property, slow setup</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <div className="text-center">
        <a
          href="/"
          className="inline-block rounded-xl bg-green-500 px-8 py-3.5 text-base font-semibold text-gray-950 transition-colors hover:bg-green-400"
        >
          Calculate Your Rate →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/learn/
git commit -m "feat: add learn page with box spread education content"
```

---

## Task 13: Build Verification & Final Polish

**Files:**
- Modify: `src/app/layout.tsx` (add nav)

- [ ] **Step 1: Add minimal navigation**

Add to `src/app/layout.tsx`, inside the `<body>` before `<main>`:

```tsx
<nav className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
  <a href="/" className="text-sm font-semibold text-white">
    boxspreads.app
  </a>
  <div className="flex gap-4 text-sm text-gray-500">
    <a href="/" className="hover:text-gray-300">Calculator</a>
    <a href="/learn" className="hover:text-gray-300">Learn</a>
  </div>
</nav>
```

- [ ] **Step 2: Run full build**

```bash
pnpm build
```

Expected: Build succeeds with no errors. Fix any TypeScript or build issues.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev
```

Verify:
1. Calculator loads, shows rate based on Treasury + 30bps
2. Changing amount/duration/brokerage updates rate instantly
3. Advanced toggle opens/closes, entering bid/ask switches to quote-based rate
4. "Build My Order →" navigates to /order with correct params
5. Order builder shows 4 legs, order params, fees, IBKR walkthrough, checklist
6. /learn page renders all education content
7. Navigation links work

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add navigation, verify build and tests pass"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project scaffolding | package.json, next.config.ts, vitest.config.ts |
| 2 | Types & constants | src/lib/types.ts, src/lib/constants.ts |
| 3 | Rate calculation engine (TDD) | src/lib/calc.ts, __tests__/calc.test.ts |
| 4 | Strike selection logic (TDD) | src/lib/strikes.ts, __tests__/strikes.test.ts |
| 5 | Supabase schema & seed | supabase/migrations/001_initial_schema.sql |
| 6 | Treasury rates API | src/app/api/rates/treasury/route.ts |
| 7 | Comparison/fees/strikes APIs | src/app/api/rates/comparison, fees, strikes |
| 8 | UI foundation | layout.tsx, ButtonGroup, Tooltip |
| 9 | Calculator components | 6 calculator components |
| 10 | Calculator page | Calculator.tsx, page.tsx |
| 11 | Order builder page | 6 order components + page.tsx |
| 12 | Learn page | SEO education content |
| 13 | Build verification | Nav, build check, smoke test |
