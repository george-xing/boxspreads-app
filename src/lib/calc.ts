import type { BrokerageFees, TreasuryRates } from "./types";

/**
 * Simple mode: Treasury yield + spread in basis points.
 */
export function calcBoxRateSimple(
  treasuryYield: number,
  spreadBps: number
): number {
  return treasuryYield + spreadBps / 10000;
}

/**
 * Section 1256 blended tax rate: 60% LTCG + 40% STCG, plus state tax.
 */
export function calcBlendedTaxRate(
  ltcgRate: number,
  stcgRate: number,
  stateTaxRate: number
): number {
  if (!Number.isFinite(ltcgRate) || !Number.isFinite(stcgRate) || !Number.isFinite(stateTaxRate)) return 0;
  const federalBlended = 0.6 * ltcgRate + 0.4 * stcgRate;
  return federalBlended + stateTaxRate;
}

/**
 * After-tax effective rate.
 */
export function calcAfterTaxRate(
  boxRate: number,
  blendedTaxRate: number
): number {
  if (!Number.isFinite(boxRate) || !Number.isFinite(blendedTaxRate)) return 0;
  return boxRate * (1 - blendedTaxRate);
}

/**
 * Fee impact: annualized cost of trading fees relative to borrow amount.
 * All fee fields are per-contract-per-leg.
 */
export function calcFeeImpact(
  fees: BrokerageFees,
  contracts: number,
  borrowAmount: number,
  dte: number
): number {
  if (!Number.isFinite(borrowAmount) || !Number.isFinite(dte)) return 0;
  if (borrowAmount <= 0 || dte <= 0) return 0;
  const perContract =
    (fees.commission + fees.exchangeFee + fees.regulatoryFee) * 4;
  const totalFees = perContract * contracts;
  return (totalFees / borrowAmount) * (365 / dte);
}

/**
 * All-in rate: implied rate + fee impact.
 */
export function calcAllInRate(
  impliedRate: number,
  feeImpact: number
): number {
  if (!Number.isFinite(impliedRate) || !Number.isFinite(feeImpact)) return 0;
  return impliedRate + feeImpact;
}

/**
 * Interpolate Treasury yield for an arbitrary DTE using linear interpolation
 * between the standard FRED tenor anchors.
 */
const TREASURY_ANCHORS: { dte: number; tenor: "3M" | "6M" | "1Y" | "2Y" | "3Y" | "5Y" }[] = [
  { dte: 91, tenor: "3M" },
  { dte: 182, tenor: "6M" },
  { dte: 365, tenor: "1Y" },
  { dte: 730, tenor: "2Y" },
  { dte: 1095, tenor: "3Y" },
  { dte: 1825, tenor: "5Y" },
];

export function interpolateTreasuryYield(
  dte: number,
  rates: TreasuryRates
): number {
  if (dte <= 0) return 0;

  // Build array of available anchor points
  const points = TREASURY_ANCHORS
    .filter((a) => rates[a.tenor] != null)
    .map((a) => ({ dte: a.dte, rate: rates[a.tenor]! }));

  if (points.length === 0) return 0.04; // fallback

  // Clamp to nearest anchor if outside range
  if (dte <= points[0].dte) return points[0].rate;
  if (dte >= points[points.length - 1].dte) return points[points.length - 1].rate;

  // Find surrounding anchors and interpolate
  for (let i = 0; i < points.length - 1; i++) {
    if (dte >= points[i].dte && dte <= points[i + 1].dte) {
      const t = (dte - points[i].dte) / (points[i + 1].dte - points[i].dte);
      return points[i].rate + t * (points[i + 1].rate - points[i].rate);
    }
  }

  return points[points.length - 1].rate;
}

/**
 * Snap strike width to 5-point increments (SPX standard), minimum 5.
 */
export function snapStrikeWidth(width: number): number {
  return Math.max(5, Math.round(width / 5) * 5);
}

/**
 * Snap a price to $0.05 tick increments (SPX standard).
 */
export function snapPrice(price: number): number {
  return Math.round(price * 20) / 20;
}

/**
 * Calculate mid price from rate (rate → price direction).
 * Snaps to $0.05 tick increments (SPX standard).
 */
export function calcMidFromRate(
  rate: number,
  strikeWidth: number,
  dte: number
): number {
  if (!Number.isFinite(rate) || !Number.isFinite(strikeWidth) || !Number.isFinite(dte)) return 0;
  if (rate < 0 || strikeWidth <= 0 || dte <= 0) return 0;
  const raw = strikeWidth / (1 + rate * (dte / 365));
  return Math.round(raw * 20) / 20; // snap to $0.05
}

/**
 * Calculate rate from mid price (price → rate direction).
 */
export function calcRateFromMid(
  midPrice: number,
  strikeWidth: number,
  dte: number
): number {
  if (!Number.isFinite(midPrice) || !Number.isFinite(strikeWidth) || !Number.isFinite(dte)) return 0;
  if (midPrice <= 0 || strikeWidth <= 0 || dte <= 0) return 0;
  if (midPrice >= strikeWidth) return 0; // would be negative rate
  return ((strikeWidth - midPrice) / midPrice) * (365 / dte);
}
