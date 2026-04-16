"use client";

import { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { YieldCurve } from "./YieldCurve";
import { ExpirationTable } from "./ExpirationTable";
import type { ExpirationRow } from "./ExpirationTable";
import { TargetBorrowInput } from "./TargetBorrowInput";
import { CandidatesPanel } from "./CandidatesPanel";
import { ConnectBanner } from "./ConnectBanner";
import { ConnectStatus } from "./ConnectStatus";
import { TaxRateInputs } from "./TaxRateInputs";
import { Tooltip } from "@/components/ui/Tooltip";
import { LegTable } from "@/components/order/LegTable";
import { OrderParams } from "@/components/order/OrderParams";
import { FeeBreakdown } from "@/components/order/FeeBreakdown";
import { BrokerageGuide } from "@/components/order/BrokerageGuide";
import {
  calcBoxRateSimple,
  calcBlendedTaxRate,
  calcAfterTaxRate,
  calcFeeImpact,
  calcAllInRate,
  interpolateTreasuryYield,
  calcMidFromRate,
  snapStrikeWidth,
} from "@/lib/calc";
import { generateSpxExpirations } from "@/lib/strikes";
import {
  BROKERAGE_FEES,
  DEFAULT_SPREAD_BPS,
  DEFAULT_FEDERAL_TAX_RATE,
  DEFAULT_STATE_TAX_RATE,
  LTCG_RATE_FEDERAL,
  SPX_MULTIPLIER,
} from "@/lib/constants";
import type { TreasuryRates } from "@/lib/types";
import { formatPct, formatDollars } from "@/lib/format";
import type { Candidate, CandidatesResponse } from "@/lib/schwab/types";

type ConnState = "loading" | "connected" | "disconnected";

const FEES = BROKERAGE_FEES.schwab ?? BROKERAGE_FEES.ibkr;

export function Calculator() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  /* ── connection state ─────────────────────────────────── */
  const [connState, setConnState] = useState<ConnState>("loading");
  // `statusError` is a separate signal from `disconnected` — it means the
  // /status endpoint returned a 503 (operational failure), not that the
  // user is actually unconnected. We still fall back to the disconnected
  // UI, but surface a banner so outages don't masquerade as "please
  // reconnect."
  const [statusError, setStatusError] = useState(false);
  const isConnected = connState === "connected";

  /* ── target borrow ────────────────────────────────────── */
  const [targetBorrow, setTargetBorrow] = useState(500_000);

  /* ── chain / candidates ───────────────────────────────── */
  const [chainData, setChainData] = useState<CandidatesResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── tax rates ────────────────────────────────────────── */
  const [federalTaxRate, setFederalTaxRate] = useState(DEFAULT_FEDERAL_TAX_RATE);
  const [stateTaxRate, setStateTaxRate] = useState(DEFAULT_STATE_TAX_RATE);

  /* ── treasury rates ───────────────────────────────────── */
  const [treasuryRates, setTreasuryRates] = useState<TreasuryRates>({});
  const [ratesError, setRatesError] = useState(false);

  /* ── expirations ──────────────────────────────────────── */
  const [expirations] = useState(() => generateSpxExpirations(new Date()));
  const [selectedExpiry, setSelectedExpiry] = useState(() => {
    const target = expirations.find((e) => e.dte >= 350) ?? expirations[expirations.length - 1];
    return target?.date ?? expirations[0]?.date ?? "";
  });

  const selectedExp = expirations.find((e) => e.date === selectedExpiry);
  const dte = selectedExp?.dte ?? 365;

  /* ── derived tax ──────────────────────────────────────── */
  const clampedFederal = Math.max(0, Math.min(1, federalTaxRate));
  const clampedState = Math.max(0, Math.min(1, stateTaxRate));
  const ltcg = clampedFederal <= 0.24 ? 0.15 : LTCG_RATE_FEDERAL;
  const blendedTax = Math.min(1, calcBlendedTaxRate(ltcg, clampedFederal, clampedState));

  /* ── estimated rate (Treasury fallback) ───────────────── */
  const treasuryYield = interpolateTreasuryYield(dte, treasuryRates);
  const estimatedRate = calcBoxRateSimple(treasuryYield, DEFAULT_SPREAD_BPS);

  /* ── live vs estimated rate ───────────────────────────── */
  const liveRate = selectedCandidate?.rate ?? estimatedRate;

  /* ── rate calcs ───────────────────────────────────────── */
  const feeContracts = selectedCandidate?.contracts ?? 1;
  const feeBorrow = selectedCandidate?.actualBorrow ?? targetBorrow;
  const feeImpact = calcFeeImpact(FEES, feeContracts, feeBorrow > 0 ? feeBorrow : 1, dte);
  const allInRate = calcAllInRate(liveRate, feeImpact);
  const afterTaxRate = calcAfterTaxRate(allInRate, blendedTax);

  /* ── summary numbers (use candidate when available) ──── */
  const snappedWidth = selectedCandidate?.strikeWidth ?? snapStrikeWidth(2500);
  const activeMidPrice = selectedCandidate
    ? selectedCandidate.boxCredit
    : calcMidFromRate(estimatedRate, snappedWidth, dte);
  const borrowAmount = selectedCandidate
    ? selectedCandidate.actualBorrow
    : activeMidPrice * SPX_MULTIPLIER * 1;
  const repayment = snappedWidth * SPX_MULTIPLIER * feeContracts;
  const interestCost = Math.abs(repayment - borrowAmount);
  const taxSavings = interestCost * blendedTax;
  const afterTaxCost = interestCost - taxSavings;

  /* ── box rates for yield curve / table ────────────────── */
  const boxRatesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of expirations) {
      const ty = interpolateTreasuryYield(exp.dte, treasuryRates);
      map[exp.date] = calcBoxRateSimple(ty, DEFAULT_SPREAD_BPS);
    }
    return map;
  }, [expirations, treasuryRates]);

  const tableRows: ExpirationRow[] = useMemo(() => {
    return expirations.map((exp) => ({
      date: exp.date,
      label: exp.label,
      dte: exp.dte,
      boxRate: boxRatesMap[exp.date] ?? 0,
    }));
  }, [expirations, boxRatesMap]);

  /* ── handlers ─────────────────────────────────────────── */
  function handleExpiryChange(expiry: string) {
    setSelectedExpiry(expiry);
    setSelectedCandidate(null);
    setChainData(null);
    setChainError(null);
  }

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  /* ── effect: fetch connection status ──────────────────── */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/schwab/status")
      .then(async (r) => {
        if (r.status === 503) {
          // Operational failure on the server (e.g. Supabase unreachable).
          // Degrade to disconnected UX but keep a banner up so users know
          // this isn't a "you're not connected" situation.
          if (!cancelled) {
            setStatusError(true);
            setConnState("disconnected");
          }
          return null;
        }
        if (!r.ok) throw new Error(`status check failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setStatusError(false);
        setConnState(data.connected ? "connected" : "disconnected");
      })
      .catch(() => {
        if (!cancelled) setConnState("disconnected");
      });
    return () => { cancelled = true; };
  }, []);

  /* ── effect: fetch treasury rates ─────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/rates/treasury", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.error || Object.keys(data).length === 0) {
          setRatesError(true);
        } else {
          setTreasuryRates(data);
        }
      })
      .catch(() => { if (!cancelled) setRatesError(true); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  /* ── effect: fetch chain when connected ───────────────── */
  useEffect(() => {
    if (connState !== "connected") return;
    if (!selectedExpiry) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setChainError(null);
      const params = new URLSearchParams({
        expiration: selectedExpiry,
        target: String(targetBorrow),
      });
      // refreshKey > 0 means the user clicked the nav refresh button; pass
      // force=1 so the server bypasses its 5-min in-memory cache. Without
      // this flag the button would be a no-op within the TTL window.
      if (refreshKey > 0) params.set("force", "1");

      fetch(`/api/schwab/chain?${params}`, { signal: controller.signal })
        .then((r) => {
          if (r.status === 401) {
            setConnState("disconnected");
            throw new Error("unauthorized");
          }
          if (!r.ok) throw new Error(`chain fetch failed: ${r.status}`);
          return r.json();
        })
        .then((data: CandidatesResponse) => {
          setChainData(data);
          setSelectedCandidate(data.selected);
          setChainError(null);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          if (err.message !== "unauthorized") {
            setChainError(err.message ?? "Failed to fetch chain");
          }
        });
    }, 400); // debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [connState, selectedExpiry, targetBorrow, refreshKey]);

  /* ── SSR placeholder ──────────────────────────────────── */
  if (!mounted) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Borrow at near-Treasury rates
        </h1>
        <p className="mt-1 text-sm text-gray-500">SPX box spread calculator</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── header ───────────────────────────────────────── */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Borrow at near-Treasury rates
        </h1>
        <p className="mt-1 text-sm text-gray-500">SPX box spread calculator</p>
      </div>

      {/* ── connect banner (disconnected) ────────────────── */}
      {connState === "disconnected" && <ConnectBanner />}

      {statusError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
          Temporary problem checking your Schwab connection — please try again in a moment.
        </div>
      )}

      {ratesError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Using fallback rates — live Treasury data unavailable
        </div>
      )}

      {chainError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
          Chain error: {chainError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-5">
        {/* ── LEFT: yield curve + expiration table ──────── */}
        <div className="rounded-xl border border-gray-300 bg-white p-5 flex flex-col">
          <div className="flex-1 min-h-[200px]">
            <YieldCurve
              expirations={expirations}
              selectedExpiry={selectedExpiry}
              onSelect={handleExpiryChange}
              boxRates={boxRatesMap}
            />
          </div>
          <div className="border-t border-gray-200 pt-3 mt-3">
            <ExpirationTable
              rows={tableRows}
              selectedExpiry={selectedExpiry}
              onSelect={handleExpiryChange}
            />
          </div>
        </div>

        {/* ── RIGHT: configure panel ───────────────────── */}
        <div className="rounded-xl border border-gray-300 bg-white p-5 space-y-3">
          {/* connection status (connected only) */}
          {isConnected && (
            <div className="flex items-center justify-between">
              <ConnectStatus
                connected
                asOf={chainData?.asOf}
                underlyingLast={chainData?.underlying.last}
                onRefresh={handleRefresh}
              />
            </div>
          )}

          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Configure</div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Expiration</span>
            <span className="text-sm font-semibold text-gray-900">
              {selectedExp?.label ?? ""}{" "}
              <span className="font-normal text-gray-500">({dte}d)</span>
            </span>
          </div>

          {/* target borrow input (replaces UnifiedCalculator) */}
          <TargetBorrowInput
            value={targetBorrow}
            onChange={setTargetBorrow}
            disabled={connState === "loading"}
          />

          {/* ── candidates panel ─────────────────────────── */}
          {isConnected && (
            <CandidatesPanel
              state="connected"
              candidates={chainData?.candidates ?? []}
              selected={selectedCandidate}
              onSelect={setSelectedCandidate}
              reason={chainData?.reason}
            />
          )}

          {/* ── estimate info (disconnected) ─────────────── */}
          {!isConnected && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
              These rates are estimates based on Treasury yields + 30bps spread.
              Connect Schwab above for real-time option chain data and accurate
              tradeable rates.
            </div>
          )}

          {/* ── tax rates ────────────────────────────────── */}
          <div className="border-t border-gray-200 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Tax rates</div>
            <TaxRateInputs
              federalRate={federalTaxRate}
              stateRate={stateTaxRate}
              onFederalChange={setFederalTaxRate}
              onStateChange={setStateTaxRate}
            />
          </div>

          {/* ── rates display ────────────────────────────── */}
          <div className="border-t border-gray-200 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              {isConnected && selectedCandidate ? "Live rates" : "Estimated rates"}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Pre-tax rate</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900">{formatPct(allInRate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">After-tax effective rate</span>
                <span className="text-base font-bold tabular-nums text-green-600">{formatPct(afterTaxRate)}</span>
              </div>
            </div>

            {/* ── summary ────────────────────────────────── */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Summary</div>
              <div className="text-[13px] text-gray-700 leading-relaxed">
                <strong className="text-gray-900">Borrow {formatDollars(borrowAmount)} today</strong>,
                repay {formatDollars(repayment)} on {selectedExp?.label ?? ""}.
                {" "}Your total interest cost over {dte} days is{" "}
                <span className="text-orange-600 font-semibold">{formatDollars(interestCost)}</span>.
                {" "}If you have at least {formatDollars(interestCost)} in capital gains to offset, you&apos;ll save{" "}
                <span className="text-green-600 font-semibold">{formatDollars(taxSavings)}</span>
                {" "}in taxes due to Section 1256 treatment.
                {" "}Your after-tax total cost is{" "}
                <span className="text-green-700 font-bold">{formatDollars(afterTaxCost)}</span>.
                <Tooltip content={`Section 1256: 60% long-term capital loss (${formatPct(ltcg)}) + 40% short-term (${formatPct(clampedFederal)})${clampedState > 0 ? ` + ${formatPct(clampedState)} state` : ""}. The tax savings require sufficient capital gains to offset the box spread loss at expiry.`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── disconnected: candidates empty state ─────────── */}
      {connState === "disconnected" && (
        <CandidatesPanel
          state="disconnected"
          candidates={[]}
          selected={null}
          onSelect={() => {}}
        />
      )}

      {/* ── order section (connected + candidate selected) ─ */}
      {isConnected && selectedCandidate && (
        <div className="rounded-xl border border-gray-300 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Your Order</h2>
            <Tooltip content="These strikes and prices come from the live Schwab option chain. The order below matches your selected candidate." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div><LegTable liveLegs={selectedCandidate.legs} expiry={selectedExpiry} /></div>
            <div>
              <OrderParams
                spreadWidth={selectedCandidate.strikeWidth}
                limitPrice={selectedCandidate.boxCredit}
                contracts={selectedCandidate.contracts}
              />
            </div>
            <div>
              <FeeBreakdown
                fees={FEES}
                contracts={selectedCandidate.contracts}
                borrowAmount={selectedCandidate.actualBorrow}
                dte={dte}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── brokerage guide (connected + candidate) ──────── */}
      {isConnected && selectedCandidate && (
        <div className="rounded-xl border border-gray-300 bg-white p-5 space-y-4">
          <BrokerageGuide
            expiry={selectedExpiry}
            limitPrice={selectedCandidate.boxCredit}
          />
        </div>
      )}
    </div>
  );
}
