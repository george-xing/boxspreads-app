import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learn Box Spreads — boxspreads.app",
  description:
    "What are box spreads? Prerequisites, risks, tax treatment, and how they compare to margin loans, HELOCs, and SBLOCs.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Box Spread Borrowing Guide
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Everything you need to know about borrowing at near-Treasury rates
          using SPX box spreads.
        </p>
      </div>

      <Section title="What is a box spread?">
        <p>
          A box spread is a combination of four SPX index options that creates a
          position with a fixed, known payoff at expiration — regardless of where
          the market goes. When you <strong className="font-semibold text-gray-900">sell</strong> a box spread
          (short box), you receive cash today and owe a fixed amount at expiry.
          This is economically identical to a zero-coupon loan.
        </p>
        <p>
          To borrow (short box): sell a call and buy a put at the lower strike,
          buy a call and sell a put at the upper strike. You receive a net credit
          today and owe the strike difference x 100 at expiry — no matter what
          happens to the market.
        </p>
      </Section>

      <Section title="Prerequisites">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="font-semibold text-gray-900">Portfolio Margin</strong> — Required at most brokerages. Reg T margin treats box spreads punitively (margin requirement ≈ full notional). Portfolio Margin recognizes the zero-risk nature and requires minimal collateral.</li>
          <li><strong className="font-semibold text-gray-900">Level 3+ options approval</strong> — You need approval for spreads/combos. At IBKR this is straightforward; at Fidelity/Schwab it can require calling in.</li>
          <li><strong className="font-semibold text-gray-900">$100K+ account</strong> — Portfolio Margin typically requires $100K-$175K minimum depending on the brokerage.</li>
          <li><strong className="font-semibold text-gray-900">Taxable account</strong> — Cannot be done in retirement accounts (IRA, 401k).</li>
        </ul>
      </Section>

      <Section title="Risks">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="font-semibold text-gray-900">Margin calls</strong> — The box spread uses margin capacity. A severe market downturn can trigger margin calls on your portfolio, potentially forcing liquidation of other positions.</li>
          <li><strong className="font-semibold text-gray-900">Rolling risk</strong> — At expiry, if you don&apos;t roll into a new box, you owe the full repayment. If you miss the roll window, your broker may charge margin loan rates on the balance.</li>
          <li><strong className="font-semibold text-gray-900">Execution risk</strong> — Mis-entering any of the 4 legs can create unintended exposure. Always use combo/spread order entry, not individual legs.</li>
          <li><strong className="font-semibold text-gray-900">Liquidity risk</strong> — In extreme market conditions, SPX options may become illiquid, making it difficult to roll positions.</li>
        </ul>
      </Section>

      <Section title="Tax treatment (Section 1256)">
        <p>
          SPX options are Section 1256 contracts. Gains and losses receive
          favorable 60/40 treatment: 60% taxed as long-term capital gains, 40%
          as short-term — regardless of holding period. The implied
          &quot;interest&quot; on a box spread manifests as a capital loss, which is
          deductible at this blended rate.
        </p>
        <p>
          Unlike mortgage interest (capped at $750K principal) or margin interest
          (limited to investment income), box spread losses have no deduction
          cap. Section 1256 losses can also be carried back 3 years.
        </p>
      </Section>

      <Section title="Box spreads vs. alternatives">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-500">Method</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-500">Typical Rate</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-500">Tax Deductible?</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-500">Key Tradeoff</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-200"><td className="px-3 py-2 font-semibold text-green-700">Box Spread</td><td className="px-3 py-2">Treasury + ~30bps</td><td className="px-3 py-2">Yes (60/40)</td><td className="px-3 py-2">Complex execution, margin risk</td></tr>
              <tr className="border-b border-gray-200"><td className="px-3 py-2">Margin Loan</td><td className="px-3 py-2">10-12%</td><td className="px-3 py-2">Limited</td><td className="px-3 py-2">Simple but expensive</td></tr>
              <tr className="border-b border-gray-200"><td className="px-3 py-2">SBLOC / PAL</td><td className="px-3 py-2">5-8%</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Variable rate, call risk</td></tr>
              <tr><td className="px-3 py-2">HELOC</td><td className="px-3 py-2">7-9%</td><td className="px-3 py-2">Limited</td><td className="px-3 py-2">Requires property, slow setup</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <div className="text-center">
        <Link
          href="/"
          className="inline-block rounded-xl bg-green-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
        >
          Calculate Your Rate →
        </Link>
      </div>
    </div>
  );
}
