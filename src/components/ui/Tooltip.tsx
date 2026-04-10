"use client";

import { useState } from "react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 cursor-help border-b border-dotted border-gray-400 text-xs text-gray-400"
        aria-label="More info"
      >
        {children ?? "ⓘ"}
      </span>
      {open && (
        <span className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-lg">
          {content}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-200" />
        </span>
      )}
    </span>
  );
}
