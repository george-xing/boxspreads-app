import type { BoxLeg } from "@/lib/types";

interface LegTableProps {
  legs: BoxLeg[];
  expiry: string;
}

export function LegTable({ legs, expiry }: LegTableProps) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[40px_1fr_80px_60px_80px] border-b border-gray-100 px-4 py-2.5 text-xs uppercase tracking-wide text-gray-400">
        <div>Leg</div>
        <div>Contract</div>
        <div className="text-center">Action</div>
        <div className="text-center">Type</div>
        <div className="text-center">Strike</div>
      </div>
      {legs.map((leg, i) => (
        <div
          key={i}
          className="grid grid-cols-[40px_1fr_80px_60px_80px] items-center border-b border-gray-50 px-4 py-3 last:border-b-0"
        >
          <div className={`text-sm font-semibold ${leg.action === "buy" ? "text-green-600" : "text-red-600"}`}>
            {i + 1}
          </div>
          <div className="text-sm text-gray-600">
            SPX {expiryLabel} {leg.strike} {leg.type === "call" ? "Call" : "Put"}
          </div>
          <div className="text-center">
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                leg.action === "buy"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {leg.action.toUpperCase()}
            </span>
          </div>
          <div className="text-center text-sm capitalize text-gray-400">{leg.type}</div>
          <div className="text-center text-sm font-medium text-gray-900">{leg.strike}</div>
        </div>
      ))}
    </div>
  );
}
