"use client";

interface TaxRateInputsProps {
  federalRate: number;
  stateRate: number;
  onFederalChange: (rate: number) => void;
  onStateChange: (rate: number) => void;
}

export function TaxRateInputs({
  federalRate,
  stateRate,
  onFederalChange,
  onStateChange,
}: TaxRateInputsProps) {
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (rate: number) => void
  ) {
    const val = parseFloat(e.target.value);
    setter(Number.isFinite(val) ? val / 100 : 0);
  }

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span>Tax rates:</span>
      <label className="flex items-center gap-1">
        <span>Federal</span>
        <input
          type="text"
          inputMode="decimal"
          value={(federalRate * 100).toString()}
          onChange={(e) => handleChange(e, onFederalChange)}
          className="w-12 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-center text-xs text-gray-300 outline-none focus:border-gray-500"
        />
        <span>%</span>
      </label>
      <label className="flex items-center gap-1">
        <span>State</span>
        <input
          type="text"
          inputMode="decimal"
          value={(stateRate * 100).toString()}
          onChange={(e) => handleChange(e, onStateChange)}
          className="w-12 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-center text-xs text-gray-300 outline-none focus:border-gray-500"
        />
        <span>%</span>
      </label>
    </div>
  );
}
