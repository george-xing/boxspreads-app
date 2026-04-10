"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { YieldCurve } from "./YieldCurve";
import { ExpirationTable } from "./ExpirationTable";
import type { ExpirationRow } from "./ExpirationTable";
import { UnifiedCalculator } from "./UnifiedCalculator";
import { TaxRateInputs } from "./TaxRateInputs";
import { Tooltip } from "@/components/ui/Tooltip";
import { BrokerageCTA } from "./BrokerageCTA";
import { LegTable } from "@/components/order/LegTable";
import { OrderParams } from "@/components/order/OrderParams";
import { FeeBreakdown } from "@/components/order/FeeBreakdown";
import { BrokerageGuide } from "@/components/order/BrokerageGuide";
import { buildBoxLegs } from "@/lib/strikes";
import {
  calcBoxRateSimple,
  calcBlendedTaxRate,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
  interpolateTreasuryYield,
  calcMidFromRate,
  calcRateFromMid,
  snapPrice,
  snapStrikeWidth,
} from "@/lib/calc";
import { generateSpxExpirations } from "@/lib/strikes";
import {
  BROKERAGE_FEES,
  DEFAULT_SPREAD_BPS,
  DEFAULT_FEDERAL_TAX_RATE,
  DEFAULT_STATE_TAX_RATE,
  LTCG_RATE_FEDERAL,
  SPX_MULTIPLIER,
} from "@/lib/constants";
import type { Brokerage, TreasuryRates } from "@/lib/types";
import { formatPct, formatDollars } from "@/lib/format";

const CURRENT_SPX = 5500;
const FEES = BROKERAGE_FEES.ibkr;

