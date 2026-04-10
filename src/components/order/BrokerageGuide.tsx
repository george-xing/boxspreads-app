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

function Prerequisites({ items }: { items: string[] }) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Prerequisites</div>
      <ul className="space-y-1 text-xs text-gray-600">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function formatPrice(limitPrice: number): string {
  return `$${limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function formatExpiry(expiry: string): string {
  return new Date(expiry + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function IbkrGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = formatExpiry(expiry);
  const price = formatPrice(limitPrice);

  return (
    <>
      <Prerequisites items={[
        "Options Level 2 or higher (Level 2 includes long box spreads)",
        "Margin account required",
        "Portfolio Margin strongly recommended ($110K+ net liquidation) — under Reg T, margin requirement equals the full spread value, consuming all buying power",
      ]} />
      <StepList steps={[
        {
          step: 1,
          title: "Open Strategy Builder in TWS or IBKR Desktop",
          desc: "Go to Trading Tools → Option Chain, then toggle on 'Strategy Builder' at the bottom. This is the recommended approach — it has a built-in 'Box' strategy template. The older SpreadTrader also works but Strategy Builder is faster.",
        },
        {
          step: 2,
          title: "Enter SPX and set the view",
          desc: "Type SPX in the symbol field. Set the dropdown to 'PUT/CALLs (Side by Side)' so you can see both calls and puts at each strike.",
        },
        {
          step: 3,
          title: `Select the ${expiryLabel} expiration`,
          desc: "Choose your expiration from the selector at the top. Click 'MORE' if it's not shown. Nearer-term dates have better liquidity and tighter fills. Make sure you select SPX (European, AM-settled), NOT SPXW (weekly).",
        },
        {
          step: 4,
          title: "Select the 'Box' strategy template and click your strikes",
          desc: "In the Strategy Builder, change the strategy dropdown from 'Custom' to 'Box'. Then click the strikes in the option chain to populate the legs. Use round strike numbers (4000, 5000, 5500) — non-round strikes have near-zero open interest. Wider spreads generally get better implied rates.",
        },
        {
          step: 5,
          title: "Verify all 4 legs and check the Credit/Debit label",
          desc: "The order panel will show all 4 legs. The critical check: look at the Credit/Debit label next to the price field. For borrowing (short box), it must say 'Credit' — you receive cash now and owe at expiration. If it says 'Debit', the direction is reversed. Trust the label over your mental model of buy/sell.",
        },
        {
          step: 6,
          title: `Set limit price to ${price} — NEVER use a market order`,
          desc: `Enter ${price} as a LMT (limit) order. Market orders on box spreads can cost hundreds in slippage due to wide bid/ask spreads. Start near the midpoint of the combo's bid/ask. Set time-in-force to GTC (Good 'Til Cancelled).`,
        },
        {
          step: 7,
          title: "Submit and wait for the fill",
          desc: "Click Submit Order and verify the confirmation shows the correct credit amount. Fills can take minutes to hours. If no fill after 24 hours, lower your credit price by $0.50–1.00 at a time (accept slightly less cash for better fill odds). Don't cancel and re-enter — just modify the existing order.",
        },
      ]} />
    </>
  );
}

function SchwabGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = formatExpiry(expiry);
  const price = formatPrice(limitPrice);

  return (
    <>
      <Prerequisites items={[
        "Options Level 3 required ('Short Uncovered') — Level 2 is not sufficient",
        "Minimum $25,000 account value for Level 3",
        "Margin account required — not available in IRAs",
        "Portfolio Margin recommended ($125K minimum at Schwab) — under Reg T, selling a $20K box consumes ~$25K in buying power",
      ]} />
      <StepList steps={[
        {
          step: 1,
          title: "Open thinkorswim desktop or web",
          desc: "Log in to thinkorswim at trade.thinkorswim.com or launch the desktop app. Both support multi-leg orders. The desktop app is more reliable for complex spreads. Note: thinkorswim does NOT have a 'Box' strategy template — you'll build it as a custom spread.",
        },
        {
          step: 2,
          title: "Go to the Trade tab and enter $SPX",
          desc: "Type $SPX (or .SPX) in the symbol box. Expand the option chain. Make sure you're looking at standard SPX options (European, AM-settled), not SPXW weeklies.",
        },
        {
          step: 3,
          title: `Select the ${expiryLabel} expiration`,
          desc: "Expand the option chain for this expiration. You'll see calls on the left, puts on the right, with strikes in the middle.",
        },
        {
          step: 4,
          title: "Ctrl+click to build the 4-leg custom spread",
          desc: "Click the Bid of the lower-strike Call (Sell). Then hold Ctrl (Cmd on Mac) and click: the Ask of the higher-strike Call (Buy), the Ask of the lower-strike Put (Buy), and the Bid of the higher-strike Put (Sell). All 4 legs should appear in the Order Entry panel at the bottom.",
        },
        {
          step: 5,
          title: "Verify all legs show the correct actions",
          desc: "Check: Sell Call (lower), Buy Call (upper), Buy Put (lower), Sell Put (upper). All quantities must match. The net effect should show as a credit (you receive money). If it shows a debit, the direction is wrong — cancel and rebuild.",
        },
        {
          step: 6,
          title: `Set limit price to ${price}`,
          desc: `Set order type to LIMIT at ${price} net credit. Time in force: GTC. Schwab also offers 'Walk Limit' — an order type that automatically adjusts your price along the bid/ask spread to seek a fill. This can be useful if the spread is wide.`,
        },
        {
          step: 7,
          title: "Confirm and Send",
          desc: "Click Confirm and Send. Review the confirmation dialog carefully — verify the net credit amount and all 4 legs. Fills may take hours. If no fill in 24 hours, lower your credit price by $0.50–1.00 at a time to improve fill odds.",
        },
      ]} />
    </>
  );
}

function FidelityGuide({ expiry, limitPrice }: { expiry: string; limitPrice: number }) {
  const expiryLabel = formatExpiry(expiry);
  const price = formatPrice(limitPrice);

  return (
    <>
      <Prerequisites items={[
        "Options Tier 2 required (includes spreads approval)",
        "Minimum $10,000 net worth, $2,000 margin equity",
        "Margin account required — short box spreads are NOT allowed in IRAs",
        "Portfolio Margin recommended for capital efficiency",
      ]} />
      <StepList steps={[
        {
          step: 1,
          title: "Open options trade on Fidelity.com or Fidelity Trader+",
          desc: "Go to Accounts & Trade → Trade, select Options. You can also use Fidelity Trader+ Desktop (the replacement for Active Trader Pro) — navigate to Tools → Multi-leg Options.",
        },
        {
          step: 2,
          title: "Enter .SPX and select Custom strategy with 4 legs",
          desc: "Type .SPX in the symbol field (the leading dot is important — it denotes the index). From the Strategy dropdown, select 'Custom'. If you see only 2 legs, click '4 Legs' to expand. Fidelity does not have a 'Box' preset.",
        },
        {
          step: 3,
          title: `Select ${expiryLabel} expiration for all 4 legs`,
          desc: "Set the same expiration for every leg. Use standard SPX monthly options (European, AM-settled). Fidelity lists these separately from SPXW weeklies.",
        },
        {
          step: 4,
          title: "Configure all 4 legs",
          desc: "Leg 1: Sell to Open, Call, lower strike. Leg 2: Buy to Open, Call, higher strike. Leg 3: Buy to Open, Put, higher strike. Leg 4: Sell to Open, Put, lower strike. All quantities must match. Double-check each leg — a wrong action turns a riskless box into a naked position.",
        },
        {
          step: 5,
          title: `Set Net Credit limit price to ${price}`,
          desc: `Set order type to Limit at ${price} net credit. NEVER use a market order. Set duration to GTC. Fidelity's commission is $0.65/contract — they may not pass through the CBOE proprietary index fee, making total fees lower than other brokerages.`,
        },
        {
          step: 6,
          title: "Preview, triple-check, and place",
          desc: "Click Preview. Verify all 4 legs, the net credit amount, and the total fees. Click Place to submit.",
        },
        {
          step: 7,
          title: "If the order is immediately cancelled",
          desc: "Some Fidelity orders route through Citadel Securities, which may reject multi-leg box spread orders. If this happens, enter the trade as two separate spreads: (1) a bear call spread and (2) a bull put spread at the same strikes. This introduces slight execution risk but is the known workaround. You can also call Fidelity's trade desk for assistance.",
        },
      ]} />
    </>
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
          <div>☐ Margin impact is reasonable (near zero for Portfolio Margin)</div>
          <div>☐ Expiration is standard SPX monthly (European, AM-settled), not SPXW weekly</div>
          <div>☐ Order type is LMT at the limit price shown above</div>
          <div>☐ Time in force is GTC</div>
        </div>
        <p className="border-l-2 border-orange-400 pl-3 text-xs text-orange-700">
          <strong>Double-check:</strong> A reversed buy/sell on any leg turns
          this from a defined-risk box into a naked options position. Verify the Credit/Debit label matches your intention.
        </p>
        <p className="border-l-2 border-blue-400 pl-3 text-xs text-blue-700">
          <strong>Fill tip:</strong> Start near the midpoint of the combo bid/ask spread.
          If no fill in 24h, lower your credit price by $0.50–1.00 at a time (you accept slightly less cash, which improves your fill odds). Don&apos;t cancel and re-enter — modify the existing order.
        </p>
      </div>
    </div>
  );
}
