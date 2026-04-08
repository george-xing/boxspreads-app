export type Tenor = "3M" | "6M" | "1Y" | "2Y" | "3Y" | "5Y";

export type Brokerage = "ibkr" | "fidelity" | "schwab";

export type OptionType = "call" | "put";
export type OrderAction = "buy" | "sell";

export interface BoxLeg {
  strike: number;
  type: OptionType;
  action: OrderAction;
  expiry: string; // ISO date
}

export interface BoxOrder {
  legs: [BoxLeg, BoxLeg, BoxLeg, BoxLeg];
  spreadWidth: number;
  contracts: number;
  limitPrice: number;
  expiry: string;
}

export interface RateResult {
  boxRate: number; // annualized, e.g. 0.0412
  afterTaxRate: number;
  feeImpact: number;
  allInRate: number;
}

export type TreasuryRates = Partial<Record<Tenor, number>>;

export interface BrokerageFees {
  commission: number; // per contract per leg
  exchangeFee: number;
  regulatoryFee: number;
}

export interface ComparisonRates {
  marginLoan: number;
  sbloc: number | null;
  heloc: number;
}

export interface CalculatorInputs {
  amount: number;
  tenor: Tenor;
  brokerage: Brokerage;
  spreadBps: number;
  // Advanced mode
  bidPrice: number | null;
  askPrice: number | null;
  strikeWidth: number | null;
  federalTaxRate: number;
  stateTaxRate: number;
}
