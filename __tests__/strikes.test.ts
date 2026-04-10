import { describe, it, expect } from "vitest";
import {
  calcSpreadWidth,
  selectStrikes,
  findNearestExpiry,
  buildBoxLegs,
  calcDte,
  generateSpxExpirations,
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
    expect(legs[0]).toEqual({ strike: 4000, type: "call", action: "sell", expiry: "2026-12-18" });
    expect(legs[1]).toEqual({ strike: 6500, type: "call", action: "buy", expiry: "2026-12-18" });
    expect(legs[2]).toEqual({ strike: 4000, type: "put", action: "buy", expiry: "2026-12-18" });
    expect(legs[3]).toEqual({ strike: 6500, type: "put", action: "sell", expiry: "2026-12-18" });
  });

  it("builds 4 correct legs for a long box (lending)", () => {
    const legs = buildBoxLegs(4000, 6500, "2026-12-18", "lend");
    expect(legs).toHaveLength(4);
    // Long box: buy lower call, sell upper call (bull call spread)
    expect(legs[0]).toEqual({ strike: 4000, type: "call", action: "buy", expiry: "2026-12-18" });
    expect(legs[1]).toEqual({ strike: 6500, type: "call", action: "sell", expiry: "2026-12-18" });
    // Long box: sell lower put, buy upper put (bear put spread)
    expect(legs[2]).toEqual({ strike: 4000, type: "put", action: "sell", expiry: "2026-12-18" });
    expect(legs[3]).toEqual({ strike: 6500, type: "put", action: "buy", expiry: "2026-12-18" });
  });
});

describe("calcSpreadWidth edge cases", () => {
  it("returns 0 for zero contracts", () => {
    expect(calcSpreadWidth(250000, 0)).toBe(0);
  });

  it("returns 0 for negative contracts", () => {
    expect(calcSpreadWidth(250000, -1)).toBe(0);
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

describe("generateSpxExpirations", () => {
  const from = new Date("2026-04-09");
  const expirations = generateSpxExpirations(from);

  it("produces expirations with valid dates and positive DTE", () => {
    expect(expirations.length).toBeGreaterThanOrEqual(15);
    expect(expirations.length).toBeLessThanOrEqual(30);
    for (const exp of expirations) {
      expect(exp.dte).toBeGreaterThanOrEqual(7);
      expect(exp.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(exp.label).toBeTruthy();
    }
  });

  it("includes near-term monthly expirations", () => {
    // Should have May, Jun, Jul 2026 (all within 15 months)
    const may = expirations.find((e) => e.date.startsWith("2026-05"));
    const jun = expirations.find((e) => e.date.startsWith("2026-06"));
    const jul = expirations.find((e) => e.date.startsWith("2026-07"));
    expect(may).toBeDefined();
    expect(jun).toBeDefined();
    expect(jul).toBeDefined();
  });

  it("switches to quarterly after 15 months", () => {
    // >15 months from Apr 2026 = after Jul 2027
    // Aug 2027 should NOT exist (not quarterly), Sep 2027 SHOULD (quarterly)
    const aug27 = expirations.find((e) => e.date.startsWith("2027-08"));
    const sep27 = expirations.find((e) => e.date.startsWith("2027-09"));
    expect(aug27).toBeUndefined();
    expect(sep27).toBeDefined();
  });

  it("switches to Dec-only after 36 months", () => {
    // >36 months from Apr 2026 = after Apr 2029
    // Jun 2029 should NOT exist, Dec 2029 SHOULD
    const jun29 = expirations.find((e) => e.date.startsWith("2029-06"));
    const dec29 = expirations.find((e) => e.date.startsWith("2029-12"));
    expect(jun29).toBeUndefined();
    expect(dec29).toBeDefined();
  });

  it("all dates fall on a Friday", () => {
    for (const exp of expirations) {
      const [y, m, d] = exp.date.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      expect(date.getDay()).toBe(5); // Friday
    }
  });

  it("is sorted by DTE ascending", () => {
    for (let i = 1; i < expirations.length; i++) {
      expect(expirations[i].dte).toBeGreaterThan(expirations[i - 1].dte);
    }
  });
});
