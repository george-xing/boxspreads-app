import { describe, it, expect } from "vitest";
import {
  calcSpreadWidth,
  selectStrikes,
  findNearestExpiry,
  buildBoxLegs,
} from "@/lib/strikes";

describe("calcSpreadWidth", () => {
  it("calculates spread width for 1 contract", () => {
    expect(calcSpreadWidth(250000, 1)).toBe(2500);
  });

  it("calculates spread width for multiple contracts", () => {
    expect(calcSpreadWidth(500000, 2)).toBe(2500);
  });
});

describe("selectStrikes", () => {
  it("selects round strikes near current SPX level", () => {
    const { lower, upper } = selectStrikes(250000, 1, 5500);
    expect(lower).toBe(5500);
    expect(upper).toBe(8000);
  });

  it("rounds down to nearest 500", () => {
    const { lower, upper } = selectStrikes(250000, 1, 5732);
    expect(lower).toBe(5500);
    expect(upper).toBe(8000);
  });

  it("adjusts for non-round spread widths", () => {
    const { lower, upper } = selectStrikes(100000, 1, 5500);
    expect(lower).toBe(5500);
    expect(upper).toBe(6500);
  });
});

describe("findNearestExpiry", () => {
  it("finds the third Friday of the target month", () => {
    const expiry = findNearestExpiry("1Y", new Date("2026-04-07"));
    expect(expiry).toBe("2026-12-18");
  });

  it("finds 6M expiry", () => {
    const expiry = findNearestExpiry("6M", new Date("2026-04-07"));
    expect(expiry).toBe("2026-10-16");
  });

  it("finds 3M expiry", () => {
    const expiry = findNearestExpiry("3M", new Date("2026-04-07"));
    expect(expiry).toBe("2026-07-17");
  });
});

describe("buildBoxLegs", () => {
  it("builds 4 correct legs for a short box (borrowing)", () => {
    const legs = buildBoxLegs(4000, 6500, "2026-12-18");
    expect(legs).toHaveLength(4);
    expect(legs[0]).toEqual({
      strike: 4000,
      type: "call",
      action: "buy",
      expiry: "2026-12-18",
    });
    expect(legs[1]).toEqual({
      strike: 6500,
      type: "call",
      action: "sell",
      expiry: "2026-12-18",
    });
    expect(legs[2]).toEqual({
      strike: 4000,
      type: "put",
      action: "sell",
      expiry: "2026-12-18",
    });
    expect(legs[3]).toEqual({
      strike: 6500,
      type: "put",
      action: "buy",
      expiry: "2026-12-18",
    });
  });
});
