"use client";

interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color?: "green" | "blue";
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  color = "green",
}: ButtonGroupProps<T>) {
  const activeClass =
    color === "green"
      ? "border-green-600 bg-green-900/30 text-green-400 font-semibold"
      : "border-blue-600 bg-blue-900/30 text-blue-400 font-semibold";

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
            value === opt.value
              ? activeClass
              : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
