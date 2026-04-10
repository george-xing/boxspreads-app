import type { Brokerage } from "@/lib/types";

interface BrokerageGuideProps {
  brokerage: Brokerage;
  expiry: string;
  limitPrice: number;
}

interface GuideStep {
  step: number;
  title: string;
  desc: string;
}

function StepList({ steps }: { steps: GuideStep[] }) {
  return (
    <div className="space-y-4">
      {steps.map(({ step, title, desc }) => (
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

function IbkrGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <StepList steps={[
      { step: 1, title: "Open Spread Trader in TWS", desc: "Go to Trading Tools → Spread Trader. Select SPX as the underlying. This is NOT the same as regular order entry — Spread Trader handles multi-leg combos correctly." },
      { step: 2, title: "Select the expiration", desc: `Choose ${expiryLabel} (SPX). Make sure you select SPX (European, AM-settled), NOT SPXW (weekly). European settlement means your box can only be exercised at expiry.` },
      { step: 3, title: "Build the combo: enter all 4 legs", desc: "Add each leg exactly as shown in the table above. Enter them in sequence: Sell Call (lower), Buy Call (upper), Buy Put (lower), Sell Put (upper). This is a short box — you receive credit." },
      { step: 4, title: "Set the limit price", desc: `Enter $${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} as the limit price for the combo. Order type: LMT. Time in force: GTC (Good 'Til Cancelled).` },
      { step: 5, title: "Preview and submit", desc: "Click Preview Order. Verify the margin impact shows a small increase (not the full notional). If margin impact equals the full spread width, you may be on Reg T — contact your broker about Portfolio Margin." },
    ]} />
  );
}

function SchwabGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <StepList steps={[
      { step: 1, title: "Open thinkorswim (desktop or web)", desc: "Log in to thinkorswim at trade.thinkorswim.com or launch the desktop app. The web version supports multi-leg orders but the desktop app is more reliable for complex spreads." },
      { step: 2, title: "Go to the Trade tab and enter SPX", desc: "Type SPX in the symbol box. Select the option chain. Make sure you're looking at standard SPX options (European, AM-settled), not SPXW weeklies." },
      { step: 3, title: `Select the ${expiryLabel} expiration`, desc: "Expand the option chain for this expiration. You'll need to build a custom spread since thinkorswim doesn't have a dedicated box spread order type." },
      { step: 4, title: "Build the 4-leg custom spread", desc: "Right-click on the first option and select 'Buy Custom Spread' or use the Spread book. Add all 4 legs exactly as shown in the table above: Sell Call (lower), Buy Call (upper), Buy Put (lower), Sell Put (upper)." },
      { step: 5, title: "Set the limit price and submit", desc: `Set the order as a Limit order at $${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} net credit. Time in force: GTC. Review all 4 legs carefully, then click Confirm and Send.` },
    ]} />
  );
}

function FidelityGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <StepList steps={[
      { step: 1, title: "Log in to Fidelity.com", desc: "Go to Accounts & Trade → Trade. Fidelity supports multi-leg options orders on the website. Active Trader Pro (desktop) also works but is not required." },
      { step: 2, title: "Select Multi-Leg options trade", desc: "Choose 'Options' as the trade type, then select 'Multi-Leg'. You'll need to add each of the 4 legs individually. Enter SPX as the underlying symbol." },
      { step: 3, title: `Select the ${expiryLabel} expiration for all legs`, desc: "For each leg, select the same expiration date. Use standard SPX monthly options (European, AM-settled). Fidelity lists these separately from SPXW weeklies." },
      { step: 4, title: "Enter all 4 legs", desc: "Add each leg exactly as shown in the table above. For each leg, select the correct action (Buy/Sell), strike price, and option type (Call/Put). Double-check that the net effect shows as a credit." },
      { step: 5, title: "Set the limit price and submit", desc: `Set the order as a Limit at $${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} net credit. Duration: GTC. Fidelity's commission is $0.65/contract. Review and submit. Note: Fidelity does not pass through the CBOE proprietary index fee, so total fees are lower than IBKR.` },
    ]} />
  );
}

export function BrokerageGuide({ brokerage, expiry, limitPrice }: BrokerageGuideProps) {
  const label = brokerage === "ibkr" ? "IBKR" : brokerage === "fidelity" ? "Fidelity" : "Schwab";

  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-gray-900">
        Step-by-step: Enter this order on {label}
      </h3>

      {brokerage === "ibkr" && <IbkrGuide expiry={expiry} limitPrice={limitPrice} />}
      {brokerage === "schwab" && <SchwabGuide expiry={expiry} limitPrice={limitPrice} />}
      {brokerage === "fidelity" && <FidelityGuide expiry={expiry} limitPrice={limitPrice} />}

      <div className="mt-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Pre-submit checklist</h3>
        <div className="space-y-1.5 text-sm text-gray-700">
          <div>☐ All 4 legs match the table above</div>
          <div>☐ Net effect shows as <span className="text-green-600 font-medium">credit</span> (you receive money)</div>
          <div>☐ Margin impact is small (&lt; $10K for Portfolio Margin)</div>
          <div>☐ Expiration is a standard monthly, not a weekly (SPXW)</div>
          <div>☐ Order type is LMT at the limit price shown above</div>
        </div>
        <p className="border-l-2 border-orange-400 pl-3 text-xs text-orange-700">
          <strong>Double-check:</strong> A reversed buy/sell on any leg turns
          this from a defined-risk box into a naked options position.
        </p>
        <p className="border-l-2 border-blue-400 pl-3 text-xs text-blue-700">
          <strong>Fill tip:</strong> Box spreads often fill within a few hours.
          If no fill in 24h, raise the limit price by $1–2.
        </p>
      </div>
    </div>
  );
}