export function Calculator() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,   // client
    () => false,  // server
  );

  // ── State ──
  const [strikeWidth, setStrikeWidth] = useState(2500);
  const [contracts, setContracts] = useState(1);
  const [federalTaxRate, setFederalTaxRate] = useState(DEFAULT_FEDERAL_TAX_RATE);
  const [stateTaxRate, setStateTaxRate] = useState(DEFAULT_STATE_TAX_RATE);
  const [userMidPrice, setUserMidPrice] = useState<number | null>(null);
  const [selectedBrokerage, setSelectedBrokerage] = useState<Brokerage | null>(null);

  const [treasuryRates, setTreasuryRates] = useState<TreasuryRates>({});
  const [ratesError, setRatesError] = useState(false);

  const [expirations] = useState(() => generateSpxExpirations(new Date()));
  const [selectedExpiry, setSelectedExpiry] = useState(() => {
    const target = expirations.find((e) => e.dte >= 350) ?? expirations[expirations.length - 1];
    return target?.date ?? expirations[0]?.date ?? "";
  });

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

  // ── Derived ──
  const selectedExp = expirations.find((e) => e.date === selectedExpiry);
  const dte = selectedExp?.dte ?? 365;
  const isUserOverride = userMidPrice !== null;

  const clampedFederal = Math.max(0, Math.min(1, federalTaxRate));
  const clampedState = Math.max(0, Math.min(1, stateTaxRate));
  const ltcg = clampedFederal <= 0.24 ? 0.15 : LTCG_RATE_FEDERAL;
  const blendedTax = Math.min(1, calcBlendedTaxRate(ltcg, clampedFederal, clampedState));

  const treasuryYield = interpolateTreasuryYield(dte, treasuryRates);
  const estimatedRate = calcBoxRateSimple(treasuryYield, DEFAULT_SPREAD_BPS);

  const snappedWidth = snapStrikeWidth(strikeWidth);

  const activeMidPrice = userMidPrice ?? calcMidFromRate(estimatedRate, snappedWidth, dte);
  const activeRate = calcRateFromMid(activeMidPrice, snappedWidth, dte);

  const borrowAmount = activeMidPrice * SPX_MULTIPLIER * contracts;
  const repayment = snappedWidth * SPX_MULTIPLIER * contracts;
  const interestCost = Math.abs(repayment - borrowAmount);

  const feeImpact = calcFeeImpact(FEES, contracts, borrowAmount > 0 ? borrowAmount : 1, dte);
  const allInRate = calcAllInRate(activeRate, feeImpact);
  const afterTaxRate = calcAfterTaxRate(allInRate, blendedTax);

  const taxSavings = interestCost * blendedTax;
  const afterTaxCost = interestCost - taxSavings;

  // ── Curve + table data (no amount dependency) ──
  const boxRatesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of expirations) {
      const ty = interpolateTreasuryYield(exp.dte, treasuryRates);
      map[exp.date] = calcBoxRateSimple(ty, DEFAULT_SPREAD_BPS);
    }
    return map;
  }, [expirations, treasuryRates]);

  const tableRows: ExpirationRow[] = useMemo(() => {
    return expirations.map((exp) => ({
      date: exp.date,
      label: exp.label,
      dte: exp.dte,
      boxRate: boxRatesMap[exp.date] ?? 0,
      treasuryRate: interpolateTreasuryYield(exp.dte, treasuryRates),
    }));
  }, [expirations, treasuryRates, boxRatesMap]);

  // ── Order ──
  const order = selectedExpiry && snappedWidth > 0 ? (() => {
    const lower = Math.floor(CURRENT_SPX / 500) * 500;
    const upper = lower + snappedWidth;
    const legs = buildBoxLegs(lower, upper, selectedExpiry, "borrow");
    const limitPrice = calcMidFromRate(activeRate, snappedWidth, dte);
    return { legs, spreadWidth: snappedWidth, limitPrice, contracts };
  })() : null;

  // ── Handlers ──
  function handleStrikeWidthChange(width: number) {
    setStrikeWidth(width);
    setUserMidPrice(null); // width change invalidates mid price
  }

  function handleContractsChange(qty: number) {
    if (qty < 1 || !Number.isFinite(qty)) return;
    setContracts(Math.round(qty));
  }

  function handleExpiryChange(expiry: string) {
    setSelectedExpiry(expiry);
    setUserMidPrice(null);
  }

  function handleMidPriceChange(mid: number) {
    const snapped = snapPrice(mid);
    if (snapped <= 0 || snapped >= snappedWidth) return; // reject invalid
    setUserMidPrice(snapped);
  }

  function handleResetEstimate() {
    setUserMidPrice(null);
  }

  // ── Render ──
  if (!mounted) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Borrow at near-Treasury rates
        </h1>
        <p className="mt-2 text-gray-500">SPX box spread calculator</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Borrow at near-Treasury rates
        </h1>
        <p className="mt-2 text-gray-500">SPX box spread calculator</p>
      </div>

      {ratesError && (
        <div className="rounded-lg border border-yellow-800 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-500">
          Using fallback rates — live Treasury data unavailable
        </div>
      )}

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">

        {/* LEFT: Chart + Table */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex flex-col">
          <div className="flex-1 min-h-[200px]">
            <YieldCurve
              expirations={expirations}
              selectedExpiry={selectedExpiry}
              onSelect={handleExpiryChange}
              treasuryRates={treasuryRates}
              boxRates={boxRatesMap}
            />
          </div>
          <div className="border-t border-gray-700 pt-3 mt-3">
            <ExpirationTable
              rows={tableRows}
              selectedExpiry={selectedExpiry}
              onSelect={handleExpiryChange}
            />
          </div>
        </div>

        {/* RIGHT: Calculator */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">

          {/* Configure */}
          <div className="text-xs uppercase tracking-widest text-gray-500">Configure</div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Expiration</span>
            <span className="text-sm text-white">
              {selectedExp?.label ?? ""}{" "}
              <span className="text-gray-500">({dte}d)</span>
            </span>
          </div>

          <UnifiedCalculator
            strikeWidth={strikeWidth}
            onStrikeWidthChange={handleStrikeWidthChange}
            midPrice={activeMidPrice}
            onMidPriceChange={handleMidPriceChange}
            isUserOverride={isUserOverride}
            onResetEstimate={handleResetEstimate}
            contracts={contracts}
            onContractsChange={handleContractsChange}
          />

          {/* Tax inputs */}
          <div className="border-t border-gray-700 pt-3">
            <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
              Tax rates
            </div>
            <TaxRateInputs
              federalRate={federalTaxRate}
              stateRate={stateTaxRate}
              onFederalChange={setFederalTaxRate}
              onStateChange={setStateTaxRate}
            />
          </div>

          {/* Rate + after-tax summary */}
          <div className="border-t border-gray-700 pt-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400">{formatPct(afterTaxRate)}</div>
              <div className="mt-1 text-xs text-gray-500">
                after-tax effective rate
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {formatPct(allInRate)} pre-tax
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-gray-900 p-3">
              <div className="text-sm text-gray-200">
                <strong className="text-white">Borrow {formatDollars(borrowAmount)} today</strong>,
                repay {formatDollars(repayment)} on {selectedExp?.label ?? ""}.
                {" "}Interest cost:{" "}
                <span className="text-orange-400">{formatDollars(interestCost)}</span>.
                {" "}Tax savings:{" "}
                <span className="text-green-400">{formatDollars(taxSavings)}</span>.
                {" "}After-tax cost:{" "}
                <span className="text-green-400 font-semibold">{formatDollars(afterTaxCost)}</span>.
                <Tooltip content={`Section 1256: 60% long-term capital loss (${formatPct(ltcg)}) + 40% short-term (${formatPct(federalTaxRate)})${stateTaxRate > 0 ? ` + ${formatPct(stateTaxRate)} state` : ""}. Tax savings assume you have capital gains to offset.`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order section ── */}
      {order && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Your Order</h2>
            <Tooltip content={`These strikes are illustrative, based on SPX ~${CURRENT_SPX.toLocaleString()}. When entering your order, select strikes near the current SPX level with high open interest. The rate and cost are the same regardless of which strikes you choose — only liquidity differs.`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <LegTable legs={order.legs} expiry={selectedExpiry} />
            </div>
            <div>
              <OrderParams
                spreadWidth={order.spreadWidth}
                limitPrice={order.limitPrice}
                contracts={order.contracts}
              />
            </div>
            <div>
              <FeeBreakdown
                fees={FEES}
                contracts={order.contracts}
                borrowAmount={order.limitPrice * SPX_MULTIPLIER * order.contracts}
                dte={dte}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Brokerage CTA ── */}
      <BrokerageCTA selected={selectedBrokerage} onSelect={setSelectedBrokerage} />

      {selectedBrokerage && order && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <BrokerageGuide
            brokerage={selectedBrokerage}
            expiry={selectedExpiry}
            limitPrice={order.limitPrice}
          />
        </div>
      )}
    </div>
  );
}
