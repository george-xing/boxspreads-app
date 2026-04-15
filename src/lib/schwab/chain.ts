import type { ChainSnapshot, ChainContract } from "@/lib/schwab/types";

const TTL_MS = 5 * 60 * 1000;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: any, expiration: string): ChainSnapshot {
  const contracts: ChainContract[] = [];
  let dte = 0;
  const underlying = {
    symbol: raw.underlying?.symbol ?? "$SPX",
    last: raw.underlying?.last ?? raw.underlyingPrice,
    mark: raw.underlying?.mark ?? raw.underlyingPrice,
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
          contracts.push({
            strike: c.strikePrice,
            type,
            symbol: c.symbol,
            bid: c.bidPrice,
            ask: c.askPrice,
            mark: c.markPrice,
            openInterest: c.openInterest ?? 0,
            settlementType: c.settlementType,
            optionRoot: c.optionRoot,
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

export async function fetchChainSnapshot(
  client: { marketData: { options: { getOptionChain: (opts: unknown) => Promise<unknown> } } },
  expiration: string,
): Promise<ChainSnapshot> {
  const key = cacheKey(expiration);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.snap;

  const raw = await client.marketData.options.getOptionChain({
    queryParams: {
      symbol: "$SPX",
      contractType: "ALL",
      includeUnderlyingQuote: true,
      optionType: "S",
      fromDate: expiration,
      toDate: expiration,
    },
  });
  const snap = normalize(raw, expiration);
  cache.set(key, { snap, fetchedAt: Date.now() });
  return snap;
}
