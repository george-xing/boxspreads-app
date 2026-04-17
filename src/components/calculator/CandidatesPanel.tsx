"use client";

import type { Candidate, CandidatesReason } from "@/lib/schwab/types";

type State = "connected" | "disconnected";

interface Props {
  state: State;
  candidates: Candidate[];
  selected: Candidate | null;
  onSelect: (c: Candidate) => void;
  reason?: CandidatesReason;
  isAfterHours?: boolean;
}

function fmtPct(n: number) { return `${(n * 100).toFixed(2)}%`; }
function fmtDollars(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CandidatesPanel({ state, candidates, selected, onSelect, reason, isAfterHours }: Props) {
  if (state === "disconnected") {
    // Reserve roughly the same vertical space the connected candidates
    // panel will occupy, so the right column doesn't grow by 150–250px
    // when the user signs in. This keeps the matched-height grid stable
    // across auth states and gives the left-column expiration table enough
    // room to show 4–5 rows in both states.
    //
    // Visual treatment mirrors the connected panel (sky-blue border/bg,
    // same title placement) to signal "this is where candidates will
    // render." The top-of-page ConnectBanner still carries the primary
    // Sign-in CTA, so this block is message-only.
    return (
      <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/60 p-4 flex flex-col">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-sky-700">
          Candidates · ranked for your size
        </div>
        <div className="mt-3 flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-sm font-semibold text-gray-800">
            Connect Schwab to see live candidates
          </div>
          <div className="mt-2 max-w-xs text-xs leading-relaxed text-gray-600">
            We&apos;ll rank real strike pairs from your option chain by executable
            rate, open interest, and bid/ask spread — and hand you a
            Schwab-pasteable order.
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-widest text-sky-700/40">
          <span>Strikes</span>
          <span className="text-right">Borrow</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Min OI</span>
        </div>
      </div>
    );
  }

  // No candidates returned
  if (candidates.length === 0) {
    if (reason === "no_active_quotes") {
      return (
        <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          <div className="font-semibold mb-1">No active option quotes available</div>
          <div className="text-xs text-gray-500">
            Markets may be closed. SPX options trade 9:30 AM – 4:00 PM ET, Monday–Friday.
            Candidates will populate with live bid/ask data when the market reopens.
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {reason === "min_credit_exceeds_target"
          ? "Your target is too small for any standard strike width at this expiration. Try a larger amount or a longer DTE."
          : "No candidates found for this expiration."}
      </div>
    );
  }

  // After-hours banner — candidates exist (computed from closing prices) but are indicative
  const afterHoursBanner = isAfterHours ? (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <span className="font-semibold">Market closed</span> — showing indicative rates from closing prices. These candidates will update with live bid/ask when the market opens (9:30 AM – 4:00 PM ET).
    </div>
  ) : null;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      {afterHoursBanner}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-sky-700">
          Candidates · ranked for your size
          {isAfterHours ? (
            <span className="ml-2 text-amber-600 normal-case tracking-normal font-medium">(indicative)</span>
          ) : null}
        </div>
        {reason === "thin_liquidity" ? (
          <div className="text-[11px] text-amber-800 font-medium">
            Thin liquidity — consider a shorter DTE
          </div>
        ) : null}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            <th className="px-2 py-1"></th>
            <th className="px-2 py-1">Strikes</th>
            <th className="px-2 py-1 text-right">Contracts</th>
            <th className="px-2 py-1 text-right">Borrow</th>
            <th className="px-2 py-1 text-right">Rate</th>
            <th className="px-2 py-1 text-right">Min OI</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const isSel = selected &&
              c.lowerStrike === selected.lowerStrike && c.upperStrike === selected.upperStrike;
            return (
              <tr
                key={`${c.lowerStrike}-${c.upperStrike}-${c.contracts}`}
                onClick={() => onSelect(c)}
                className={`cursor-pointer transition-colors ${isSel ? "bg-sky-100" : "hover:bg-white"} ${c.muted ? "opacity-50" : ""}`}
              >
                <td className="px-2 py-1.5 font-bold text-sky-700 w-4">{isSel ? "✓" : ""}</td>
                <td className="px-2 py-1.5 font-semibold">{c.lowerStrike} / {c.upperStrike}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">× {c.contracts}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtDollars(c.actualBorrow)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtPct(c.rate)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{c.minOI.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
