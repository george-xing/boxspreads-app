import type { Tenor, BoxLeg, Expiration } from "./types";
import { SPX_MULTIPLIER, TENORS } from "./constants";

export function calcSpreadWidth(
  borrowAmount: number,
  contracts: number
): number {
  if (contracts <= 0 || !Number.isFinite(contracts)) return 0;
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
 * Build the 4 legs of a box spread.
 * Short box (borrow) = bear call spread + bull put spread. You receive net credit now.
 * Long box (lend) = bull call spread + bear put spread. You pay net debit now.
 */
export function buildBoxLegs(
  lowerStrike: number,
  upperStrike: number,
  expiry: string,
  direction: "borrow" | "lend" = "borrow"
): [BoxLeg, BoxLeg, BoxLeg, BoxLeg] {
  const isBorrow = direction === "borrow";
  return [
    { strike: lowerStrike, type: "call", action: isBorrow ? "sell" : "buy", expiry },
    { strike: upperStrike, type: "call", action: isBorrow ? "buy" : "sell", expiry },
    { strike: lowerStrike, type: "put", action: isBorrow ? "buy" : "sell", expiry },
    { strike: upperStrike, type: "put", action: isBorrow ? "sell" : "buy", expiry },
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

function formatDateLabel(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Generate all available SPX expiration dates from a reference date.
 * - Monthly: next 15 months
 * - Quarterly (Mar/Jun/Sep/Dec): 15-36 months
 * - Annual (Dec only): 36-72 months
 * Filters out expirations < 7 DTE.
 */
export function generateSpxExpirations(from: Date): Expiration[] {
  const quarterly = new Set([2, 5, 8, 11]); // Mar, Jun, Sep, Dec (0-indexed)
  const results: Expiration[] = [];

  for (let monthsOut = 0; monthsOut <= 72; monthsOut++) {
    const targetMonth = (from.getMonth() + monthsOut) % 12;
    const targetYear = from.getFullYear() + Math.floor((from.getMonth() + monthsOut) / 12);

    // >36 months: Dec only
    if (monthsOut > 36 && targetMonth !== 11) continue;
    // >15 months: quarterly only
    if (monthsOut > 15 && !quarterly.has(targetMonth)) continue;

    const expiry = thirdFriday(targetYear, targetMonth);
    const iso = formatIso(expiry);
    const dte = calcDte(iso, from);

    if (dte >= 7) {
      results.push({ date: iso, dte, label: formatDateLabel(expiry) });
    }
  }

  return results;
}
