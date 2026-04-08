interface OrderParamsProps {
  spreadWidth: number;
  limitPrice: number;
  contracts: number;
}

export function OrderParams({ spreadWidth, limitPrice, contracts }: OrderParamsProps) {
  const repayment = spreadWidth * 100 * contracts;
  const premium = limitPrice * 100 * contracts;
  const interestCost = repayment - premium;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Order parameters</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {[
          { label: "Order type", value: "Limit (combo order)" },
          { label: "Limit price (net credit)", value: `$${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} per contract` },
          { label: "Quantity", value: `${contracts} contract${contracts > 1 ? "s" : ""}` },
          { label: "You owe at expiry", value: `$${repayment.toLocaleString()}` },
          { label: "You receive today (credit)", value: `$${premium.toLocaleString()}`, highlight: "green" },
          { label: "Implied interest cost", value: `$${interestCost.toLocaleString()}`, highlight: "orange" },
        ].map(({ label, value, highlight }) => (
          <div key={label}>
            <div className="text-xs uppercase tracking-wide text-gray-600">{label}</div>
            <div className={`mt-1 text-base ${highlight === "green" ? "text-green-400" : highlight === "orange" ? "text-orange-400" : "text-white"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
