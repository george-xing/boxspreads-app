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

  // Three concerns split into three visual elements (was one chip with
  // `·`-separated text in mixed colors):
  //   1. Connection STATUS  — green chip, semantic, leftmost
  //   2. SPX PRICE          — plain tabular text, neutral, just data
  //   3. MARKET STATE       — amber chip when closed, muted "23s ago"
  //                           when open and we have a fresh asOf
  // The status chip and market chip use ring-1 borders so they read as
  // discrete pills; the price reads as data, not a state. Only the data
  // block (price + state + refresh) appears when `underlyingLast` is set,
  // so the nav (which only passes `connected`) gets just the bare pill.
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
        Connected
      </span>

      {underlyingLast ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tabular-nums text-gray-700">
            SPX{" "}
            <span className="font-semibold text-gray-900">
              {underlyingLast.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </span>

          {marketClosed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
              <span className="h-1 w-1 rounded-full bg-amber-500" aria-hidden />
              Market closed
            </span>
          ) : asOf ? (
            <span className="text-[11px] font-normal text-gray-500 tabular-nums">
              {relativeAgo(asOf, now)}
            </span>
          ) : null}

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Refresh chain"
              aria-label="Refresh chain"
            >
              <span className="block leading-none text-xs">↻</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
