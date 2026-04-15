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
      expect(summary).toEqual([
        `BUY CALL@${c.lowerStrike}`,
        `BUY PUT@${c.upperStrike}`,
        `SELL CALL@${c.upperStrike}`,
        `SELL PUT@${c.lowerStrike}`,
      ].sort());
    }
  });

  it("returns top 5 candidates max", () => {
    const result = computeCandidates(chain, 500_000);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });
});
