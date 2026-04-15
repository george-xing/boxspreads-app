import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchChainSnapshot, __resetChainCacheForTests } from "@/lib/schwab/chain";

describe("fetchChainSnapshot", () => {
  beforeEach(() => {
    __resetChainCacheForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeClient(counter: { n: number }) {
    return {
      marketData: {
        options: {
          getOptionChain: vi.fn(async () => {
            counter.n += 1;
            return {
              underlyingPrice: 5782.1,
              underlying: { last: 5782.1, mark: 5782.1, symbol: "$SPX" },
              callExpDateMap: {
                "2027-02-19:301": {
                  "5500.0": [{
                    symbol: "SPX 270219C05500000",
                    strikePrice: 5500,
                    bidPrice: 300.1, askPrice: 300.8, markPrice: 300.45,
                    openInterest: 1240, settlementType: "AM", optionRoot: "SPX",
                    daysToExpiration: 301,
                  }],
                },
              },
              putExpDateMap: {
                "2027-02-19:301": {
                  "5500.0": [{
                    symbol: "SPX 270219P05500000",
                    strikePrice: 5500,
                    bidPrice: 44, askPrice: 44.6, markPrice: 44.3,
                    openInterest: 1250, settlementType: "AM", optionRoot: "SPX",
                    daysToExpiration: 301,
                  }],
                },
              },
            };
          }),
        },
      },
    };
  }

  it("calls Schwab and normalizes to ChainSnapshot", async () => {
    const counter = { n: 0 };
    const client = fakeClient(counter);
    const snap = await fetchChainSnapshot(client as never, "2027-02-19");
    expect(snap.underlying.last).toBe(5782.1);
    expect(snap.contracts.length).toBe(2);
    expect(snap.contracts[0].optionRoot).toBe("SPX");
    expect(counter.n).toBe(1);
  });

  it("reuses cache within TTL", async () => {
    const counter = { n: 0 };
    const client = fakeClient(counter);
    await fetchChainSnapshot(client as never, "2027-02-19");
    await fetchChainSnapshot(client as never, "2027-02-19");
    expect(counter.n).toBe(1);
  });

  it("refetches after TTL", async () => {
    const counter = { n: 0 };
    const client = fakeClient(counter);
    await fetchChainSnapshot(client as never, "2027-02-19");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await fetchChainSnapshot(client as never, "2027-02-19");
    expect(counter.n).toBe(2);
  });
});
