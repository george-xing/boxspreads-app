"use client";

import { formatPct } from "@/lib/format";

interface ExpirationRow {
  date: string;
  label: string;
  dte: number;
  boxRate: number;
  treasuryRate: number;
}

interface ExpirationTableProps {
  rows: ExpirationRow[];
  selectedExpiry: string;
  onSelect: (expiry: string) => void;
}

export type { ExpirationRow };

export function ExpirationTable({
  rows,
  selectedExpiry,
  onSelect,
}: ExpirationTableProps) {
  return (
    <div className="max-h-[180px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-800">
          <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-widest text-gray-500">
            <th className="px-4 py-2">Expiration</th>
            <th className="px-3 py-2 text-right">DTE</th>
            <th className="px-3 py-2 text-right">Est. Rate</th>
            <th className="px-3 py-2 text-right">Treasury</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = row.date === selectedExpiry;
            return (
              <tr
                key={row.date}
                onClick={() => onSelect(row.date)}
                className={`cursor-pointer border-l-2 transition-colors ${
                  isSelected
                    ? "border-l-green-500 bg-green-950/20 text-white"
                    : "border-l-transparent text-gray-300 hover:bg-gray-800/50"
                }`}
              >
                <td className={`px-4 py-1.5 ${isSelected ? "font-semibold" : ""}`}>
                  {row.label}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-400">
                  {row.dte}
                </td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${isSelected ? "text-green-400 font-semibold" : ""}`}>
                  {formatPct(row.boxRate)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">
                  {formatPct(row.treasuryRate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
