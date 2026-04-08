import { describe, it, expect } from "vitest";
import {
  calcBoxRateSimple,
  calcBoxRateFromQuotes,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
  calcBlendedTaxRate,
} from "@/lib/calc";

describe("calcBoxRateSimple", () => {
  it("adds spread to treasury yield", () => {
    expect(calcBoxRateSimple(0.0382, 10)).toBeCloseTo(0.0392, 4);
  });

  it("handles zero spread", () => {
    expect(calcBoxRateSimple(0.0382, 0)).toBeCloseTo(0.0382, 4);
  });
});

describe("calcBoxRateFromQuotes", () => {
  it("calculates implied rate from bid/ask midpoint", () => {
    const rate = calcBoxRateFromQuotes(2401.5, 2500, 365);
    expect(rate).toBeCloseTo(0.041, 3);
  });

  it("annualizes correctly for shorter durations", () => {
    const rate = calcBoxRateFromQuotes(2450, 2500, 182);
    expect(rate).toBeCloseTo(0.0410, 3);
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
