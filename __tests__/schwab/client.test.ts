import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "boxspreads_session",
  verifySessionCookie: vi.fn(),
  getSessionSecret: vi.fn(() => "test-secret-at-least-32-chars-long-abcdef"),
}));

const { mockFind, mockDelete } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockDelete: vi.fn(),
}));
vi.mock("@/lib/schwab/connections", () => ({
  findConnection: mockFind,
  deleteConnection: mockDelete,
}));

const mockMakeClient = vi.hoisted(() => vi.fn());
vi.mock("@sudowealth/schwab-api", () => ({
  createApiClient: (...args: unknown[]) => mockMakeClient(...args),
}));

import { getSchwabClientForRequest } from "@/lib/schwab/client";
import { verifySessionCookie } from "@/lib/session";

function makeRequest(cookieHeader: string | null): Request {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new Request("http://localhost/x", { headers });
}

describe("getSchwabClientForRequest", () => {
  beforeEach(() => {
    mockFind.mockReset();
    mockDelete.mockReset();
    mockMakeClient.mockReset();
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReset();
    process.env.SCHWAB_APP_KEY = "test-app-key";
    process.env.SCHWAB_APP_SECRET = "test-app-secret";
  });

  it("returns null when no cookie", async () => {
    expect(await getSchwabClientForRequest(makeRequest(null))).toBeNull();
  });

  it("returns null when cookie invalid", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const r = makeRequest("boxspreads_session=bad.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
  });

  it("returns null when no connection row", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce(null);
    const r = makeRequest("boxspreads_session=sess-1.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
  });

  it("builds a client when connection exists", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "r1",
      connected_at: "2026-04-15T00:00:00Z",
      last_refreshed_at: null,
    });
    const fakeClient = { marketData: { options: { getOptionChain: vi.fn() } } };
    mockMakeClient.mockReturnValueOnce(fakeClient);
    const r = makeRequest("boxspreads_session=sess-1.mac");
    const client = await getSchwabClientForRequest(r);
    expect(client).toBe(fakeClient);
    expect(mockMakeClient).toHaveBeenCalled();
  });

  it("deletes the row and returns null on invalid_grant from refresh", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "expired",
      connected_at: "2026-04-01T00:00:00Z",
      last_refreshed_at: null,
    });
    mockMakeClient.mockImplementationOnce(() => {
      throw new Error("invalid_grant");
    });
    const r = makeRequest("boxspreads_session=sess-1.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith("sess-1");
  });
});
