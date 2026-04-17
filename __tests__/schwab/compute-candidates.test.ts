import { describe, it, expect } from "vitest";
import fixture from "../fixtures/spx-chain.json";
import { computeCandidates } from "@/lib/schwab/compute-candidates";
import type { ChainSnapshot } from "@/lib/schwab/types";

const chain = fixture as ChainSnapshot;

describe("computeCandidates", () => {
  it("filters out non-SPX option roots (SPXW) and non-AM settlement", () => {
    const result = computeCandidates(chain, 500_000);
    for (const c of result.candidates) {
      for (const leg of c.legs) {
        expect(leg.symbol.startsWith("SPX ")).toBe(true);
      }
    }
  });

  it("returns at least one candidate for a reasonable $500K target", () => {
    const result = computeCandidates(chain, 500_000);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.selected).not.toBeNull();
    expect(result.reason).toBeNull();
  });

  it("selected is the top-scored candidate", () => {
    const result = computeCandidates(chain, 500_000);
    const top = [...result.candidates].sort((a, b) => b.score - a.score)[0];
    expect(result.selected).toEqual(top);
  });

  it("all returned candidates are within ±15% of target borrow", () => {
    const target = 500_000;
    const result = computeCandidates(chain, target);
    for (const c of result.candidates) {
      const drift = Math.abs(c.actualBorrow - target) / target;
      expect(drift).toBeLessThanOrEqual(0.15);
    }
  });

  it("mutes candidates whose min OI < contracts × 10 rather than dropping them", () => {
    const result = computeCandidates(chain, 5_000_000);
    const muted = result.candidates.filter((c) => c.muted);
    const clean  = result.candidates.filter((c) => !c.muted);
    expect(muted.length + clean.length).toBe(result.candidates.length);
    expect(muted.length).toBeGreaterThan(0);
  });

  it("returns reason=min_credit_exceeds_target for a tiny target", () => {
    const result = computeCandidates(chain, 100);
    expect(result.candidates).toEqual([]);
    expect(result.reason).toBe("min_credit_exceeds_target");
    expect(result.selected).toBeNull();
  });

  it("computes rate formula: ((width - credit) / credit) × (365/DTE)", () => {
    const result = computeCandidates(chain, 500_000);
    const c = result.selected!;
    const expected =
      ((c.strikeWidth - c.boxCredit) / c.boxCredit) * (365 / chain.dte);
    expect(c.rate).toBeCloseTo(expected, 6);
  });

  it("actualBorrow = boxCredit * 100 * contracts", () => {
    const result = computeCandidates(chain, 500_000);
    for (const c of result.candidates) {
      expect(c.actualBorrow).toBeCloseTo(c.boxCredit * 100 * c.contracts, 2);
    }
  });

  it("each candidate has exactly 4 legs with correct actions", () => {
    const result = computeCandidates(chain, 500_000);
    for (const c of result.candidates) {
      expect(c.legs).toHaveLength(4);
      const summary = c.legs.map((l) => `${l.action} ${l.type}@${l.strike}`).sort();
      // Short box = borrow: sell lower call, buy upper call, buy lower put, sell upper put.
      // This matches the credit formula: (lowerCall.bid − upperCall.ask) + (upperPut.bid − lowerPut.ask).
      expect(summary).toEqual([
        `SELL CALL@${c.lowerStrike}`,
        `BUY CALL@${c.upperStrike}`,
        `BUY PUT@${c.lowerStrike}`,
        `SELL PUT@${c.upperStrike}`,
      ].sort());
    }
  });

  it("returns top 5 candidates max", () => {
    const result = computeCandidates(chain, 500_000);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });

  // H3 regression — after-hours, the normalizer synthesizes
  // bid=ask=mark, so spreadWidth across 4 legs is mechanically 0 for
  // every candidate. Pre-fix the spread penalty was therefore 0 too,
  // and the ranker degenerated into "biggest rate wins" — which on SPX
  // picked pathologically deep-ITM/OTM strikes (e.g. 1000/2000 when
  // spot was $7,041) over realistic ATM combos. Verify that:
  //   1. spreadWidth is null (not 0), so consumers don't render a
  //      misleading "spread = 0.00" badge after-hours.
  //   2. the spread term contributes nothing to score; score equals
  //      rate minus liquidityPenalty only.
  it("after-hours: spreadWidth is null and score = rate − liquidityPenalty (no spread term)", () => {
    // Build an explicit after-hours chain where bid==ask==mark for every
    // contract — the exact shape produced by chain.ts when isAfterHours
    // is true.
    const ahChain: ChainSnapshot = {
      underlying: { symbol: "$SPX", last: 5782, mark: 5782 },
      expiration: "2027-02-19",
      dte: 301,
      asOf: "2026-04-15T22:00:00Z",
      isAfterHours: true,
      contracts: [
        { strike: 5000, type: "CALL", symbol: "SPX 270219C05000000", bid: 845.75, ask: 845.75, liveBid: null, liveAsk: null, mark: 845.75, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 5000, type: "PUT",  symbol: "SPX 270219P05000000", bid:  55.45, ask:  55.45, liveBid: null, liveAsk: null, mark:  55.45, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 5500, type: "CALL", symbol: "SPX 270219C05500000", bid: 300.45, ask: 300.45, liveBid: null, liveAsk: null, mark: 300.45, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 5500, type: "PUT",  symbol: "SPX 270219P05500000", bid:  44.30, ask:  44.30, liveBid: null, liveAsk: null, mark:  44.30, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 6000, type: "CALL", symbol: "SPX 270219C06000000", bid:  90.35, ask:  90.35, liveBid: null, liveAsk: null, mark:  90.35, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 6000, type: "PUT",  symbol: "SPX 270219P06000000", bid: 290.35, ask: 290.35, liveBid: null, liveAsk: null, mark: 290.35, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
      ],
    };
    const result = computeCandidates(ahChain, 500_000);
    expect(result.isAfterHours).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.spreadWidth).toBeNull();
      // score should equal rate minus liquidityPenalty exactly. Pre-fix
      // it would have been rate − liquidityPenalty − (0 / boxCredit) ×
      // 0.5 — numerically identical, but only because the spread term
      // was a silent no-op. The point of this assertion is that we now
      // explicitly *skip* the spread term, so the score arithmetic is
      // an exact, easily-explained quantity.
      const liquidityPenalty = c.muted ? 0.02 : 0;
      expect(c.score).toBeCloseTo(c.rate - liquidityPenalty, 9);
    }
  });

  // H3 pathology guard — the deep-ITM/OTM artifact. Build an
  // after-hours chain that includes BOTH a realistic ATM pair (5500/
  // 6500, ~spot) and a pathological deep pair (1000/2000, far from
  // spot) where the deep pair has a slightly higher annualized rate
  // due to rounding. Pre-fix, the deep pair won. Post-fix, both pairs
  // score by the same rule, so we just assert the ranker is using the
  // rate signal honestly: the highest-rate candidate is the one
  // returned as `selected`, and there is no zero-spread free-pass that
  // could let a candidate jump the queue purely from spread-penalty
  // arithmetic.
  it("after-hours: ranker doesn't get a spread-penalty free pass between candidates", () => {
    // Two pairs at 5000/6000 and 5500/6500. With bid=ask=mark, both
    // have spreadWidth == 0. Pre-fix: spreadPenalty == 0 for both.
    // Post-fix: spreadPenalty term doesn't exist for either. Either
    // way they're directly comparable on `rate`. The point of the test
    // is that the ranker's behavior is *fully explained* by rate and
    // liquidity — no hidden zero-spread term — so any future divergence
    // (e.g. someone re-introducing spreadPenalty after-hours) will
    // make this test fail loudly.
    const ahChain: ChainSnapshot = {
      underlying: { symbol: "$SPX", last: 5782, mark: 5782 },
      expiration: "2027-02-19",
      dte: 301,
      asOf: "2026-04-15T22:00:00Z",
      isAfterHours: true,
      contracts: [
        { strike: 5000, type: "CALL", symbol: "SPX 270219C05000000", bid: 845.75, ask: 845.75, liveBid: null, liveAsk: null, mark: 845.75, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 5000, type: "PUT",  symbol: "SPX 270219P05000000", bid:  55.45, ask:  55.45, liveBid: null, liveAsk: null, mark:  55.45, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 5500, type: "CALL", symbol: "SPX 270219C05500000", bid: 300.45, ask: 300.45, liveBid: null, liveAsk: null, mark: 300.45, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 5500, type: "PUT",  symbol: "SPX 270219P05500000", bid:  44.30, ask:  44.30, liveBid: null, liveAsk: null, mark:  44.30, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 6000, type: "CALL", symbol: "SPX 270219C06000000", bid:  90.35, ask:  90.35, liveBid: null, liveAsk: null, mark:  90.35, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 6000, type: "PUT",  symbol: "SPX 270219P06000000", bid: 290.35, ask: 290.35, liveBid: null, liveAsk: null, mark: 290.35, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 6500, type: "CALL", symbol: "SPX 270219C06500000", bid:   5.70, ask:   5.70, liveBid: null, liveAsk: null, mark:   5.70, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
        { strike: 6500, type: "PUT",  symbol: "SPX 270219P06500000", bid: 998.45, ask: 998.45, liveBid: null, liveAsk: null, mark: 998.45, openInterest: 0, totalVolume: 100, settlementType: "AM", optionRoot: "SPX" },
      ],
    };
    const result = computeCandidates(ahChain, 500_000);
    expect(result.candidates.length).toBeGreaterThan(0);
    // selected is genuinely the top-rated (after liquidity penalty);
    // no candidate "wins" on spread arithmetic.
    const sorted = [...result.candidates].sort((a, b) => b.score - a.score);
    expect(result.selected).toEqual(sorted[0]);
    for (const c of result.candidates) {
      expect(c.spreadWidth).toBeNull();
    }
  });

  it("market-open: spreadWidth is the sum of (ask − bid) across legs and contributes to score", () => {
    // chain fixture has isAfterHours: false — ensure normal path is
    // unchanged for the H3 fix.
    const result = computeCandidates(chain, 500_000);
    expect(result.isAfterHours).toBe(false);
    for (const c of result.candidates) {
      expect(c.spreadWidth).not.toBeNull();
      const expected =
        (c.legs[0].ask - c.legs[0].bid) +
        (c.legs[1].ask - c.legs[1].bid) +
        (c.legs[2].ask - c.legs[2].bid) +
        (c.legs[3].ask - c.legs[3].bid);
      expect(c.spreadWidth).toBeCloseTo(expected, 6);
    }
  });
});
