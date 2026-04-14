import { describe, it, expect } from "vitest";
import { computeBoxRates, type RawChain } from "@/lib/boxrate";

function c(strike: number, putCall: "CALL" | "PUT", bid: number, ask: number, oi = 500) {
  return {
    putCall,
    strikePrice: strike,
    bidPrice: bid,
    askPrice: ask,
    openInterest: oi,
    optionRoot: "SPX",
    settlementType: "A" as const,
  };
}

function makeChain(expDate: string, dte: number, contracts: ReturnType<typeof c>[]): RawChain {
  const callMap: RawChain["callExpDateMap"] = {};
  const putMap: RawChain["putExpDateMap"] = {};
  const expKey = `${expDate}:${dte}`;
  callMap[expKey] = {};
  putMap[expKey] = {};
  for (const k of contracts) {
    const bucket = k.putCall === "CALL" ? callMap : putMap;
    const strikeKey = String(k.strikePrice);
    bucket[expKey][strikeKey] = [k];
  }
  return {
    underlying: { last: 5500, delayed: false },
    callExpDateMap: callMap,
    putExpDateMap: putMap,
  };
}

describe("computeBoxRates", () => {
  it("computes a plausible rate for a valid SPX box", () => {
    const chain = makeChain("2027-03-19", 365, [
      c(5000, "CALL", 598, 602),
      c(6000, "CALL", 138, 142),
      c(5000, "PUT", 77, 80),
      c(6000, "PUT", 578, 582),
    ]);

    const results = computeBoxRates(chain);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.lower).toBe(5000);
    expect(r.upper).toBe(6000);
    expect(r.width).toBe(1000);
    expect(r.dte).toBe(365);
    expect(r.rate).toBeCloseTo(0.04, 2);
    expect(r.worstCaseRate).toBeGreaterThan(r.rate);
  });

  it("rejects pairs where any leg OI is below threshold", () => {
    const chain = makeChain("2027-03-19", 365, [
      c(5000, "CALL", 598, 602, 50),
      c(6000, "CALL", 138, 142),
      c(5000, "PUT", 77, 80),
      c(6000, "PUT", 578, 582),
    ]);
    expect(computeBoxRates(chain)).toHaveLength(0);
  });

  it("rejects pairs where mid price is non-positive or exceeds width", () => {
    const chain = makeChain("2027-03-19", 365, [
      c(5000, "CALL", 100, 102),
      c(6000, "CALL", 598, 602),
      c(5000, "PUT", 578, 582),
      c(6000, "PUT", 77, 80),
    ]);
    expect(computeBoxRates(chain)).toHaveLength(0);
  });

  it("rejects pairs narrower than MIN_WIDTH", () => {
    const chain = makeChain("2027-03-19", 365, [
      c(5900, "CALL", 200, 204),
      c(6000, "CALL", 138, 142),
      c(5900, "PUT", 480, 484),
      c(6000, "PUT", 578, 582),
    ]);
    expect(computeBoxRates(chain)).toHaveLength(0);
  });

  it("filters out non-SPX optionRoot and non-AM settlement", () => {
    const chain = makeChain("2027-03-19", 365, [
      { ...c(5000, "CALL", 598, 602), optionRoot: "SPXW" },
      c(6000, "CALL", 138, 142),
      c(5000, "PUT", 77, 80),
      c(6000, "PUT", 578, 582),
    ]);
    expect(computeBoxRates(chain)).toHaveLength(0);
  });

  it("picks the best rate across multiple strike pairs", () => {
    const chain = makeChain("2027-03-19", 365, [
      c(5000, "CALL", 598, 602),
      c(6000, "CALL", 138, 142),
      c(5000, "PUT", 77, 80),
      c(6000, "PUT", 578, 582),
      c(5100, "CALL", 543, 547),
      c(6100, "CALL", 98, 102),
      c(5100, "PUT", 122, 125),
      c(6100, "PUT", 618, 622),
    ]);
    const results = computeBoxRates(chain);
    expect(results).toHaveLength(1);
    expect(results[0].lower).toBe(5100);
    expect(results[0].upper).toBe(6100);
    expect(results[0].rate).toBeGreaterThan(0.04);
  });

  it("handles multiple expirations independently", () => {
    const chain: RawChain = {
      underlying: { last: 5500, delayed: false },
      callExpDateMap: {
        "2026-06-18:90": {
          "5000": [c(5000, "CALL", 520, 524)],
          "6000": [c(6000, "CALL", 20, 24)],
        },
        "2027-03-19:365": {
          "5000": [c(5000, "CALL", 598, 602)],
          "6000": [c(6000, "CALL", 138, 142)],
        },
      },
      putExpDateMap: {
        "2026-06-18:90": {
          "5000": [c(5000, "PUT", 12, 15)],
          "6000": [c(6000, "PUT", 510, 514)],
        },
        "2027-03-19:365": {
          "5000": [c(5000, "PUT", 77, 80)],
          "6000": [c(6000, "PUT", 578, 582)],
        },
      },
    };
    const results = computeBoxRates(chain);
    expect(results.map((r) => r.dte).sort((a, b) => a - b)).toEqual([90, 365]);
  });
});
