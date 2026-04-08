import type { Tenor, BoxLeg } from "./types";
import { SPX_MULTIPLIER, TENORS } from "./constants";

export function calcSpreadWidth(
  borrowAmount: number,
  contracts: number
): number {
  return borrowAmount / (SPX_MULTIPLIER * contracts);
}

export function selectStrikes(
  borrowAmount: number,
  contracts: number,
  currentSpx: number
): { lower: number; upper: number } {
  const width = calcSpreadWidth(borrowAmount, contracts);
  const lower = Math.floor(currentSpx / 500) * 500;
  const upper = Math.round((lower + width) / 5) * 5; // round to nearest valid SPX strike (5-pt increments)
  return { lower, upper };
}

function thirdFriday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  const thirdFridayDay = firstFriday + 14;
  return new Date(year, month, thirdFridayDay);
}

export function findNearestExpiry(tenor: Tenor, from: Date): string {
  const tenorInfo = TENORS.find((t) => t.value === tenor);
  if (!tenorInfo) throw new Error(`Unknown tenor: ${tenor}`);

  let expiryYear: number;
  let expiryMonth: number; // 0-indexed

  if (tenorInfo.months >= 12) {
    // For annual tenors, target December of the year ending the tenor period.
    // e.g. 1Y from April 2026 → December 2026 (end of that calendar year).
    expiryYear = from.getFullYear() + Math.ceil(tenorInfo.months / 12) - 1;
    expiryMonth = 11; // December
  } else {
    const targetDate = new Date(from);
    targetDate.setMonth(targetDate.getMonth() + tenorInfo.months);
    expiryYear = targetDate.getFullYear();
    expiryMonth = targetDate.getMonth();
  }

  const expiry = thirdFriday(expiryYear, expiryMonth);

  const year = expiry.getFullYear();
  const month = String(expiry.getMonth() + 1).padStart(2, "0");
  const day = String(expiry.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build the 4 legs of a short box spread (borrowing).
 * Short box = bear call spread + bull put spread.
 * You receive net credit (cash) now and owe spread width at expiry.
 */
export function buildBoxLegs(
  lowerStrike: number,
  upperStrike: number,
  expiry: string
): [BoxLeg, BoxLeg, BoxLeg, BoxLeg] {
  return [
    { strike: lowerStrike, type: "call", action: "sell", expiry },
    { strike: upperStrike, type: "call", action: "buy", expiry },
    { strike: lowerStrike, type: "put", action: "buy", expiry },
    { strike: upperStrike, type: "put", action: "sell", expiry },
  ];
}

/**
 * Calculate actual days to expiration from a date to an expiry date string.
 * Uses UTC to avoid timezone-related off-by-one errors.
 */
export function calcDte(expiry: string, from: Date = new Date()): number {
  const [ey, em, ed] = expiry.split("-").map(Number);
  const expiryMs = Date.UTC(ey, em - 1, ed);
  const fromMs = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((expiryMs - fromMs) / (1000 * 60 * 60 * 24));
}
