"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { OrderSummary } from "@/components/order/OrderSummary";
import { LegTable } from "@/components/order/LegTable";
import { OrderParams } from "@/components/order/OrderParams";
import { FeeBreakdown } from "@/components/order/FeeBreakdown";
import { PreSubmitChecklist } from "@/components/order/PreSubmitChecklist";
import { BrokerageGuide } from "@/components/order/BrokerageGuide";
import { selectStrikes, findNearestExpiry, buildBoxLegs, calcDte } from "@/lib/strikes";
import { BROKERAGE_FEES, BROKERAGES, TENORS } from "@/lib/constants";
import type { Brokerage, Tenor } from "@/lib/types";

const CURRENT_SPX = 5500;

const VALID_TENORS = new Set(TENORS.map((t) => t.value));
const VALID_BROKERAGES = new Set(BROKERAGES.map((b) => b.value));

function isValidTenor(v: string | null): v is Tenor {
  return v !== null && VALID_TENORS.has(v as Tenor);
}

function isValidBrokerage(v: string | null): v is Brokerage {
  return v !== null && VALID_BROKERAGES.has(v as Brokerage);
}

function OrderContent() {
  const searchParams = useSearchParams();

  const rawAmount = Number(searchParams.get("amount"));
  const amount = rawAmount > 0 && isFinite(rawAmount) ? rawAmount : 250000;

  const rawTenor = searchParams.get("tenor");
  const tenor: Tenor = isValidTenor(rawTenor) ? rawTenor : "1Y";

  const rawBrokerage = searchParams.get("brokerage");
  const brokerage: Brokerage = isValidBrokerage(rawBrokerage) ? rawBrokerage : "ibkr";

  const rawRate = Number(searchParams.get("rate"));
  const rate = rawRate > 0 && rawRate < 1 && isFinite(rawRate) ? rawRate : 0.0412;

  const rawDte = Number(searchParams.get("dte"));
  const dteParam = rawDte > 0 && rawDte < 3650 && isFinite(rawDte) ? rawDte : null;

  const order = useMemo(() => {
    const contracts = 1;
    const { lower, upper } = selectStrikes(amount, contracts, CURRENT_SPX);
    const expiry = findNearestExpiry(tenor, new Date());
    const legs = buildBoxLegs(lower, upper, expiry);
    // Use actual strike width (upper - lower), not theoretical width from borrow amount
    const spreadWidth = upper - lower;

    // Use DTE from calculator if provided, otherwise compute from expiry
    const dte = dteParam ?? calcDte(expiry);
    // Limit price: what you receive per share for the short box
    const limitPrice = spreadWidth / (1 + rate * (dte / 365));

    return { legs, expiry, spreadWidth, limitPrice, contracts, dte };
  }, [amount, tenor, rate, dteParam]);

  const fees = BROKERAGE_FEES[brokerage];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Builder</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your box spread order, ready to enter at your brokerage.
        </p>
      </div>

      <OrderSummary amount={order.spreadWidth * 100} tenor={tenor} rate={rate} brokerage={brokerage} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">
          Your box spread order{" "}
          <span className="font-normal text-gray-600">— 4 legs, auto-calculated</span>
        </h3>
        <LegTable legs={order.legs} expiry={order.expiry} />
        <div className="mt-3 rounded-lg border border-blue-800 bg-blue-900/10 p-3">
          <p className="text-xs text-blue-400">
            <strong>Why these strikes?</strong> Spread width of $
            {order.spreadWidth.toLocaleString()} x 100 multiplier ={" "}
            ${(order.spreadWidth * 100).toLocaleString()} notional. Strikes
            based on SPX ~{CURRENT_SPX.toLocaleString()} reference level.
          </p>
        </div>
      </div>

      <OrderParams
        spreadWidth={order.spreadWidth}
        limitPrice={order.limitPrice}
        contracts={order.contracts}
      />

      <FeeBreakdown fees={fees} contracts={order.contracts} borrowAmount={order.spreadWidth * 100} dte={order.dte} />

      <BrokerageGuide
        brokerage={brokerage}
        expiry={order.expiry}
        limitPrice={order.limitPrice}
      />

      <PreSubmitChecklist />

      <div className="text-center">
        <Link
          href="/"
          className="text-sm text-gray-500 underline hover:text-gray-300"
        >
          ← Back to calculator
        </Link>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <OrderContent />
    </Suspense>
  );
}
