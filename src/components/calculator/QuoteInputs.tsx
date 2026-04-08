"use client";

import { useState, useEffect } from "react";

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

function NumericField({
  label,
  numericValue,
  placeholder,
  onValueChange,
  suffix,
  integer,
}: {
  label: string;
  numericValue: number | null;
  placeholder: string;
  onValueChange: (v: number | null) => void;
  suffix?: string;
  integer?: boolean;
}) {
  const [text, setText] = useState(numericValue?.toString() ?? "");

  // Sync local text when parent clears the value (e.g., tenor change)
  useEffect(() => {
    if (numericValue === null) setText("");
  }, [numericValue]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setText(raw);
    if (raw === "") {
      onValueChange(null);
      return;
    }
    const n = integer ? parseInt(raw) : parseFloat(raw);
    if (Number.isFinite(n) && n > 0) {
      onValueChange(n);
    }
  }

  function handleBlur() {
    if (text === "") return;
    const n = integer ? parseInt(text) : parseFloat(text);
    if (Number.isFinite(n) && n > 0) {
      setText(n.toString());
    } else {
      setText("");
      onValueChange(null);
    }
  }

  return (
    <div className="flex-1">
      <div className="mb-1 text-xs text-gray-600">{label}</div>
      <div className="flex items-center rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
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
        <NumericField
          label="Bid price"
          numericValue={bidPrice}
          placeholder="e.g. 956.20"
          onValueChange={onBidChange}
        />
        <NumericField
          label="Ask price"
          numericValue={askPrice}
          placeholder="e.g. 958.80"
          onValueChange={onAskChange}
        />
        <NumericField
          label="Width"
          numericValue={strikeWidth}
          placeholder="e.g. 1000"
          onValueChange={onStrikeWidthChange}
          suffix="$"
        />
        <NumericField
          label="DTE"
          numericValue={dteOverride}
          placeholder={autoDte.toString()}
          onValueChange={onDteOverrideChange}
          integer
        />
      </div>
      <div className="mt-2 text-xs text-gray-700">
        Enter bid/ask from your brokerage&apos;s option chain for the box at your target expiry
      </div>
    </div>
  );
}
