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
  const dte = Math.round(tenorMonths * 30.44);

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
