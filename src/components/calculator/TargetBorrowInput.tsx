"use client";

import { useMemo } from "react";

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

function formatDollars(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return `$${n.toLocaleString("en-US")}`;
}

function parseDollars(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits);
}

export function TargetBorrowInput({ value, onChange, disabled }: Props) {
  const display = useMemo(() => formatDollars(value), [value]);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
        How much to borrow?
      </div>
      <input
        type="text"
        inputMode="numeric"
        role="textbox"
        value={display}
        disabled={disabled}
        onChange={(e) => onChange(parseDollars(e.target.value))}
        placeholder="$500,000"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-lg font-semibold tabular-nums text-gray-900 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
