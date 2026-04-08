"use client";

export type CalcTab = "estimate" | "from-quotes";

interface TabSwitcherProps {
  value: CalcTab;
  onChange: (tab: CalcTab) => void;
}

const TABS: { value: CalcTab; label: string }[] = [
  { value: "estimate", label: "Estimate" },
  { value: "from-quotes", label: "From Quotes" },
];

export function TabSwitcher({ value, onChange }: TabSwitcherProps) {
  return (
    <div className="flex border-b-2 border-gray-800">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-5 py-2.5 text-sm transition-colors ${
            value === tab.value
              ? "border-b-2 border-green-500 -mb-[2px] font-semibold text-green-400"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
