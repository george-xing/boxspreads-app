import type { Brokerage } from "@/lib/types";

interface BrokerageGuideProps {
  brokerage: Brokerage;
  expiry: string;
  limitPrice: number;
}

function IbkrGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="space-y-4">
      {[
        { step: 1, title: "Open Spread Trader in TWS", desc: `Go to Trading Tools → Spread Trader. Select SPX as the underlying. This is NOT the same as regular order entry — Spread Trader handles multi-leg combos correctly.` },
        { step: 2, title: "Select the expiration", desc: `Choose ${expiryLabel} (SPX). Make sure you select SPX (European, AM-settled), NOT SPXW (weekly). European settlement means your box can only be exercised at expiry.` },
        { step: 3, title: "Build the combo: enter all 4 legs", desc: "Add each leg exactly as shown in the table above. Enter them in sequence: Sell Call (lower), Buy Call (upper), Buy Put (lower), Sell Put (upper). This is a short box — you receive credit." },
        { step: 4, title: "Set the limit price", desc: `Enter $${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} as the limit price for the combo. Order type: LMT. Time in force: GTC (Good 'Til Cancelled).` },
        { step: 5, title: "Preview and submit", desc: "Click Preview Order. Verify the margin impact shows a small increase (not the full notional). Then submit." },
      ].map(({ step, title, desc }) => (
        <div key={step} className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
            {step}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{title}</div>
            <div className="mt-1 text-xs leading-relaxed text-gray-500">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GenericGuide({ brokerage }: { brokerage: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
      Detailed step-by-step instructions for {brokerage} coming soon. Use the
      leg table and order parameters above to enter the order manually in your
      brokerage&apos;s multi-leg / combo order interface.
    </div>
  );
}

export function BrokerageGuide({ brokerage, expiry, limitPrice }: BrokerageGuideProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-gray-900">
        Step-by-step: Enter this order on{" "}
        {brokerage === "ibkr" ? "IBKR" : brokerage === "fidelity" ? "Fidelity" : "Schwab"}
      </h3>
      {brokerage === "ibkr" ? (
        <IbkrGuide expiry={expiry} limitPrice={limitPrice} />
      ) : (
        <GenericGuide brokerage={brokerage} />
      )}

      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Pre-submit checklist</h3>
        <div className="space-y-1.5 text-sm text-gray-600">
          <div>☐ All 4 legs match the table above</div>
          <div>☐ Net effect shows as <span className="text-green-600">credit</span> (you receive money)</div>
          <div>☐ Margin impact is small (&lt; $10K for Portfolio Margin)</div>
          <div>☐ Expiration is a standard monthly, not a weekly (SPXW)</div>
          <div>☐ Order type is LMT at the limit price shown above</div>
        </div>
        <p className="border-l-2 border-orange-400 pl-3 text-xs text-orange-600">
          <strong>Double-check:</strong> A reversed buy/sell on any leg turns
          this from a defined-risk box into a naked options position.
        </p>
        <p className="border-l-2 border-blue-400 pl-3 text-xs text-blue-600">
          <strong>Fill tip:</strong> Box spreads often fill within a few hours.
          If no fill in 24h, raise the limit price by $1–2.
        </p>
      </div>
    </div>
  );
}
