/** One element of the per-pair optimizer result. */
export interface Candidate {
  lowerStrike: number;
  upperStrike: number;
  strikeWidth: number;
  contracts: number;
  boxCredit: number;       // per contract, dollars (not x100)
  actualBorrow: number;    // boxCredit * 100 * contracts
  rate: number;            // annualized, e.g. 0.0439
  minOI: number;
  spreadWidth: number;     // sum of (ask-bid) across 4 legs
  score: number;           // rate minus penalties
  muted: boolean;          // liquidity/spread too low for this size
  legs: CandidateLeg[];    // 4 legs with real prices
}

export interface CandidateLeg {
  action: "BUY" | "SELL";
  type: "CALL" | "PUT";
  strike: number;
  symbol: string;          // e.g. SPXW  260219C05500000
  bid: number;
  ask: number;
  openInterest: number;
}

export interface ChainSnapshot {
  underlying: { symbol: string; last: number; mark: number };
  expiration: string;       // ISO date
  dte: number;
  contracts: ChainContract[];
  asOf: string;             // ISO timestamp
}

export interface ChainContract {
  strike: number;
  type: "CALL" | "PUT";
  symbol: string;
  bid: number;
  ask: number;
  mark: number;
  openInterest: number;
  settlementType: "AM" | "PM";
  optionRoot: string;       // "SPX" | "SPXW"
}

export type CandidatesReason =
  | "min_credit_exceeds_target"
  | "thin_liquidity"
  | null;

export interface CandidatesResponse {
  underlying: { symbol: string; last: number; mark: number };
  expiration: string;
  candidates: Candidate[];
  selected: Candidate | null;
  asOf: string;
  reason: CandidatesReason;
}
