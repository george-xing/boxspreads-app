"use client";

import type { Brokerage } from "@/lib/types";

interface BrokerageCTAProps {
  selected: Brokerage | null;
  onSelect: (b: Brokerage) => void;
}

const BROKERAGES: { value: Brokerage; label: string; available: boolean }[] = [
  { value: "ibkr", label: "IBKR", available: true },
  { value: "schwab", label: "Schwab", available: false },
  { value: "fidelity", label: "Fidelity", available: false },
];

export function BrokerageCTA({ selected, onSelect }: BrokerageCTAProps) {
  return (
    <div>
      <div className="mb-1 text-sm font-bold text-gray-900">Enter this order at your brokerage</div>
      <div className="mb-3 text-xs font-medium text-gray-500">Step-by-step guide with your exact order values</div>
      <div className="flex flex-col md:flex-row gap-2">
        {BROKERAGES.map(({ value, label, available }) => (
          <button
            key={value}
            onClick={() => available && onSelect(value)}
            disabled={!available}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
              selected === value
                ? "border-green-500 bg-green-50 text-gray-900"
                : available
                  ? "border-gray-300 bg-white text-gray-900 hover:border-green-600"
                  : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
            }`}
          >
            {label}
            {available ? (
              <span className="ml-2 text-gray-400">→</span>
            ) : (
              <span className="ml-2 text-xs font-normal text-gray-400">soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
