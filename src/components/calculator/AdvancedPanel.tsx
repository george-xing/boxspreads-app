"use client";

import { useState } from "react";

interface AdvancedPanelProps {
  bidPrice: number | null;
  askPrice: number | null;
  strikeWidth: number | null;
  federalTaxRate: number;
  stateTaxRate: number;
  spreadBps: number;
  onBidChange: (v: number | null) => void;
  onAskChange: (v: number | null) => void;
  onStrikeWidthChange: (v: number | null) => void;
  onFederalTaxChange: (v: number) => void;
  onStateTaxChange: (v: number) => void;
  onSpreadBpsChange: (v: number) => void;
}

function NumericField({
  label,
  hint,
  value,
  onChange,
  suffix,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-gray-600">{label}</div>
      <div className="flex items-center rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none"
        />
        {suffix && <span className="ml-1 text-xs text-gray-500">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-700">{hint}</div>}
    </div>
  );
}

export function AdvancedPanel(props: AdvancedPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <div>
          <span className="text-sm font-medium text-gray-300">
            Advanced mode
          </span>
          <span className="ml-2 text-xs text-gray-600">
            Use actual market quotes &amp; custom tax rate
          </span>
        </div>
        <div
          className={`h-5 w-9 rounded-full transition-colors ${open ? "bg-green-700" : "bg-gray-600"}`}
        >
          <div
            className={`h-4 w-4 translate-y-0.5 rounded-full transition-transform ${
              open
                ? "translate-x-4.5 bg-white"
                : "translate-x-0.5 bg-gray-400"
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-gray-700 pt-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
              Option chain quote (override Treasury model)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumericField
                label="Bid price"
                value={props.bidPrice?.toString() ?? ""}
                onChange={(v) =>
                  props.onBidChange(v ? parseFloat(v) || null : null)
                }
              />
              <NumericField
                label="Ask price"
                value={props.askPrice?.toString() ?? ""}
                onChange={(v) =>
                  props.onAskChange(v ? parseFloat(v) || null : null)
                }
              />
              <NumericField
                label="Spread width"
                value={props.strikeWidth?.toString() ?? ""}
                onChange={(v) =>
                  props.onStrikeWidthChange(v ? parseFloat(v) || null : null)
                }
                suffix="$"
              />
            </div>
            <div className="mt-1 text-xs text-gray-700">
              Enter bid/ask from your brokerage&apos;s SPX option chain for the
              box spread at your target expiry
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
              Your marginal tax rate
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumericField
                label="Federal"
                value={(props.federalTaxRate * 100).toString()}
                onChange={(v) =>
                  props.onFederalTaxChange((parseFloat(v) || 0) / 100)
                }
                suffix="%"
              />
              <NumericField
                label="State"
                value={(props.stateTaxRate * 100).toString()}
                onChange={(v) =>
                  props.onStateTaxChange((parseFloat(v) || 0) / 100)
                }
                suffix="%"
              />
            </div>
          </div>

          <NumericField
            label="Rate spread over Treasury"
            hint="Default 30bps. Lower = more aggressive limit, slower fill."
            value={props.spreadBps.toString()}
            onChange={(v) => props.onSpreadBpsChange(parseInt(v) || 30)}
            suffix="bps"
          />
        </div>
      )}
    </div>
  );
}
