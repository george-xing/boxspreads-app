"use client";

interface AmountInputProps {
  value: number;
  onChange: (amount: number) => void;
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    onChange(Number(raw) || 0);
  }

  const formatted = value > 0 ? value.toLocaleString("en-US") : "";

  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-gray-500">
        How much do you want to borrow?
      </label>
      <div className="flex items-center rounded-xl border border-gray-600 bg-gray-800 px-4 py-3.5">
        <span className="mr-2 text-lg text-gray-500">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatted}
          onChange={handleChange}
          placeholder="250,000"
          className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-gray-600"
        />
      </div>
    </div>
  );
}
