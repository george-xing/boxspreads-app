import type { BrokerageFees } from "./types";

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
 * Advanced mode: implied rate from actual box spread price.
 */
export function calcBoxRateFromQuotes(
  boxPrice: number,
  strikeWidth: number,
  dte: number
): number {
  return ((strikeWidth - boxPrice) / boxPrice) * (365 / dte);
}

/**
 * Section 1256 blended tax rate: 60% LTCG + 40% STCG, plus state tax.
 */
export function calcBlendedTaxRate(
  ltcgRate: number,
  stcgRate: number,
  stateTaxRate: number
): number {
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
  return impliedRate + feeImpact;
}
