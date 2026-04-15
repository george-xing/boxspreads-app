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
});
