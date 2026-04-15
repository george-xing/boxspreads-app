import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ConnectStatus } from "@/components/calculator/ConnectStatus";

describe("ConnectStatus", () => {
  it("renders disabled Connect CTA when disconnected", () => {
    const { getByRole } = render(<ConnectStatus connected={false} />);
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/Connect Schwab/i);
    expect(btn.textContent).toMatch(/coming soon/i);
  });

  it("renders Connected pill with timestamp when connected", () => {
    const { getByText } = render(
      <ConnectStatus
        connected
        asOf="2026-04-15T18:30:00Z"
        underlyingLast={5782.1}
        onRefresh={() => {}}
      />,
    );
    expect(getByText(/Connected/i)).toBeTruthy();
    expect(getByText(/5,782/)).toBeTruthy();
  });
});
