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
const MIN_STRIKE_WIDTH = 500;         // Minimum practical box width (pts).
const STRIKE_ROUND = 500;            // Only pair strikes at round-number multiples. SPX box traders
                                      // exclusively use multiples of 500 (5000, 5500, 6000, …).
                                      // Non-round strikes have wider spreads and no realistic OI for
                                      // 4-leg combos. Matches the boxtrades.com convention.
const STRIKE_PROXIMITY = 0.30;        // Restrict candidate strikes to ±30% of spot. Real SPX box
                                      // traders only use near-ATM strikes — deep-ITM/OTM marks
                                      // are noisy enough that pure-rate after-hours ranking would
                                      // otherwise surface pathological pairs (e.g. 1000/2000 when
                                      // spot is $7,041) over realistic ones.
// NOTE: We intentionally do NOT floor on openInterest. Schwab zeroes OI
// after hours (the overnight update hasn't run), but totalVolume can be
// thousands. The per-candidate muting logic (minOI < contracts × 10)
// handles thin-OI discrimination during market hours.

function bucket(chain: ChainSnapshot) {
  const calls = new Map<number, ChainContract>();
  const puts = new Map<number, ChainContract>();
  // Use mark when present (live or last close), else fall back to last
  // trade. Either is a fine center for the proximity band — we just need
  // a stable spot reference, not a tradeable price.
  const spot = chain.underlying.mark || chain.underlying.last;
  const minStrike = spot * (1 - STRIKE_PROXIMITY);
  const maxStrike = spot * (1 + STRIKE_PROXIMITY);
  for (const c of chain.contracts) {
    if (c.optionRoot !== "SPX" || c.settlementType !== "AM") continue;
    // Only keep round-number strikes (multiples of STRIKE_ROUND)
    if (c.strike % STRIKE_ROUND !== 0) continue;
    // Drop strikes outside the proximity band. spot===0 (no underlying
    // quote) disables the filter rather than dropping every strike.
    if (spot > 0 && (c.strike < minStrike || c.strike > maxStrike)) continue;
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
  isAfterHours: boolean,
): Candidate | null {
  const strikeWidth = upperCall.strike - lowerCall.strike;
  if (strikeWidth < MIN_STRIKE_WIDTH) return null;

  // Always use mark (midpoint) for rate computation, matching
  // boxtrades.com convention. During market hours, mark ≈ mid of tight
  // bid/ask, so the rate is close to the executable rate. After hours,
  // mark reflects the last session midpoint rather than the wide
  // after-hours bid/ask (which would produce 70%+ annualized rates on
  // a 29d box).
  //
  // The actual bid/ask per leg is shown in the LegTable for execution.
  const boxCredit =
    (lowerCall.mark - upperCall.mark) + (upperPut.mark - lowerPut.mark);
  if (boxCredit <= 0) return null;

  const contracts = Math.max(
    1,
    Math.round(target / (boxCredit * SPX_MULTIPLIER)),
  );
  const actualBorrow = boxCredit * SPX_MULTIPLIER * contracts;

  if (Math.abs(actualBorrow - target) / target > TOLERANCE) return null;

  const rate = ((strikeWidth - boxCredit) / boxCredit) * (365 / dte);

  // Liquidity signal: openInterest during market hours, totalVolume after
  // hours. Schwab zeroes openInterest after the close until the overnight
  // update reposts it, so post-close every contract would otherwise look
  // like minOI=0 → muted → 'thin_liquidity'. totalVolume reflects today's
  // actual trading activity and is a faithful proxy until OI repopulates.
  const liquidityField: "openInterest" | "totalVolume" =
    isAfterHours ? "totalVolume" : "openInterest";
  const minOI = Math.min(
    lowerCall[liquidityField],
    upperCall[liquidityField],
    lowerPut[liquidityField],
    upperPut[liquidityField],
  );

  // After-hours the normalizer synthesizes bid=ask=mark, so the
  // bid/ask spread is mechanically 0 across all 4 legs — the spread
  // penalty would be 0 for every candidate, neutralizing it as a
  // ranking signal. With both spreadPenalty and liquidityPenalty
  // (after-hours OI is also frequently 0) muted, the ranker would
  // degenerate to pure `rate`, which favors deep-ITM/OTM strikes
  // whose annualized rate is inflated by rounding. Skip the spread
  // penalty entirely after-hours and surface spreadWidth=null so
  // consumers know not to render it.
  const spreadWidth: number | null = isAfterHours
    ? null
    : (lowerCall.ask - lowerCall.bid) +
      (upperCall.ask - upperCall.bid) +
      (lowerPut.ask - lowerPut.bid) +
      (upperPut.ask - upperPut.bid);

  const liquidityThreshold = contracts * LIQUIDITY_MULTIPLIER;
  const muted = minOI < liquidityThreshold;

  const liquidityPenalty = muted ? LIQUIDITY_PENALTY_WEIGHT : 0;
  const spreadPenalty =
    spreadWidth == null
      ? 0
      : (spreadWidth / boxCredit) * SPREAD_PENALTY_WEIGHT;
  const score = rate - liquidityPenalty - spreadPenalty;

  // Short box = borrow. The credit formula above computes net credit from:
  //   sell lower call (+bid) − buy upper call (−ask) + sell upper put (+bid) − buy lower put (−ask)
  // Legs must mirror that directionality, otherwise the pasted order executes
  // a long box (lend) at a DEBIT — the opposite trade.
  const legs: CandidateLeg[] = [
    { action: "SELL", type: "CALL", strike: lowerCall.strike, symbol: lowerCall.symbol, bid: lowerCall.bid, ask: lowerCall.ask, liveBid: lowerCall.liveBid, liveAsk: lowerCall.liveAsk, openInterest: lowerCall.openInterest },
    { action: "BUY",  type: "CALL", strike: upperCall.strike, symbol: upperCall.symbol, bid: upperCall.bid, ask: upperCall.ask, liveBid: upperCall.liveBid, liveAsk: upperCall.liveAsk, openInterest: upperCall.openInterest },
    { action: "BUY",  type: "PUT",  strike: lowerPut.strike,  symbol: lowerPut.symbol,  bid: lowerPut.bid,  ask: lowerPut.ask,  liveBid: lowerPut.liveBid,  liveAsk: lowerPut.liveAsk,  openInterest: lowerPut.openInterest },
    { action: "SELL", type: "PUT",  strike: upperPut.strike,  symbol: upperPut.symbol,  bid: upperPut.bid,  ask: upperPut.ask,  liveBid: upperPut.liveBid,  liveAsk: upperPut.liveAsk,  openInterest: upperPut.openInterest },
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
      const cand = candidateFor(lc, uc, lp, up, target, chain.dte, chain.isAfterHours);
      if (cand) found.push(cand);
    }
  }

  if (found.length === 0) {
    // Distinguish "chain was empty / no contracts survived the normalizer"
    // from "contracts exist but nothing matched the target borrow."
    const reason =
      chain.contracts.length === 0
        ? "no_active_quotes"
        : "min_credit_exceeds_target";
    return {
      underlying: chain.underlying,
      expiration: chain.expiration,
      candidates: [],
      selected: null,
      asOf: chain.asOf,
      reason,
      isAfterHours: chain.isAfterHours,
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
    isAfterHours: chain.isAfterHours,
  };
}
