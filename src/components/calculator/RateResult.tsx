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
