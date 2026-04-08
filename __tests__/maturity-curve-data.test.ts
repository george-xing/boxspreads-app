import { describe, it, expect } from "vitest";
import { calcBoxRateSimple, calcFeeImpact, calcAllInRate } from "@/lib/calc";
import { findNearestExpiry, calcDte } from "@/lib/strikes";
import { TENORS } from "@/lib/constants";
import type { BrokerageFees } from "@/lib/types";

const FEES: BrokerageFees = { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 };

describe("maturity curve data", () => {
  it("computes a rate for every tenor given treasury rates", () => {
    const treasuryRates = {
      "3M": 0.048,
      "6M": 0.046,
      "1Y": 0.043,
      "2Y": 0.041,
      "3Y": 0.040,
      "5Y": 0.039,
    };
    const spreadBps = 10;
    const amount = 100000;

    const curveData = TENORS.map(({ value }) => {
      const dte = calcDte(findNearestExpiry(value, new Date()));
      const impliedRate = calcBoxRateSimple(treasuryRates[value] ?? 0.04, spreadBps);
      const feeImpact = calcFeeImpact(FEES, 1, amount, dte);
      return {
        tenor: value,
        rate: calcAllInRate(impliedRate, feeImpact),
      };
    });

    expect(curveData).toHaveLength(6);
    curveData.forEach((point) => {
      expect(point.rate).toBeGreaterThan(0);
      expect(point.rate).toBeLessThan(0.10);
    });
    // Short tenors should have higher rates than long tenors (inverted yield curve)
    expect(curveData[0].rate).toBeGreaterThan(curveData[5].rate);
  });
});
