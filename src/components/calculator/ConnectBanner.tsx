export function ConnectBanner() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div>
        <strong className="font-semibold">Connect Schwab for accurate rates and a pastable order.</strong>{" "}
        The numbers below use Treasury yields — real box prices, liquidity, and Schwab-pasteable orders require your chain.
      </div>
      <button
        type="button"
        disabled
        className="flex-shrink-0 rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-not-allowed"
        title="Schwab Commercial API approval pending"
      >
        Connect · soon
      </button>
    </div>
  );
}
