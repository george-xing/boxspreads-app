export interface RawOptionContract {
  putCall: "CALL" | "PUT";
  strikePrice: number;
  bidPrice?: number;
  askPrice?: number;
  openInterest?: number;
  optionRoot?: string;
  settlementType?: "A" | "P";
}

export interface RawUnderlying {
  last?: number;
  mark?: number;
  delayed?: boolean;
}

export interface RawChain {
  underlying?: RawUnderlying;
  callExpDateMap?: Record<string, Record<string, RawOptionContract[]>>;
  putExpDateMap?: Record<string, Record<string, RawOptionContract[]>>;
}

export interface BoxRateResult {
  date: string;
  dte: number;
  rate: number;
  worstCaseRate: number;
  lower: number;
  upper: number;
  width: number;
  midPrice: number;
  worstCaseCredit: number;
  openInterest: number;
}

const MIN_OPEN_INTEREST = 100;
const MIN_WIDTH = 500;
const STRIKE_GRID_STEP = 100;

interface LegQuote {
  bid: number;
  ask: number;
  oi: number;
}

interface ExpirationSlice {
  date: string;
  dte: number;
  calls: Map<number, LegQuote>;
  puts: Map<number, LegQuote>;
}

function isValidLeg(c: RawOptionContract): boolean {
  return (
    c.optionRoot === "SPX" &&
    c.settlementType === "A" &&
    typeof c.bidPrice === "number" &&
    typeof c.askPrice === "number" &&
    c.bidPrice >= 0 &&
    c.askPrice >= 0
  );
}

function toLegQuote(c: RawOptionContract): LegQuote | null {
  if (!isValidLeg(c)) return null;
  return {
    bid: c.bidPrice as number,
    ask: c.askPrice as number,
    oi: c.openInterest ?? 0,
  };
}

function sliceChain(chain: RawChain): ExpirationSlice[] {
  const byExpKey = new Map<string, ExpirationSlice>();

  function ingest(
    side: "CALL" | "PUT",
    map?: Record<string, Record<string, RawOptionContract[]>>
  ) {
    if (!map) return;
    for (const [expKey, strikeMap] of Object.entries(map)) {
      const [date, dteStr] = expKey.split(":");
      const dte = Number(dteStr);
      if (!date || !Number.isFinite(dte) || dte <= 0) continue;

      let slice = byExpKey.get(expKey);
      if (!slice) {
        slice = { date, dte, calls: new Map(), puts: new Map() };
        byExpKey.set(expKey, slice);
      }

      for (const [strikeStr, contracts] of Object.entries(strikeMap)) {
        const strike = Number(strikeStr);
        if (!Number.isFinite(strike)) continue;
        if (strike % STRIKE_GRID_STEP !== 0) continue;
        const c = contracts[0];
        if (!c) continue;
        const leg = toLegQuote(c);
        if (!leg) continue;
        const target = side === "CALL" ? slice.calls : slice.puts;
        target.set(strike, leg);
      }
    }
  }

  ingest("CALL", chain.callExpDateMap);
  ingest("PUT", chain.putExpDateMap);
  return Array.from(byExpKey.values());
}

interface Candidate {
  lower: number;
  upper: number;
  width: number;
  midPrice: number;
  worstCaseCredit: number;
  minOI: number;
}

function evaluatePair(
  lower: number,
  upper: number,
  slice: ExpirationSlice
): Candidate | null {
  const lCall = slice.calls.get(lower);
  const uCall = slice.calls.get(upper);
  const lPut = slice.puts.get(lower);
  const uPut = slice.puts.get(upper);
  if (!lCall || !uCall || !lPut || !uPut) return null;

  const lCallMid = (lCall.bid + lCall.ask) / 2;
  const uCallMid = (uCall.bid + uCall.ask) / 2;
  const uPutMid = (uPut.bid + uPut.ask) / 2;
  const lPutMid = (lPut.bid + lPut.ask) / 2;

  const midPrice = lCallMid - uCallMid + uPutMid - lPutMid;

  // Short-box borrower worst case: sell lower call @ bid, buy upper call @ ask,
  // buy lower put @ ask, sell upper put @ bid. Receive least credit.
  const worstCaseCredit = lCall.bid - uCall.ask - lPut.ask + uPut.bid;

  const minOI = Math.min(lCall.oi, uCall.oi, lPut.oi, uPut.oi);
  return {
    lower,
    upper,
    width: upper - lower,
    midPrice,
    worstCaseCredit,
    minOI,
  };
}

function rateOf(width: number, price: number, dte: number): number {
  return ((width - price) / price) * (365 / dte);
}

export function computeBoxRates(chain: RawChain): BoxRateResult[] {
  const results: BoxRateResult[] = [];
  const slices = sliceChain(chain);

  for (const slice of slices) {
    const strikes = Array.from(slice.calls.keys())
      .filter((s) => slice.puts.has(s))
      .sort((a, b) => a - b);

    let best: { candidate: Candidate; rate: number } | null = null;
    for (let i = 0; i < strikes.length; i++) {
      for (let j = i + 1; j < strikes.length; j++) {
        const cand = evaluatePair(strikes[i], strikes[j], slice);
        if (!cand) continue;
        if (cand.width < MIN_WIDTH) continue;
        if (cand.minOI < MIN_OPEN_INTEREST) continue;
        if (cand.midPrice <= 0 || cand.midPrice >= cand.width) continue;
        const rate = rateOf(cand.width, cand.midPrice, slice.dte);
        if (!best || rate > best.rate) best = { candidate: cand, rate };
      }
    }

    if (!best) continue;
    const { candidate, rate } = best;
    const worstCaseRate =
      candidate.worstCaseCredit > 0 &&
      candidate.worstCaseCredit < candidate.width
        ? rateOf(candidate.width, candidate.worstCaseCredit, slice.dte)
        : rate;

    results.push({
      date: slice.date,
      dte: slice.dte,
      rate,
      worstCaseRate,
      lower: candidate.lower,
      upper: candidate.upper,
      width: candidate.width,
      midPrice: candidate.midPrice,
      worstCaseCredit: candidate.worstCaseCredit,
      openInterest: candidate.minOI,
    });
  }

  return results.sort((a, b) => a.dte - b.dte);
}
