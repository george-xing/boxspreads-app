export function PreSubmitChecklist() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Pre-submit checklist</h3>
      <div className="space-y-2 text-sm text-gray-300">
        <div>☐ All 4 legs match the table above</div>
        <div>☐ Net effect shows as <span className="text-green-400">credit</span> (you receive money)</div>
        <div>☐ Margin impact is small (&lt; $10K for Portfolio Margin)</div>
        <div>☐ Expiration is a standard monthly, not a weekly (SPXW)</div>
        <div>☐ Order type is LMT at the limit price shown above</div>
      </div>

      <div className="mt-4 rounded-lg border border-orange-800 bg-orange-900/10 p-3">
        <p className="text-xs text-orange-400">
          <strong>⚠️ Double-check:</strong> A reversed buy/sell on any leg turns
          this from a defined-risk box into a naked options position. If margin
          impact is close to the full notional (~$250K), you may be on Reg T
          instead of Portfolio Margin.
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-blue-800 bg-blue-900/10 p-3">
        <p className="text-xs text-blue-400">
          <strong>💡 Fill tip:</strong> Box spreads often fill within a few hours
          during market hours, but can take 1–3 days. If no fill in 24h, raise
          the limit price by $1–2 (~0.04% in rate terms).
        </p>
      </div>
    </div>
  );
}
