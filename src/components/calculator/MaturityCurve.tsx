"use client";

import { TENORS } from "@/lib/constants";
import type { Tenor } from "@/lib/types";

interface CurvePoint {
  tenor: Tenor;
  rate: number;
}

interface MaturityCurveProps {
  data: CurvePoint[];
  selectedTenor: Tenor;
}

const CHART_W = 400;
const CHART_H = 100;
const PAD_L = 44;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 22;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function MaturityCurve({ data, selectedTenor }: MaturityCurveProps) {
  if (data.length === 0) return null;

  const rates = data.map((d) => d.rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const range = maxRate - minRate || 0.005;
  const padded = range * 0.15;

  function yForRate(rate: number): number {
    return PAD_T + PLOT_H * (1 - (rate - (minRate - padded)) / (range + padded * 2));
  }

  function xForIndex(i: number): number {
    return PAD_L + (i / (data.length - 1)) * PLOT_W;
  }

  const points = data.map((d, i) => ({ x: xForIndex(i), y: yForRate(d.rate), ...d }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  const yMid = (minRate + maxRate) / 2;
  const yTop = maxRate + padded * 0.5;
  const yBot = minRate - padded * 0.5;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
        Rate by maturity
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: 90 }}>
        {/* Grid */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={CHART_H - PAD_B} stroke="#1f2937" />
        <line x1={PAD_L} y1={CHART_H - PAD_B} x2={CHART_W - PAD_R} y2={CHART_H - PAD_B} stroke="#1f2937" />
        <line x1={PAD_L} y1={yForRate(yMid)} x2={CHART_W - PAD_R} y2={yForRate(yMid)} stroke="#1f2937" strokeWidth={0.5} strokeDasharray="4" />

        {/* Y labels */}
        <text x={PAD_L - 4} y={yForRate(yBot) + 3} fill="#4b5563" fontSize={7} textAnchor="end">{formatPct(yBot)}</text>
        <text x={PAD_L - 4} y={yForRate(yMid) + 3} fill="#4b5563" fontSize={7} textAnchor="end">{formatPct(yMid)}</text>
        <text x={PAD_L - 4} y={yForRate(yTop) + 3} fill="#4b5563" fontSize={7} textAnchor="end">{formatPct(yTop)}</text>

        {/* Curve line */}
        <polyline points={polyline} fill="none" stroke="#4ade80" strokeWidth={2} />

        {/* Data points and labels */}
        {points.map((p) => {
          const isSelected = p.tenor === selectedTenor;
          const tenorLabel = TENORS.find((t) => t.value === p.tenor)?.label ?? p.tenor;
          return (
            <g key={p.tenor}>
              {isSelected && (
                <line x1={p.x} y1={p.y} x2={p.x} y2={CHART_H - PAD_B} stroke="#22c55e" strokeWidth={1} strokeDasharray="3" />
              )}
              <circle cx={p.x} cy={p.y} r={isSelected ? 4.5 : 2.5} fill="#4ade80" stroke={isSelected ? "#0f1117" : "none"} strokeWidth={isSelected ? 2 : 0} />
              <text x={p.x} y={p.y - 7} fill={isSelected ? "#22c55e" : "#4ade80"} fontSize={isSelected ? 8 : 7} textAnchor="middle" fontWeight={isSelected ? 700 : 500}>
                {formatPct(p.rate)}
              </text>
              <text x={p.x} y={CHART_H - 4} fill={isSelected ? "#22c55e" : "#6b7280"} fontSize={isSelected ? 8 : 7} textAnchor="middle" fontWeight={isSelected ? 600 : 400}>
                {tenorLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
