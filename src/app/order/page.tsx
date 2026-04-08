"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { OrderSummary } from "@/components/order/OrderSummary";
import { LegTable } from "@/components/order/LegTable";
import { OrderParams } from "@/components/order/OrderParams";
import { FeeBreakdown } from "@/components/order/FeeBreakdown";
import { PreSubmitChecklist } from "@/components/order/PreSubmitChecklist";
import { BrokerageGuide } from "@/components/order/BrokerageGuide";
import { selectStrikes, findNearestExpiry, buildBoxLegs, calcSpreadWidth } from "@/lib/strikes";
import { BROKERAGE_FEES } from "@/lib/constants";
import type { Brokerage, Tenor } from "@/lib/types";

const CURRENT_SPX = 5500;

function OrderContent() {
  const searchParams = useSearchParams();
  const amount = Number(searchParams.get("amount")) || 250000;
  const tenor = (searchParams.get("tenor") as Tenor) || "1Y";
  const brokerage = (searchParams.get("brokerage") as Brokerage) || "ibkr";
  const rate = Number(searchParams.get("rate")) || 0.0412;

  const order = useMemo(() => {
    const contracts = 1;
    const { lower, upper } = selectStrikes(amount, contracts, CURRENT_SPX);
    const expiry = findNearestExpiry(tenor, new Date());
    const legs = buildBoxLegs(lower, upper, expiry);
    const spreadWidth = calcSpreadWidth(amount, contracts);

    const tenorMonths = { "3M": 3, "6M": 6, "1Y": 12, "2Y": 24, "3Y": 36, "5Y": 60 }[tenor] ?? 12;
    const dte = Math.round(tenorMonths * 30.44);
    const limitPrice = spreadWidth / (1 + rate * (dte / 365));

    return { legs, expiry, spreadWidth, limitPrice, contracts };
  }, [amount, tenor, rate]);

  const fees = BROKERAGE_FEES[brokerage];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Builder</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your box spread order, ready to enter at your brokerage.
        </p>
      </div>

      <OrderSummary amount={amount} tenor={tenor} rate={rate} brokerage={brokerage} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">
          Your box spread order{" "}
          <span className="font-normal text-gray-600">— 4 legs, auto-calculated</span>
        </h3>
        <LegTable legs={order.legs} expiry={order.expiry} />
        <div className="mt-3 rounded-lg border border-blue-800 bg-blue-900/10 p-3">
          <p className="text-xs text-blue-400">
            <strong>Why these strikes?</strong> Spread width of $
            {order.spreadWidth.toLocaleString()} x 100 multiplier = $
            {amount.toLocaleString()} notional. Strikes selected near current SPX
            level for liquidity.
          </p>
        </div>
      </div>

      <OrderParams
        spreadWidth={order.spreadWidth}
        limitPrice={order.limitPrice}
        contracts={order.contracts}
      />

      <FeeBreakdown fees={fees} contracts={order.contracts} borrowAmount={amount} />

      <BrokerageGuide
        brokerage={brokerage}
        expiry={order.expiry}
        limitPrice={order.limitPrice}
      />

      <PreSubmitChecklist />

      <div className="text-center">
        <a
          href="/"
          className="text-sm text-gray-500 underline hover:text-gray-300"
        >
          ← Back to calculator
        </a>
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
