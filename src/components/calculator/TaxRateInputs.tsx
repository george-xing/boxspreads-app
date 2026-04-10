"use client";

import { useState } from "react";

interface TaxRateInputsProps {
  federalRate: number;
  stateRate: number;
  onFederalChange: (rate: number) => void;
  onStateChange: (rate: number) => void;
}

function TaxField({
  label,
  rate,
  onChange,
}: {
  label: string;
  rate: number;
  onChange: (rate: number) => void;
}) {
  const displayValue = Math.round(rate * 10000) / 100;
  const [localValue, setLocalValue] = useState(displayValue.toString());
  const [focused, setFocused] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalValue(e.target.value);
    const val = parseFloat(e.target.value);
    if (Number.isFinite(val)) {
      onChange(val / 100);
    }
  }

  function handleBlur() {
    setFocused(false);
    const val = parseFloat(localValue);
    if (Number.isFinite(val)) {
      setLocalValue((Math.round(val * 100) / 100).toString());
    } else {
      setLocalValue(displayValue.toString());
    }
  }

  const shown = focused ? localValue : displayValue.toString();

  return (
    <label className="flex items-center gap-1">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        onChange={handleChange}
        onFocus={() => { setFocused(true); setLocalValue(displayValue.toString()); }}
        onBlur={handleBlur}
        className="w-12 rounded border border-gray-300 bg-white px-1.5 py-1 text-center text-xs text-gray-700 outline-none focus:border-green-500"
      />
      <span>%</span>
    </label>
  );
}

export function TaxRateInputs({
  federalRate,
  stateRate,
  onFederalChange,
  onStateChange,
}: TaxRateInputsProps) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-gray-600">
      <span>Tax rates:</span>
      <TaxField label="Federal" rate={federalRate} onChange={onFederalChange} />
      <TaxField label="State" rate={stateRate} onChange={onStateChange} />
    </div>
  );
}
