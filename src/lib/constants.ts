import type { Tenor, Brokerage, BrokerageFees, ComparisonRates } from "./types";

export const TENORS: { value: Tenor; label: string; months: number }[] = [
  { value: "3M", label: "3 mo", months: 3 },
  { value: "6M", label: "6 mo", months: 6 },
  { value: "1Y", label: "1 yr", months: 12 },
  { value: "2Y", label: "2 yr", months: 24 },
  { value: "3Y", label: "3 yr", months: 36 },
  { value: "5Y", label: "5 yr", months: 60 },
];

export const TENOR_TO_FRED_SERIES: Record<Tenor, string> = {
  "3M": "DGS3MO",
  "6M": "DGS6MO",
  "1Y": "DGS1",
  "2Y": "DGS2",
  "3Y": "DGS3",
  "5Y": "DGS5",
};

export const BROKERAGES: { value: Brokerage; label: string }[] = [
  { value: "ibkr", label: "IBKR" },
  { value: "fidelity", label: "Fidelity" },
  { value: "schwab", label: "Schwab" },
];

export const BROKERAGE_FEES: Record<Brokerage, BrokerageFees> = {
  ibkr: { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
  fidelity: { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
  schwab: { commission: 0.65, exchangeFee: 0.68, regulatoryFee: 0.21 },
};

// Published brokerage margin rates (updated manually, approx as of 2026)
export const COMPARISON_RATES: Record<Brokerage, ComparisonRates> = {
  ibkr: { marginLoan: 0.1133, sbloc: null, heloc: 0.075 },
  fidelity: { marginLoan: 0.1175, sbloc: 0.068, heloc: 0.075 },
  schwab: { marginLoan: 0.1125, sbloc: 0.065, heloc: 0.075 },
};

export const DEFAULT_SPREAD_BPS = 30;
export const SPX_MULTIPLIER = 100;
export const DEFAULT_FEDERAL_TAX_RATE = 0.37;
export const DEFAULT_STATE_TAX_RATE = 0.0;
export const LTCG_RATE_FEDERAL = 0.238; // top bracket including NIIT
export const STCG_RATE_FEDERAL = 0.37; // same as ordinary income top bracket
