"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { TENORS } from "@/lib/constants";
import type { Tenor } from "@/lib/types";

interface DurationPickerProps {
  value: Tenor;
  onChange: (tenor: Tenor) => void;
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-gray-500">
        For how long?
      </label>
      <ButtonGroup options={TENORS} value={value} onChange={onChange} />
    </div>
  );
}
