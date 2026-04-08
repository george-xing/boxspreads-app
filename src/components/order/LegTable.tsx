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
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      <div className="grid grid-cols-[40px_1fr_80px_60px_80px] border-b border-gray-800 px-4 py-2.5 text-xs uppercase tracking-wide text-gray-600">
        <div>Leg</div>
        <div>Contract</div>
        <div className="text-center">Action</div>
        <div className="text-center">Type</div>
        <div className="text-center">Strike</div>
      </div>
      {legs.map((leg, i) => (
        <div
          key={i}
          className="grid grid-cols-[40px_1fr_80px_60px_80px] items-center border-b border-gray-800/50 px-4 py-3 last:border-b-0"
        >
          <div className={`text-sm font-semibold ${leg.action === "buy" ? "text-green-400" : "text-red-400"}`}>
            {i + 1}
          </div>
          <div className="text-sm text-gray-300">
            SPX {expiryLabel} {leg.strike} {leg.type === "call" ? "Call" : "Put"}
          </div>
          <div className="text-center">
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                leg.action === "buy"
                  ? "bg-green-900/30 text-green-400"
                  : "bg-red-900/30 text-red-400"
              }`}
            >
              {leg.action.toUpperCase()}
            </span>
          </div>
          <div className="text-center text-sm capitalize text-gray-400">{leg.type}</div>
          <div className="text-center text-sm font-medium text-white">{leg.strike}</div>
        </div>
      ))}
    </div>
  );
}
