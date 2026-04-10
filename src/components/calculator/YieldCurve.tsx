"use client";

import type { Expiration } from "@/lib/types";
import { formatPct } from "@/lib/format";

interface YieldCurveProps {
  expirations: Expiration[];
  selectedExpiry: string;
  onSelect: (expiry: string) => void;
  boxRates: Record<string, number>;
}

const CHART_W = 500;
const CHART_H = 240;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 28;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function shortLabel(label: string): string {
  const parts = label.split(", ");
  if (parts.length !== 2) return label;
  const month = parts[0].split(" ")[0];
  const year = parts[1].slice(2);
  return `${month} '${year}`;
}

export function YieldCurve({ expirations, selectedExpiry, onSelect, boxRates }: YieldCurveProps) {
  if (expirations.length === 0) return null;

  const points = expirations.map((exp) => ({
    ...exp,
    boxRate: boxRates[exp.date] ?? 0,
  }));

  const rates = points.map((p) => p.boxRate).filter((r) => r > 0);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const range = maxRate - minRate || 0.005;
  const padded = range * 0.1;
  const yMin = minRate - padded;
  const yMax = maxRate + padded;

  function yForRate(rate: number): number {
    return PAD_T + PLOT_H * (1 - (rate - yMin) / (yMax - yMin));
  }

  const minDte = points[0].dte;
  const maxDte = points[points.length - 1].dte;
  const dteRange = maxDte - minDte || 1;

  function xForDte(dte: number): number {
    return PAD_L + ((dte - minDte) / dteRange) * PLOT_W;
  }

  const polyline = points.map((p) => `${xForDte(p.dte)},${yForRate(p.boxRate)}`).join(" ");
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  const labelStep = Math.max(1, Math.floor(points.length / 5));
  const labelIndices = new Set<number>();
  for (let i = 0; i < points.length; i += labelStep) labelIndices.add(i);
  labelIndices.add(points.length - 1);

  return (
    <div>
      <div className="mb-2">
        <span className="text-xs uppercase tracking-widest text-gray-400">
          Estimated borrowing rate by expiration
        </span>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={CHART_H - PAD_B} stroke="#e5e7eb" />
        <line x1={PAD_L} y1={CHART_H - PAD_B} x2={CHART_W - PAD_R} y2={CHART_H - PAD_B} stroke="#e5e7eb" />

        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} y1={yForRate(tick)} x2={CHART_W - PAD_R} y2={yForRate(tick)} stroke="#f3f4f6" strokeWidth={0.5} />
            <text x={PAD_L - 4} y={yForRate(tick) + 3} fill="#9ca3af" fontSize={7} textAnchor="end">{formatPct(tick)}</text>
          </g>
        ))}

        <polyline points={polyline} fill="none" stroke="#16a34a" strokeWidth={2} />

        {points.map((p) => {
          const isSelected = p.date === selectedExpiry;
          const cx = xForDte(p.dte);
          const cy = yForRate(p.boxRate);
          return (
            <g key={p.date} onClick={() => onSelect(p.date)} className="cursor-pointer">
              {isSelected && (
                <line x1={cx} y1={cy} x2={cx} y2={CHART_H - PAD_B} stroke="#16a34a" strokeWidth={1} strokeDasharray="3" />
              )}
              <circle cx={cx} cy={cy} r={12} fill="transparent" />
              <circle cx={cx} cy={cy} r={isSelected ? 5 : 3} fill="#16a34a" stroke={isSelected ? "white" : "none"} strokeWidth={isSelected ? 2 : 0} />
              {isSelected && (
                <text x={cx} y={cy - 9} fill="#16a34a" fontSize={8} textAnchor="middle" fontWeight={700}>{formatPct(p.boxRate)}</text>
              )}
            </g>
          );
        })}

        {points.map((p, i) => {
          if (!labelIndices.has(i)) return null;
          const isSelected = p.date === selectedExpiry;
          return (
            <text key={`label-${p.date}`} x={xForDte(p.dte)} y={CHART_H - 6} fill={isSelected ? "#16a34a" : "#9ca3af"} fontSize={isSelected ? 8 : 7} textAnchor="middle" fontWeight={isSelected ? 600 : 400}>
              {shortLabel(p.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
