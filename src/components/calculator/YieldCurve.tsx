"use client";

import type { Expiration, TreasuryRates } from "@/lib/types";
import { interpolateTreasuryYield } from "@/lib/calc";
import { formatPct } from "@/lib/format";

interface YieldCurveProps {
  expirations: Expiration[];
  selectedExpiry: string;
  onSelect: (expiry: string) => void;
  treasuryRates: TreasuryRates;
  boxRates: Record<string, number>; // expiry date → estimated box rate
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
  // "Dec 19, 2027" → "Dec '27"
  const parts = label.split(", ");
  if (parts.length !== 2) return label;
  const month = parts[0].split(" ")[0];
  const year = parts[1].slice(2);
  return `${month} '${year}`;
}

export function YieldCurve({
  expirations,
  selectedExpiry,
  onSelect,
  treasuryRates,
  boxRates,
}: YieldCurveProps) {
  if (expirations.length === 0) return null;

  // Build data points
  const points = expirations.map((exp) => ({
    ...exp,
    boxRate: boxRates[exp.date] ?? 0,
    treasuryRate: interpolateTreasuryYield(exp.dte, treasuryRates),
  }));

  // Y-axis scale from all rates
  const allRates = points.flatMap((p) => [p.boxRate, p.treasuryRate]).filter((r) => r > 0);
  const minRate = Math.min(...allRates);
  const maxRate = Math.max(...allRates);
  const range = maxRate - minRate || 0.005;
  const padded = range * 0.2;

  const yMin = minRate - padded;
  const yMax = maxRate + padded;

  function yForRate(rate: number): number {
    return PAD_T + PLOT_H * (1 - (rate - yMin) / (yMax - yMin));
  }

  // X-axis: proportional to DTE
  const minDte = points[0].dte;
  const maxDte = points[points.length - 1].dte;
  const dteRange = maxDte - minDte || 1;

  function xForDte(dte: number): number {
    return PAD_L + ((dte - minDte) / dteRange) * PLOT_W;
  }

  // Polylines
  const boxPolyline = points.map((p) => `${xForDte(p.dte)},${yForRate(p.boxRate)}`).join(" ");
  const treasuryPolyline = points.map((p) => `${xForDte(p.dte)},${yForRate(p.treasuryRate)}`).join(" ");

  // Y-axis tick values
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  // X-axis labels: show ~5-6 evenly spaced labels
  const labelStep = Math.max(1, Math.floor(points.length / 5));
  const labelIndices = new Set<number>();
  for (let i = 0; i < points.length; i += labelStep) labelIndices.add(i);
  labelIndices.add(points.length - 1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-500">
          Rate by expiration
        </span>
        <span className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-green-400" /> Box spread
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 border-t border-dashed border-gray-500" /> Treasury
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={CHART_H - PAD_B} stroke="#1f2937" />
        <line x1={PAD_L} y1={CHART_H - PAD_B} x2={CHART_W - PAD_R} y2={CHART_H - PAD_B} stroke="#1f2937" />

        {/* Y-axis ticks */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L}
              y1={yForRate(tick)}
              x2={CHART_W - PAD_R}
              y2={yForRate(tick)}
              stroke="#1f2937"
              strokeWidth={0.5}
              strokeDasharray="4"
            />
            <text
              x={PAD_L - 4}
              y={yForRate(tick) + 3}
              fill="#4b5563"
              fontSize={7}
              textAnchor="end"
            >
              {formatPct(tick)}
            </text>
          </g>
        ))}

        {/* Treasury line (dashed) */}
        <polyline
          points={treasuryPolyline}
          fill="none"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {/* Box spread line (solid) */}
        <polyline points={boxPolyline} fill="none" stroke="#4ade80" strokeWidth={2} />

        {/* Data points */}
        {points.map((p) => {
          const isSelected = p.date === selectedExpiry;
          const cx = xForDte(p.dte);
          const cy = yForRate(p.boxRate);

          return (
            <g
              key={p.date}
              onClick={() => onSelect(p.date)}
              className="cursor-pointer"
            >
              {isSelected && (
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={CHART_H - PAD_B}
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="3"
                />
              )}
              {/* Hit target (invisible, larger) */}
              <circle cx={cx} cy={cy} r={12} fill="transparent" />
              <circle
                cx={cx}
                cy={cy}
                r={isSelected ? 5 : 3}
                fill="#4ade80"
                stroke={isSelected ? "#0f1117" : "none"}
                strokeWidth={isSelected ? 2 : 0}
              />
              {isSelected && (
                <text
                  x={cx}
                  y={cy - 9}
                  fill="#22c55e"
                  fontSize={8}
                  textAnchor="middle"
                  fontWeight={700}
                >
                  {formatPct(p.boxRate)}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, i) => {
          if (!labelIndices.has(i)) return null;
          const isSelected = p.date === selectedExpiry;
          return (
            <text
              key={`label-${p.date}`}
              x={xForDte(p.dte)}
              y={CHART_H - 6}
              fill={isSelected ? "#22c55e" : "#6b7280"}
              fontSize={isSelected ? 8 : 7}
              textAnchor="middle"
              fontWeight={isSelected ? 600 : 400}
            >
              {shortLabel(p.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
