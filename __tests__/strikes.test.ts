import { describe, it, expect } from "vitest";
import {
  calcSpreadWidth,
  selectStrikes,
  findNearestExpiry,
  buildBoxLegs,
  calcDte,
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
  it("finds 1Y expiry (actual anniversary month)", () => {
    // 1Y from April 2026 → April 2027. Third Friday of April 2027 = Apr 16
    const expiry = findNearestExpiry("1Y", new Date("2026-04-07"));
    expect(expiry).toBe("2027-04-16");
  });

  it("finds 2Y expiry", () => {
    // 2Y from April 2026 → April 2028. Third Friday of April 2028 = Apr 21
    const expiry = findNearestExpiry("2Y", new Date("2026-04-07"));
    expect(expiry).toBe("2028-04-21");
  });

  it("finds 6M expiry", () => {
    const expiry = findNearestExpiry("6M", new Date("2026-04-07"));
    expect(expiry).toBe("2026-10-16");
  });

  it("finds 3M expiry", () => {
    const expiry = findNearestExpiry("3M", new Date("2026-04-07"));
    expect(expiry).toBe("2026-07-17");
  });

  it("handles month-end dates without rollover", () => {
    // Aug 31 + 6M should target February, not March
    const expiry = findNearestExpiry("6M", new Date("2026-08-31"));
    expect(expiry).toBe("2027-02-19"); // Third Friday of Feb 2027
  });
});

describe("buildBoxLegs", () => {
  it("builds 4 correct legs for a short box (borrowing)", () => {
    const legs = buildBoxLegs(4000, 6500, "2026-12-18");
    expect(legs).toHaveLength(4);
    // Short box: sell lower call, buy upper call (bear call spread)
    expect(legs[0]).toEqual({
      strike: 4000,
      type: "call",
      action: "sell",
      expiry: "2026-12-18",
    });
    expect(legs[1]).toEqual({
      strike: 6500,
      type: "call",
      action: "buy",
      expiry: "2026-12-18",
    });
    // Short box: buy lower put, sell upper put (bull put spread)
    expect(legs[2]).toEqual({
      strike: 4000,
      type: "put",
      action: "buy",
      expiry: "2026-12-18",
    });
    expect(legs[3]).toEqual({
      strike: 6500,
      type: "put",
      action: "sell",
      expiry: "2026-12-18",
    });
  });
});

describe("calcDte", () => {
  it("calculates days between two dates", () => {
    // April 7 to Dec 18 = 255 days (24 in Apr + 31+30+31+31+30+31+30+18 = 256)
    const dte = calcDte("2026-12-18", new Date("2026-04-07"));
    expect(dte).toBe(255);
  });

  it("handles same-year short tenor", () => {
    // April 7 to Jul 17 = 101 days
    const dte = calcDte("2026-07-17", new Date("2026-04-07"));
    expect(dte).toBe(101);
  });
});
