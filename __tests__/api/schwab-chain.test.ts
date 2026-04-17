import { describe, it, expect, vi, beforeEach } from "vitest";
import fixture from "../fixtures/spx-chain.json";

const mockGetClient = vi.fn();
vi.mock("@/lib/schwab/client", () => ({
  getSchwabClientForRequest: (req: Request) => mockGetClient(req),
}));

const mockFetchSnap = vi.fn();
vi.mock("@/lib/schwab/chain", () => ({
  fetchChainSnapshot: (...args: unknown[]) => mockFetchSnap(...args),
}));

import { GET } from "@/app/api/schwab/chain/route";

function url(q: string): Request {
  return new Request(`http://x/api/schwab/chain?${q}`);
}

describe("GET /api/schwab/chain", () => {
  beforeEach(() => {
    mockGetClient.mockReset();
    mockFetchSnap.mockReset();
  });

  it("returns 401 when not connected", async () => {
    mockGetClient.mockResolvedValueOnce(null);
    const res = await GET(url("expiration=2027-02-19&target=500000"));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing params", async () => {
    mockGetClient.mockResolvedValueOnce({});
    const res = await GET(url("expiration=2027-02-19"));
    expect(res.status).toBe(400);
  });

  it("returns candidates from compute", async () => {
    mockGetClient.mockResolvedValueOnce({});
    mockFetchSnap.mockResolvedValueOnce(fixture);
    const res = await GET(url("expiration=2027-02-19&target=500000"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates.length).toBeGreaterThan(0);
    expect(body.selected).not.toBeNull();
  });

  it("returns 503 on chain fetch failure", async () => {
    mockGetClient.mockResolvedValueOnce({});
    mockFetchSnap.mockRejectedValueOnce(new Error("schwab down"));
    const res = await GET(url("expiration=2027-02-19&target=500000"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("chain_unavailable");
  });
});
