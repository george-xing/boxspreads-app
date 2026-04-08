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
        <div className="flex justify-between"><span className="text-gray-400">Commission (4 legs x ${fees.commission.toFixed(2)})</span><span className="text-white">${commissionTotal.toFixed(2)}</span></div>
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
