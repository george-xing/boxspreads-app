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
