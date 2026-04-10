import type { BrokerageFees } from "@/lib/types";
import { Tooltip } from "@/components/ui/Tooltip";

interface FeeBreakdownProps {
  fees: BrokerageFees;
  contracts: number;
  borrowAmount: number;
  dte: number;
}

export function FeeBreakdown({ fees, contracts, borrowAmount, dte }: FeeBreakdownProps) {
  const commissionTotal = fees.commission * 4 * contracts;
  const exchangeTotal = fees.exchangeFee * 4 * contracts;
  const regulatoryTotal = fees.regulatoryFee * 4 * contracts;
  const total = commissionTotal + exchangeTotal + regulatoryTotal;
  const annualizedPct = borrowAmount > 0 && dte > 0 ? (total / borrowAmount) * (365 / dte) * 100 : 0;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-white">
        Fee breakdown
        <Tooltip content={`Adds ~${annualizedPct.toFixed(3)}% annualized to your effective rate on a $${borrowAmount.toLocaleString()} box (${dte} DTE).`} />
      </h3>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">Commission (4 legs x ${fees.commission.toFixed(2)})</span><span className="text-white">${commissionTotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Exchange fees (CBOE SPX)</span><span className="text-white">${exchangeTotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Regulatory fees (SEC, OCC, FINRA TAF)</span><span className="text-white">${regulatoryTotal.toFixed(2)}</span></div>
        <div className="mt-2 flex justify-between border-t border-gray-700 pt-2 font-semibold">
          <span className="text-gray-300">Total fees</span>
          <span className="text-white">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
