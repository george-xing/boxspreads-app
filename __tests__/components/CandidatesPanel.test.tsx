import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CandidatesPanel } from "@/components/calculator/CandidatesPanel";
import type { Candidate } from "@/lib/schwab/types";

const baseLegs = [
  { action: "BUY" as const, type: "CALL" as const, strike: 5500, symbol: "SPX 270219C05500000", bid: 300.1, ask: 300.8, openInterest: 1240 },
  { action: "SELL" as const, type: "CALL" as const, strike: 6500, symbol: "SPX 270219C06500000", bid:   5.5, ask:   5.9, openInterest: 1240 },
  { action: "SELL" as const, type: "PUT"  as const, strike: 5500, symbol: "SPX 270219P05500000", bid:  44.0, ask:  44.6, openInterest: 1250 },
  { action: "BUY" as const, type: "PUT"  as const, strike: 6500, symbol: "SPX 270219P06500000", bid: 997.8, ask: 999.1, openInterest: 1300 },
];

const cand: Candidate = {
  lowerStrike: 5500, upperStrike: 6500, strikeWidth: 1000, contracts: 1,
  boxCredit: 948.5, actualBorrow: 94850, rate: 0.0439,
  minOI: 1240, spreadWidth: 3.4, score: 0.042, muted: false, legs: baseLegs,
};

describe("CandidatesPanel", () => {
  it("renders candidates with selected highlighted", () => {
    const { getByText } = render(
      <CandidatesPanel
        state="connected"
        candidates={[cand]}
        selected={cand}
        onSelect={() => {}}
      />,
    );
    expect(getByText("5500 / 6500")).toBeTruthy();
  });

  it("renders compact empty-state note when state=disconnected", () => {
    // The disconnected state is now a small text-only note (no CTA button) —
    // the top-of-page ConnectBanner already carries the Sign-in action, so
    // a third "Connect Schwab" button on the same screen was visual noise.
    const { getByText, queryByRole } = render(
      <CandidatesPanel state="disconnected" candidates={[]} selected={null} onSelect={() => {}} />,
    );
    expect(getByText(/Strike candidates/i)).toBeTruthy();
    expect(queryByRole("button")).toBeNull();
  });

  it("renders thin-liquidity reason", () => {
    const muted = { ...cand, muted: true };
    const { getByText } = render(
      <CandidatesPanel state="connected" candidates={[muted]} selected={muted} onSelect={() => {}} reason="thin_liquidity" />,
    );
    expect(getByText(/thin/i)).toBeTruthy();
  });
});
