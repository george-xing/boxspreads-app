import { describe, it, expect, vi } from "vitest";

// /api/schwab/status now uses the cheap hasActiveSession() check (cookie
// + Supabase row) rather than the full client factory. This avoids the
// silent-logout race where two parallel status callers would both force
// a Schwab token refresh and one would lose to the other's rotation.
const mockHasActive = vi.fn();
vi.mock("@/lib/schwab/client", () => ({
  hasActiveSession: (req: Request) => mockHasActive(req),
}));

import { GET } from "@/app/api/schwab/status/route";

describe("GET /api/schwab/status", () => {
  it("returns connected: false when session is missing/invalid", async () => {
    mockHasActive.mockResolvedValueOnce(false);
    const res = await GET(new Request("http://x/api/schwab/status"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ connected: false });
  });

  it("returns connected: true when session row exists in Supabase", async () => {
    mockHasActive.mockResolvedValueOnce(true);
    const res = await GET(new Request("http://x/api/schwab/status"));
    const body = await res.json();
    expect(body).toEqual({ connected: true });
  });

  it("returns 503 on operational errors (Supabase down, env broken) — does not flatten to disconnected", async () => {
    mockHasActive.mockRejectedValueOnce(new Error("supabase unreachable"));
    const res = await GET(new Request("http://x/api/schwab/status"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "status_unavailable" });
  });
});
