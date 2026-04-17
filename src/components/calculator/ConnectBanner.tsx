export function ConnectBanner() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div>
        <strong className="font-semibold">You&apos;re seeing Treasury-yield estimates.</strong>{" "}
        Real box prices, liquidity, and a Schwab-pasteable order require a
        connected Schwab account — Phase 1 access is invite-only while
        Schwab&apos;s Commercial API approval is pending.
      </div>
      <a
        href="/admin"
        className="flex-shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-300 hover:bg-blue-100 transition-colors"
      >
        Sign in
      </a>
    </div>
  );
}
