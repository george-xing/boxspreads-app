import type { ChainSnapshot, ChainContract } from "@/lib/schwab/types";
import type { SchwabSession } from "@/lib/schwab/client";

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

// Schwab's SPX option chain response shape. Intentionally narrow — we only
// read the fields we need for box-spread math. Using `unknown` + structural
// access avoids coupling to the SDK's Zod schema, which rejects some real
// responses (e.g. exchangeName: "Index" for $SPX).
type SchwabContract = {
  symbol?: string;
  strikePrice?: number;
  bidPrice?: number;
  askPrice?: number;
  markPrice?: number;
  openInterest?: number;
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
          // Skip contracts without both bid and ask — can't price a box leg without a two-sided market.
          if (c.bidPrice == null || c.askPrice == null) continue;
          contracts.push({
            strike: c.strikePrice ?? Number(strikeKey),
            type,
            symbol: c.symbol ?? "",
            bid: c.bidPrice,
            ask: c.askPrice,
            mark: c.markPrice ?? (c.bidPrice + c.askPrice) / 2,
            openInterest: c.openInterest ?? 0,
            // Schwab returns "A" for AM-settled on $SPX; some docs say "AM".
            // Coerce both to our canonical "AM"; anything else is "PM".
            settlementType:
              c.settlementType === "A" || c.settlementType === "AM" ? "AM" : "PM",
            optionRoot: c.optionRoot ?? "",
          });
        }
      }
    }
  }

  return {
    underlying,
    expiration,
    dte,
    contracts,
    asOf: new Date().toISOString(),
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
    // Read body defensively so a non-JSON error page doesn't crash us.
    const body = await resp.text().catch(() => "");
    throw new Error(
      `Schwab chain HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  const raw = (await resp.json()) as SchwabChainResponse;
  const snap = normalize(raw, expiration);
  cache.set(key, { snap, fetchedAt: Date.now() });
  return snap;
}
