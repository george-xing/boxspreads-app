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
  // Ensure minimum 5-point spread to prevent zero-width box
  return { lower, upper: Math.max(upper, lower + 5) };
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

  // Use UTC to avoid timezone issues. Clamp day to 28 before adding months
  // to prevent month-end rollover (e.g., Aug 31 + 6M → Mar instead of Feb).
  const targetMonth = from.getUTCMonth() + tenorInfo.months;
  const targetYear = from.getUTCFullYear() + Math.floor(targetMonth / 12);
  const targetMonthMod = targetMonth % 12;

  const expiry = thirdFriday(targetYear, targetMonthMod);

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
