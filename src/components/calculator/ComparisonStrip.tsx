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
