interface BrokerageGuideProps {
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

export function BrokerageGuide({ expiry, limitPrice }: BrokerageGuideProps) {
  const expiryLabel = formatExpiry(expiry);
  const price = formatPrice(limitPrice);

  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-gray-900">
        Step-by-step: Enter this order on Schwab
      </h3>

      <Prerequisites items={[
        "Options Level 3 required ('Short Uncovered') — Level 2 is not sufficient",
        "Minimum $25,000 account value for Level 3",
        "Margin account required — not available in IRAs",
        "Portfolio Margin recommended ($125K minimum at Schwab) — under Reg T, the margin requirement equals 100% of the spread value plus ~25% penalty (a $100K box consumes ~$125K in buying power)",
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

      <div className="mt-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Pre-submit checklist</h3>
        <div className="space-y-1.5 text-sm text-gray-700">
          <div>&#9744; All 4 legs match the table above</div>
          <div>&#9744; Net effect shows as <span className="text-green-600 font-medium">credit</span> (you receive money)</div>
          <div>&#9744; Margin impact is reasonable (near zero for Portfolio Margin)</div>
          <div>&#9744; Expiration is standard SPX monthly (European, AM-settled), not SPXW weekly</div>
          <div>&#9744; Order type is LMT at the limit price shown above</div>
          <div>&#9744; Time in force is GTC</div>
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
