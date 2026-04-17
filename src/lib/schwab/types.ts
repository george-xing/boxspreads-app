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
  /** Sum of (ask-bid) across 4 legs. Null after-hours, where the
   *  normalizer synthesizes bid=ask=mark and the spread is meaningless
   *  (always 0). Consumers should treat null as "not applicable". */
  spreadWidth: number | null;
  score: number;           // rate minus penalties
  muted: boolean;          // liquidity/spread too low for this size
  legs: CandidateLeg[];    // 4 legs with real prices
}

export interface CandidateLeg {
  action: "BUY" | "SELL";
  type: "CALL" | "PUT";
  strike: number;
  symbol: string;          // e.g. SPXW  260219C05500000
  /** Synthetic bid used by the ranker. After-hours this equals mark
   *  (so the ranker can produce indicative rates from a midpoint). For
   *  actual market quotes shown to the user, use liveBid/liveAsk. */
  bid: number;
  ask: number;
  /** Real market bid/ask from Schwab. Null after-hours when there is no
   *  active two-sided quote — display as "—" in that case. During market
   *  hours these match bid/ask above. */
  liveBid: number | null;
  liveAsk: number | null;
  openInterest: number;
}

export interface ChainSnapshot {
  underlying: { symbol: string; last: number; mark: number };
  expiration: string;       // ISO date
  dte: number;
  contracts: ChainContract[];
  asOf: string;             // ISO timestamp
  /** True when no contracts had live bid/ask (markets closed) and we fell
   *  back to mark (closing) prices. Candidates computed from mark prices
   *  are indicative only — not executable until market reopens. */
  isAfterHours: boolean;
}

export interface ChainContract {
  strike: number;
  type: "CALL" | "PUT";
  symbol: string;
  /** Bid/ask used by the ranker. After-hours these are synthesized from
   *  mark so computeCandidates can still produce indicative rates. The
   *  raw market quotes (which may be null after-hours) are in
   *  liveBid/liveAsk and should be used for any UI that represents a
   *  real two-sided market. */
  bid: number;
  ask: number;
  /** Real market bid/ask straight from Schwab. Null after-hours when no
   *  active two-sided quote exists. During regular hours these equal
   *  bid/ask above. */
  liveBid: number | null;
  liveAsk: number | null;
  mark: number;
  openInterest: number;
  /** Total contracts traded in the current session. After hours Schwab
   *  zeroes openInterest until the overnight update; totalVolume is the
   *  only liquidity signal that survives the close. */
  totalVolume: number;
  settlementType: "AM" | "PM";
  optionRoot: string;       // "SPX" | "SPXW"
}

export type CandidatesReason =
  | "min_credit_exceeds_target"
  | "thin_liquidity"
  | "no_active_quotes"
  | null;

export interface CandidatesResponse {
  underlying: { symbol: string; last: number; mark: number };
  expiration: string;
  candidates: Candidate[];
  selected: Candidate | null;
  asOf: string;
  reason: CandidatesReason;
  /** Mirrors ChainSnapshot.isAfterHours — true when candidates are
   *  computed from closing prices, not live bid/ask. */
  isAfterHours: boolean;
}
