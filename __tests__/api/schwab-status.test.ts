import { describe, it, expect, vi } from "vitest";

const mockGetClient = vi.fn();
vi.mock("@/lib/schwab/client", () => ({
  getSchwabClientForRequest: (req: Request) => mockGetClient(req),
}));

import { GET } from "@/app/api/schwab/status/route";

describe("GET /api/schwab/status", () => {
  it("returns connected: false when no client", async () => {
    mockGetClient.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x/api/schwab/status"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ connected: false });
  });

  it("returns connected: true when client resolved", async () => {
    mockGetClient.mockResolvedValueOnce({});
    const res = await GET(new Request("http://x/api/schwab/status"));
    const body = await res.json();
    expect(body).toEqual({ connected: true });
  });

  it("returns 503 on operational errors (Supabase down, env broken) — does not flatten to disconnected", async () => {
    mockGetClient.mockRejectedValueOnce(new Error("supabase unreachable"));
    const res = await GET(new Request("http://x/api/schwab/status"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "status_unavailable" });
  });
});
