"use client";

import { useEffect, useRef } from "react";
import { formatPct } from "@/lib/format";

interface ExpirationRow {
  date: string;
  label: string;
  dte: number;
  boxRate: number;
}

interface ExpirationTableProps {
  rows: ExpirationRow[];
  selectedExpiry: string;
  onSelect: (expiry: string) => void;
}

export type { ExpirationRow };

export function ExpirationTable({ rows, selectedExpiry, onSelect }: ExpirationTableProps) {
  const selectedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedExpiry]);

  return (
    <div className="max-h-[180px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            <th className="px-4 py-2">Expiration</th>
            <th className="px-3 py-2 text-right">DTE</th>
            <th className="px-3 py-2 text-right">Est. Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = row.date === selectedExpiry;
            return (
              <tr
                key={row.date}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onSelect(row.date)}
                className={`cursor-pointer border-l-2 transition-colors ${
                  isSelected
                    ? "border-l-green-500 bg-green-50 text-gray-900"
                    : "border-l-transparent text-gray-700 hover:bg-gray-50"
                }`}
              >
                <td className={`px-4 py-1.5 ${isSelected ? "font-semibold" : ""}`}>{row.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-400">{row.dte}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${isSelected ? "text-green-600 font-semibold" : ""}`}>
                  {formatPct(row.boxRate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
