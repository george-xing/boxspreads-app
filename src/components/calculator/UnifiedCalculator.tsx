"use client";

import { useState, useEffect } from "react";
import { SPX_MULTIPLIER } from "@/lib/constants";
import { snapStrikeWidth } from "@/lib/calc";

interface UnifiedCalculatorProps {
  strikeWidth: number;
  onStrikeWidthChange: (w: number) => void;
  midPrice: number;
  onMidPriceChange: (p: number) => void;
  isUserOverride: boolean;
  onResetEstimate: () => void;
  contracts: number;
  onContractsChange: (q: number) => void;
}

function NumericInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  estimated,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  estimated?: boolean;
  min?: number;
}) {
  const [localValue, setLocalValue] = useState(Number.isFinite(value) ? String(value) : "");

  // Sync from parent when value changes externally (e.g. expiration change resets mid price)
  useEffect(() => {
    setLocalValue(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-sm text-gray-400 whitespace-nowrap">
        {label}
        {estimated && (
          <span className="ml-1.5 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
            est.
          </span>
        )}
      </label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
        <input
          type="number"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          onBlur={() => {
            // Always sync back to parent value on blur — handles rejected inputs and empty fields
            setLocalValue(Number.isFinite(value) ? String(value) : "");
          }}
          step={step ?? 0.01}
          min={min}
          className="w-28 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-right text-sm text-white tabular-nums focus:border-green-500 focus:outline-none"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

export function UnifiedCalculator({
  strikeWidth,
  onStrikeWidthChange,
  midPrice,
  onMidPriceChange,
  isUserOverride,
  onResetEstimate,
  contracts,
  onContractsChange,
}: UnifiedCalculatorProps) {
  const snappedWidth = snapStrikeWidth(strikeWidth);
  const notional = snappedWidth * SPX_MULTIPLIER * contracts;

  return (
    <div className="space-y-2">
      {isUserOverride && (
        <div className="text-right">
          <button
            onClick={onResetEstimate}
            className="text-[11px] text-gray-500 underline hover:text-gray-300"
          >
            Reset to estimate
          </button>
        </div>
      )}
      <NumericInput
        label="Strike width"
        value={strikeWidth}
        onChange={onStrikeWidthChange}
        prefix="$"
        step={5}
        min={5}
      />
      <NumericInput
        label="Contracts"
        value={contracts}
        onChange={onContractsChange}
        step={1}
        min={1}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Notional</span>
        <span className="text-sm tabular-nums text-gray-300">
          ${notional.toLocaleString()}
          {snappedWidth !== strikeWidth && (
            <span className="ml-1 text-[10px] text-gray-500">(width snapped to ${snappedWidth})</span>
          )}
        </span>
      </div>

      <div className="border-t border-gray-700 my-1" />

      <NumericInput
        label="Mid price"
        value={midPrice}
        onChange={onMidPriceChange}
        prefix="$"
        step={0.05}
        estimated={!isUserOverride}
      />
    </div>
  );
}
