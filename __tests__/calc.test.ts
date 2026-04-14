import { describe, it, expect } from "vitest";
import {
  calcBoxRateSimple,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
  calcBlendedTaxRate,
  interpolateTreasuryYield,
  calcMidFromRate,
  calcRateFromMid,
} from "@/lib/calc";

describe("calcBoxRateSimple", () => {
  it("adds spread to treasury yield", () => {
    expect(calcBoxRateSimple(0.0382, 10)).toBeCloseTo(0.0392, 4);
  });

  it("handles zero spread", () => {
    expect(calcBoxRateSimple(0.0382, 0)).toBeCloseTo(0.0382, 4);
  });
});

describe("calcBlendedTaxRate", () => {
  it("calculates Section 1256 blended rate (60/40)", () => {
    const rate = calcBlendedTaxRate(0.238, 0.37, 0);
    expect(rate).toBeCloseTo(0.2908, 4);
  });

  it("includes state tax", () => {
    const rate = calcBlendedTaxRate(0.238, 0.37, 0.133);
    expect(rate).toBeCloseTo(0.4238, 4);
  });
});

describe("calcAfterTaxRate", () => {
  it("reduces rate by blended tax rate", () => {
    const afterTax = calcAfterTaxRate(0.0412, 0.2908);
    expect(afterTax).toBeCloseTo(0.0292, 3);
  });
});

describe("calcFeeImpact", () => {
  it("calculates annualized fee impact", () => {
    const impact = calcFeeImpact(
      { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
      1,
      250000,
      365
    );
    // (0.65 + 0.68 + 0.21) * 4 = 6.16
    // 6.16 / 250000 * (365/365) = 0.00002464
    expect(impact).toBeCloseTo(0.0000246, 5);
  });

  it("scales with number of contracts", () => {
    const impact1 = calcFeeImpact(
      { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
      1,
      250000,
      365
    );
    const impact2 = calcFeeImpact(
      { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
      2,
      250000,
      365
    );
    expect(impact2).toBeCloseTo(impact1 * 2, 6);
  });
});

describe("calcAllInRate", () => {
  it("combines implied rate and fee impact", () => {
    expect(calcAllInRate(0.0412, 0.0000246)).toBeCloseTo(0.0412246, 5);
  });
});

describe("interpolateTreasuryYield", () => {
  const rates = {
    "3M": 0.04,
    "6M": 0.041,
    "1Y": 0.042,
    "2Y": 0.039,
    "3Y": 0.038,
    "5Y": 0.037,
  };

  it("returns exact tenor rate when DTE matches anchor", () => {
    expect(interpolateTreasuryYield(365, rates)).toBeCloseTo(0.042, 4);
  });

  it("interpolates between anchors", () => {
    // Midpoint between 1Y (365d, 4.2%) and 2Y (730d, 3.9%)
    const mid = interpolateTreasuryYield(547, rates);
    expect(mid).toBeCloseTo(0.0405, 3);
  });

  it("clamps to nearest anchor below range", () => {
    expect(interpolateTreasuryYield(30, rates)).toBeCloseTo(0.04, 4);
  });

  it("clamps to nearest anchor above range", () => {
    expect(interpolateTreasuryYield(2500, rates)).toBeCloseTo(0.037, 4);
  });

  it("returns fallback when rates are empty", () => {
    expect(interpolateTreasuryYield(365, {})).toBeCloseTo(0.04, 4);
  });

  it("handles partial rates", () => {
    const partial = { "1Y": 0.042, "2Y": 0.039 };
    expect(interpolateTreasuryYield(365, partial)).toBeCloseTo(0.042, 4);
    expect(interpolateTreasuryYield(547, partial)).toBeCloseTo(0.0405, 3);
  });
});

describe("calcMidFromRate", () => {
  it("derives mid price from rate", () => {
    // rate=4%, width=2500, dte=365 → mid = 2500/(1+0.04) ≈ 2403.85 → snap $0.05 = 2403.85
    const mid = calcMidFromRate(0.04, 2500, 365);
    expect(mid).toBeCloseTo(2403.85, 1);
    // Should be snapped to $0.05 increments
    expect((mid * 20) % 1).toBeCloseTo(0, 5);
  });

  it("snaps to $0.05 tick increments", () => {
    const mid = calcMidFromRate(0.0412, 2500, 365);
    expect((mid * 20) % 1).toBeCloseTo(0, 5);
  });

  it("returns 0 for invalid inputs", () => {
    expect(calcMidFromRate(-0.01, 2500, 365)).toBe(0);
    expect(calcMidFromRate(0.04, 0, 365)).toBe(0);
    expect(calcMidFromRate(0.04, 2500, 0)).toBe(0);
  });
});

describe("calcRateFromMid", () => {
  it("derives rate from mid price", () => {
    // mid=2400, width=2500, dte=365 → rate = (2500-2400)/2400 * 365/365 ≈ 0.04167
    const rate = calcRateFromMid(2400, 2500, 365);
    expect(rate).toBeCloseTo(0.04167, 4);
  });

  it("returns 0 if mid >= width (negative rate)", () => {
    expect(calcRateFromMid(2500, 2500, 365)).toBe(0);
    expect(calcRateFromMid(2600, 2500, 365)).toBe(0);
  });

  it("round-trips with calcMidFromRate", () => {
    const originalRate = 0.04;
    const width = 2500;
    const dte = 620;
    const mid = calcMidFromRate(originalRate, width, dte);
    const recoveredRate = calcRateFromMid(mid, width, dte);
    // Small rounding error from $0.05 tick snap
    expect(recoveredRate).toBeCloseTo(originalRate, 3);
  });
});
