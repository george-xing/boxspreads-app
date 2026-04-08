"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { BROKERAGES } from "@/lib/constants";
import type { Brokerage } from "@/lib/types";

interface BrokeragePickerProps {
  value: Brokerage;
  onChange: (brokerage: Brokerage) => void;
}

export function BrokeragePicker({ value, onChange }: BrokeragePickerProps) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-gray-500">
        Your brokerage
      </label>
      <ButtonGroup
        options={BROKERAGES}
        value={value}
        onChange={onChange}
        color="blue"
      />
    </div>
  );
}
