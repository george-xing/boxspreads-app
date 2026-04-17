import type { ChainSnapshot, ChainContract } from "@/lib/schwab/types";
import type { SchwabSession } from "@/lib/schwab/client";
import { isMarketOpen } from "@/lib/market-hours";

const TTL_MS = 5 * 60 * 1000;
const SCHWAB_CHAINS_URL = "https://api.schwabapi.com/marketdata/v1/chains";

interface CacheEntry {
  snap: ChainSnapshot;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function __resetChainCacheForTests(): void {
  cache.clear();
}

function cacheKey(expiration: string): string {
  return `chain:${expiration}`;
}

// Schwab's raw REST API field names. These differ from the SDK's Zod-renamed
// names (the SDK uses bidPrice/askPrice/markPrice; the raw API uses bid/ask/mark).
// Since we bypass the SDK for market data, we use the raw names here.
type SchwabContract = {
  symbol?: string;
  strikePrice?: number;
  bid?: number;          // raw API: "bid" (NOT "bidPrice")
  ask?: number;          // raw API: "ask" (NOT "askPrice")
  mark?: number;         // raw API: "mark" (NOT "markPrice")
  last?: number;         // last traded price
  closePrice?: number;   // previous session close
  openInterest?: number;
  totalVolume?: number;  // contracts traded this session
  settlementType?: string;
  optionRoot?: string;
  daysToExpiration?: number;
};
type SchwabChainResponse = {
  underlying?: { symbol?: string; last?: number; mark?: number };
  underlyingPrice?: number;
  callExpDateMap?: Record<string, Record<string, SchwabContract[]>>;
  putExpDateMap?: Record<string, Record<string, SchwabContract[]>>;
};

function normalize(raw: SchwabChainResponse, expiration: string): ChainSnapshot {
  const contracts: ChainContract[] = [];
  let dte = 0;

  const underlying = {
    symbol: raw.underlying?.symbol ?? "$SPX",
    last: raw.underlying?.last ?? raw.underlyingPrice ?? 0,
    mark: raw.underlying?.mark ?? raw.underlyingPrice ?? 0,
  };

  // First pass: collect all contracts, tracking whether ANY have live bid/ask.
  interface RawEntry {
    strike: number;
    type: "CALL" | "PUT";
    symbol: string;
    bid: number | null;
    ask: number | null;
    mark: number | null;
    openInterest: number;
    totalVolume: number;
    settlementType: "AM" | "PM";
    optionRoot: string;
  }
  const allEntries: RawEntry[] = [];

  for (const type of ["CALL", "PUT"] as const) {
    const mapKey = type === "CALL" ? "callExpDateMap" : "putExpDateMap";
    const byExp = raw[mapKey] ?? {};
    for (const expKey of Object.keys(byExp)) {
      const [date, dteStr] = expKey.split(":");
      if (date !== expiration) continue;
      dte = Number(dteStr);
      const byStrike = byExp[expKey];
      for (const strikeKey of Object.keys(byStrike)) {
        for (const c of byStrike[strikeKey]) {
          allEntries.push({
            strike: c.strikePrice ?? Number(strikeKey),
            type,
            symbol: c.symbol ?? "",
            // Raw Schwab API: "bid"/"ask"/"mark" (not "bidPrice"/"askPrice"/"markPrice").
            bid: c.bid ?? null,
            ask: c.ask ?? null,
            mark: c.mark ?? c.closePrice ?? c.last ?? null,
            openInterest: c.openInterest ?? 0,
            totalVolume: c.totalVolume ?? 0,
            settlementType:
              c.settlementType === "A" || c.settlementType === "AM" ? "AM" : "PM",
            optionRoot: c.optionRoot ?? "",
          });
        }
      }
    }
  }

  // Detect after-hours. Two signals, either triggers:
  // 1. Time-based: current time is outside 9:30 AM – 4:00 PM ET on a
  //    weekday. This is the reliable indicator on Schwab (bid/ask stays
  //    populated after hours with wide spreads, so data-only heuristics
  //    never trigger for SPX).
  // 2. Data-based: all contracts have null/zero bid AND null/zero ask.
  //    Covers edge cases like Schwab blanking a chain during maintenance.
  const hasLiveBidAsk = allEntries.some(
    (e) => e.bid != null && e.ask != null && e.bid > 0 && e.ask > 0,
  );
  const isAfterHours =
    !isMarketOpen() ||
    (allEntries.length > 0 && !hasLiveBidAsk);

  for (const e of allEntries) {
    let bid = e.bid;
    let ask = e.ask;

    if (isAfterHours) {
      // After-hours: use mark (closing/mid) as synthetic bid=ask so
      // computeCandidates can produce indicative rates. The spread is
      // zero in this mode, which is fine — we're not pretending there's
      // a live market.
      if (e.mark != null && e.mark > 0) {
        bid = e.mark;
        ask = e.mark;
      } else {
        continue; // no mark either — truly no data
      }
    } else {
      // Market open: require real bid+ask
      if (bid == null || ask == null || bid <= 0 || ask <= 0) continue;
    }

    contracts.push({
      strike: e.strike,
      type: e.type,
      symbol: e.symbol,
      bid,
      ask,
      mark: e.mark ?? (bid + ask) / 2,
      openInterest: e.openInterest,
      totalVolume: e.totalVolume,
      settlementType: e.settlementType,
      optionRoot: e.optionRoot,
    });
  }

  return {
    underlying,
    expiration,
    dte,
    contracts,
    asOf: new Date().toISOString(),
    isAfterHours,
  };
}

export interface FetchChainOptions {
  /** Bypass the in-memory cache and force a fresh Schwab call. Used by the
   *  refresh button in the nav to show the user their action had an effect. */
  force?: boolean;
}

export async function fetchChainSnapshot(
  session: SchwabSession,
  expiration: string,
  options: FetchChainOptions = {},
): Promise<ChainSnapshot> {
  const key = cacheKey(expiration);
  if (!options.force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.snap;
  }

  const accessToken = await session.getAccessToken();

  const url = new URL(SCHWAB_CHAINS_URL);
  url.searchParams.set("symbol", "$SPX");
  url.searchParams.set("contractType", "ALL");
  url.searchParams.set("includeUnderlyingQuote", "true");
  url.searchParams.set("optionType", "S");
  url.searchParams.set("fromDate", expiration);
  url.searchParams.set("toDate", expiration);

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    // Drain the body so the connection can be reused, but DO NOT include
    // it in the thrown message — Schwab error responses can echo header-
    // adjacent context (token-bearing fragments, internal trace IDs) that
    // we don't want to leak into logs/Sentry. The status is enough for
    // operators; if you need the body, log it separately at the call site
    // with explicit redaction.
    await resp.text().catch(() => "");
    throw new Error(`Schwab chain HTTP ${resp.status}`);
  }

  const raw = (await resp.json()) as SchwabChainResponse;
  const snap = normalize(raw, expiration);
  cache.set(key, { snap, fetchedAt: Date.now() });
  return snap;
}
