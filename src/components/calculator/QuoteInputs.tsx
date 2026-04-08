"use client";

interface QuoteInputsProps {
  bidPrice: number | null;
  askPrice: number | null;
  strikeWidth: number | null;
  dteOverride: number | null;
  autoDte: number;
  onBidChange: (v: number | null) => void;
  onAskChange: (v: number | null) => void;
  onStrikeWidthChange: (v: number | null) => void;
  onDteOverrideChange: (v: number | null) => void;
}

function parseFloat_(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseInt_(v: string): number | null {
  const n = parseInt(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 text-xs text-gray-600">{label}</div>
      <div className="flex items-center rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
        />
        {suffix && (
          <span className="ml-1 text-xs text-gray-600">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export function QuoteInputs({
  bidPrice,
  askPrice,
  strikeWidth,
  dteOverride,
  autoDte,
  onBidChange,
  onAskChange,
  onStrikeWidthChange,
  onDteOverrideChange,
}: QuoteInputsProps) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-gray-500">
        Enter from your SPX option chain
      </div>
      <div className="flex gap-3">
        <Field
          label="Bid price"
          value={bidPrice?.toString() ?? ""}
          placeholder="e.g. 956.20"
          onChange={(v) => onBidChange(v ? parseFloat_(v) : null)}
        />
        <Field
          label="Ask price"
          value={askPrice?.toString() ?? ""}
          placeholder="e.g. 958.80"
          onChange={(v) => onAskChange(v ? parseFloat_(v) : null)}
        />
        <Field
          label="Width"
          value={strikeWidth?.toString() ?? ""}
          placeholder="e.g. 1000"
          onChange={(v) => onStrikeWidthChange(v ? parseFloat_(v) : null)}
          suffix="$"
        />
        <Field
          label="DTE"
          value={dteOverride?.toString() ?? ""}
          placeholder={autoDte.toString()}
          onChange={(v) => onDteOverrideChange(v ? parseInt_(v) : null)}
        />
      </div>
      <div className="mt-2 text-xs text-gray-700">
        Enter bid/ask from your brokerage&apos;s option chain for the box at your target expiry
      </div>
    </div>
  );
}
