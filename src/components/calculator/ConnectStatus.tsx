"use client";

import { useEffect, useState } from "react";
import { isMarketOpen } from "@/lib/market-hours";

interface Props {
  connected: boolean;
  asOf?: string;
  underlyingLast?: number;
  isAfterHours?: boolean;
  onRefresh?: () => void;
}

function relativeAgo(iso: string, nowMs: number): string {
  const diff = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ConnectStatus({ connected, asOf, underlyingLast, isAfterHours, onRefresh }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // If the data-based isAfterHours flag isn't set, fall back to a
  // time-based check. Schwab keeps bid/ask populated after hours (just
  // with wide spreads), so the normalizer's data-only heuristic rarely
  // triggers — the time check is the reliable indicator.
  const marketClosed = isAfterHours || !isMarketOpen(new Date(now));

  if (!connected) {
    // Phase 1: there's no public Schwab OAuth flow yet (Commercial-tier
    // approval is still pending). The only entry point that actually works
    // is the password-form admin login, so the nav surfaces that. Keeps
    // the "coming soon" disabled-button mystery off the public surface.
    return (
      <a
        href="/admin"
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-green-700">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Connected
        {underlyingLast ? (
          <span className="text-gray-600 font-normal">
            · SPX {underlyingLast.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        ) : null}
        {marketClosed ? (
          <span className="text-amber-600 font-normal">· Market Closed</span>
        ) : asOf ? (
          <span className="text-gray-400 font-normal">· {relativeAgo(asOf, now)}</span>
        ) : null}
      </span>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="text-gray-500 hover:text-gray-900"
          title="Refresh chain"
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}
