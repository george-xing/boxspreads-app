import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ConnectStatus } from "@/components/calculator/ConnectStatus";

describe("ConnectStatus", () => {
  it("renders Sign-in link to /admin when disconnected", () => {
    // Phase 1: there's no public Schwab OAuth flow yet. The nav surfaces
    // the password-form admin login (the only entry that actually works)
    // instead of a confusing disabled "coming soon" button.
    const { getByRole } = render(<ConnectStatus connected={false} />);
    const link = getByRole("link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/admin");
    expect(link.textContent).toMatch(/Sign in/i);
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
