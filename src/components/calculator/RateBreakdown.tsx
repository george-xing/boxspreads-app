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
