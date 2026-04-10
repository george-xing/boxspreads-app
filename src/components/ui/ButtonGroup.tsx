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
      ? "border-green-500 bg-green-50 text-green-700 font-semibold"
      : "border-blue-500 bg-blue-50 text-blue-700 font-semibold";

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
            value === opt.value
              ? activeClass
              : "border-gray-300 bg-white text-gray-500 hover:border-gray-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
