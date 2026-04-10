import { SPX_MULTIPLIER } from "@/lib/constants";

interface OrderParamsProps {
  spreadWidth: number;
  limitPrice: number;
  contracts: number;
}

export function OrderParams({ spreadWidth, limitPrice, contracts }: OrderParamsProps) {
  const notional = spreadWidth * SPX_MULTIPLIER * contracts;
  const premium = limitPrice * SPX_MULTIPLIER * contracts;
  const interestCost = Math.abs(notional - premium);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Order parameters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {[
          { label: "Order type", value: "Limit (combo order)" },
          { label: "Limit price (net credit)", value: `$${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} per contract` },
          { label: "Quantity", value: `${contracts} contract${contracts > 1 ? "s" : ""}` },
          { label: "You owe at expiry", value: `$${notional.toLocaleString()}` },
          { label: "You receive today (credit)", value: `$${premium.toLocaleString()}`, highlight: "green" },
          { label: "Implied interest", value: `$${interestCost.toLocaleString()}`, highlight: "orange" },
        ].map(({ label, value, highlight }) => (
          <div key={label}>
            <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
            <div className={`mt-1 text-base ${highlight === "green" ? "text-green-600" : highlight === "orange" ? "text-orange-600" : "text-gray-900"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
