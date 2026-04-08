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

        {ratesError && tab === "estimate" && (
          <div className="rounded-lg border border-yellow-800 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-500">
            Using fallback rates — live Treasury data unavailable
          </div>
        )}

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
