import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchChainSnapshot, __resetChainCacheForTests } from "@/lib/schwab/chain";
import type { SchwabSession } from "@/lib/schwab/client";

// Shape of Schwab's /marketdata/v1/chains response (minimal fixture).
const makeRawResponse = () => ({
  underlying: { symbol: "$SPX", last: 5782.1, mark: 5782.1 },
  callExpDateMap: {
    "2027-02-19:301": {
      "5500.0": [{
        symbol: "SPX 270219C05500000",
        strikePrice: 5500,
        bidPrice: 300.1,
        askPrice: 300.8,
        markPrice: 300.45,
        openInterest: 1240,
        // Schwab's real API returns "A" for AM-settled. Our normalizer
        // coerces both "A" and "AM" to canonical "AM".
        settlementType: "A",
        optionRoot: "SPX",
        daysToExpiration: 301,
      }],
    },
  },
  putExpDateMap: {
    "2027-02-19:301": {
      "5500.0": [{
        symbol: "SPX 270219P05500000",
        strikePrice: 5500,
        bidPrice: 44,
        askPrice: 44.6,
        markPrice: 44.3,
        openInterest: 1250,
        settlementType: "A",
        optionRoot: "SPX",
        daysToExpiration: 301,
      }],
    },
  },
});

function makeSession(counter: { n: number }): SchwabSession {
  return {
    async getAccessToken() {
      counter.n += 1;
      return "fake-access-token";
    },
  };
}

describe("fetchChainSnapshot", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __resetChainCacheForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  function mockFetch(rawResponseFactory: () => unknown, status = 200) {
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return rawResponseFactory(); },
        async text() { return JSON.stringify(rawResponseFactory()); },
      } as Response;
    }) as unknown as typeof fetch;
  }

  it("calls Schwab REST endpoint with a Bearer token and normalizes the response", async () => {
    const counter = { n: 0 };
    mockFetch(makeRawResponse);

    const snap = await fetchChainSnapshot(makeSession(counter), "2027-02-19");

    expect(counter.n).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const urlArg = call[0] as string;
    const initArg = call[1] as RequestInit;
    expect(urlArg).toMatch(/marketdata\/v1\/chains\?/);
    expect(urlArg).toContain("symbol=%24SPX");
    expect(urlArg).toContain("fromDate=2027-02-19");
    expect(urlArg).toContain("toDate=2027-02-19");
    expect((initArg.headers as Record<string, string>).Authorization).toBe("Bearer fake-access-token");

    expect(snap.underlying.last).toBe(5782.1);
    expect(snap.contracts.length).toBe(2);
    expect(snap.contracts[0].optionRoot).toBe("SPX");
    expect(snap.contracts[0].settlementType).toBe("AM");
  });

  it("reuses cache within TTL", async () => {
    const counter = { n: 0 };
    mockFetch(makeRawResponse);

    await fetchChainSnapshot(makeSession(counter), "2027-02-19");
    await fetchChainSnapshot(makeSession(counter), "2027-02-19");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after TTL", async () => {
    const counter = { n: 0 };
    mockFetch(makeRawResponse);

    await fetchChainSnapshot(makeSession(counter), "2027-02-19");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await fetchChainSnapshot(makeSession(counter), "2027-02-19");

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("force: true bypasses cache even within TTL", async () => {
    const counter = { n: 0 };
    mockFetch(makeRawResponse);

    await fetchChainSnapshot(makeSession(counter), "2027-02-19");
    await fetchChainSnapshot(makeSession(counter), "2027-02-19", { force: true });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses mark as synthetic bid/ask when all contracts lack bid/ask (after-hours)", async () => {
    mockFetch(() => ({
      underlying: { symbol: "$SPX", last: 5782, mark: 5782 },
      callExpDateMap: {
        "2027-02-19:301": {
          "5500.0": [{
            symbol: "SPX 270219C05500000",
            strikePrice: 5500,
            markPrice: 300,
            openInterest: 1000,
            settlementType: "A",
            optionRoot: "SPX",
            // no bidPrice or askPrice
          }],
        },
      },
      putExpDateMap: {},
    }));

    const snap = await fetchChainSnapshot(makeSession({ n: 0 }), "2027-02-19");
    expect(snap.isAfterHours).toBe(true);
    expect(snap.contracts.length).toBe(1);
    // mark used as both bid and ask
    expect(snap.contracts[0].bid).toBe(300);
    expect(snap.contracts[0].ask).toBe(300);
  });

  it("skips contracts with no bid/ask AND no mark (truly no data)", async () => {
    mockFetch(() => ({
      underlying: { symbol: "$SPX", last: 5782, mark: 5782 },
      callExpDateMap: {
        "2027-02-19:301": {
          "5500.0": [{
            symbol: "SPX 270219C05500000",
            strikePrice: 5500,
            // no bidPrice, askPrice, OR markPrice
            openInterest: 1000,
            settlementType: "A",
            optionRoot: "SPX",
          }],
        },
      },
      putExpDateMap: {},
    }));

    const snap = await fetchChainSnapshot(makeSession({ n: 0 }), "2027-02-19");
    expect(snap.isAfterHours).toBe(true);
    expect(snap.contracts.length).toBe(0);
  });

  it("throws on non-2xx response from Schwab", async () => {
    mockFetch(() => ({ error: "Unauthorized" }), 401);
    await expect(
      fetchChainSnapshot(makeSession({ n: 0 }), "2027-02-19"),
    ).rejects.toThrow(/Schwab chain HTTP 401/);
  });
});
