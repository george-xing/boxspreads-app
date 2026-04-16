import type {
  ChainSnapshot,
  ChainContract,
  Candidate,
  CandidateLeg,
  CandidatesResponse,
} from "@/lib/schwab/types";

const SPX_MULTIPLIER = 100;
const TOLERANCE = 0.15;               // ±15% of target borrow
const LIQUIDITY_MULTIPLIER = 10;      // minOI must be ≥ contracts × 10
const TOP_N = 5;
const LIQUIDITY_PENALTY_WEIGHT = 0.02;
const SPREAD_PENALTY_WEIGHT = 0.5;

function bucket(chain: ChainSnapshot) {
  const calls = new Map<number, ChainContract>();
  const puts = new Map<number, ChainContract>();
  for (const c of chain.contracts) {
    if (c.optionRoot !== "SPX" || c.settlementType !== "AM") continue;
    if (c.type === "CALL") calls.set(c.strike, c);
    else puts.set(c.strike, c);
  }
  const strikes = [...calls.keys()]
    .filter((k) => puts.has(k))
    .sort((a, b) => a - b);
  return { calls, puts, strikes };
}

function candidateFor(
  lowerCall: ChainContract,
  upperCall: ChainContract,
  lowerPut: ChainContract,
  upperPut: ChainContract,
  target: number,
  dte: number,
): Candidate | null {
  const boxCredit =
    (lowerCall.bid - upperCall.ask) + (upperPut.bid - lowerPut.ask);
  if (boxCredit <= 0) return null;

  const strikeWidth = upperCall.strike - lowerCall.strike;
  if (strikeWidth <= 0) return null;

  const contracts = Math.max(
    1,
    Math.round(target / (boxCredit * SPX_MULTIPLIER)),
  );
  const actualBorrow = boxCredit * SPX_MULTIPLIER * contracts;

  if (Math.abs(actualBorrow - target) / target > TOLERANCE) return null;

  const rate = ((strikeWidth - boxCredit) / boxCredit) * (365 / dte);

  const minOI = Math.min(
    lowerCall.openInterest,
    upperCall.openInterest,
    lowerPut.openInterest,
    upperPut.openInterest,
  );

  const spreadWidth =
    (lowerCall.ask - lowerCall.bid) +
    (upperCall.ask - upperCall.bid) +
    (lowerPut.ask - lowerPut.bid) +
    (upperPut.ask - upperPut.bid);

  const liquidityThreshold = contracts * LIQUIDITY_MULTIPLIER;
  const muted = minOI < liquidityThreshold;

  const liquidityPenalty = muted ? LIQUIDITY_PENALTY_WEIGHT : 0;
  const spreadPenalty = (spreadWidth / boxCredit) * SPREAD_PENALTY_WEIGHT;
  const score = rate - liquidityPenalty - spreadPenalty;

  // Short box = borrow. The credit formula above computes net credit from:
  //   sell lower call (+bid) − buy upper call (−ask) + sell upper put (+bid) − buy lower put (−ask)
  // Legs must mirror that directionality, otherwise the pasted order executes
  // a long box (lend) at a DEBIT — the opposite trade.
  const legs: CandidateLeg[] = [
    { action: "SELL", type: "CALL", strike: lowerCall.strike, symbol: lowerCall.symbol, bid: lowerCall.bid, ask: lowerCall.ask, openInterest: lowerCall.openInterest },
    { action: "BUY",  type: "CALL", strike: upperCall.strike, symbol: upperCall.symbol, bid: upperCall.bid, ask: upperCall.ask, openInterest: upperCall.openInterest },
    { action: "BUY",  type: "PUT",  strike: lowerPut.strike,  symbol: lowerPut.symbol,  bid: lowerPut.bid,  ask: lowerPut.ask,  openInterest: lowerPut.openInterest },
    { action: "SELL", type: "PUT",  strike: upperPut.strike,  symbol: upperPut.symbol,  bid: upperPut.bid,  ask: upperPut.ask,  openInterest: upperPut.openInterest },
  ];

  return {
    lowerStrike: lowerCall.strike,
    upperStrike: upperCall.strike,
    strikeWidth,
    contracts,
    boxCredit,
    actualBorrow,
    rate,
    minOI,
    spreadWidth,
    score,
    muted,
    legs,
  };
}

export function computeCandidates(
  chain: ChainSnapshot,
  target: number,
): CandidatesResponse {
  const { calls, puts, strikes } = bucket(chain);

  const found: Candidate[] = [];
  for (let i = 0; i < strikes.length; i++) {
    for (let j = i + 1; j < strikes.length; j++) {
      const lower = strikes[i];
      const upper = strikes[j];
      const lc = calls.get(lower)!;
      const uc = calls.get(upper)!;
      const lp = puts.get(lower)!;
      const up = puts.get(upper)!;
      const cand = candidateFor(lc, uc, lp, up, target, chain.dte);
      if (cand) found.push(cand);
    }
  }

  if (found.length === 0) {
    return {
      underlying: chain.underlying,
      expiration: chain.expiration,
      candidates: [],
      selected: null,
      asOf: chain.asOf,
      reason: "min_credit_exceeds_target",
    };
  }

  found.sort((a, b) => b.score - a.score);
  const top = found.slice(0, TOP_N);

  const allMuted = top.every((c) => c.muted);
  const reason = allMuted ? "thin_liquidity" : null;

  return {
    underlying: chain.underlying,
    expiration: chain.expiration,
    candidates: top,
    selected: top[0],
    asOf: chain.asOf,
    reason,
  };
}
