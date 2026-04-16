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

// ETM stub. `refresh` is what client.ts calls to force an initial refresh;
// `getAccessToken` is what downstream callers will hit via the SchwabSession.
const { mockRefresh, mockGetAccessToken, FakeETM } = vi.hoisted(() => {
  const mockRefresh = vi.fn();
  const mockGetAccessToken = vi.fn();
  class FakeETM {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public opts: any) {}
    refresh(...args: unknown[]) { return mockRefresh(...args); }
    getAccessToken() { return mockGetAccessToken(); }
  }
  return { mockRefresh, mockGetAccessToken, FakeETM };
});
vi.mock("@sudowealth/schwab-api", () => ({
  EnhancedTokenManager: FakeETM,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }) },
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
    mockRefresh.mockReset();
    mockGetAccessToken.mockReset();
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

  it("returns a SchwabSession when connection exists and refresh succeeds", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "r1",
      connected_at: "2026-04-15T00:00:00Z",
      last_refreshed_at: null,
    });
    mockRefresh.mockResolvedValueOnce({ accessToken: "a1", refreshToken: "r1", expiresAt: Date.now() + 1800_000 });
    mockGetAccessToken.mockResolvedValueOnce("a1");

    const r = makeRequest("boxspreads_session=sess-1.mac");
    const session = await getSchwabClientForRequest(r);

    expect(session).not.toBeNull();
    expect(mockRefresh).toHaveBeenCalledWith("r1", { force: true });
    const token = await session!.getAccessToken();
    expect(token).toBe("a1");
  });

  it("deletes the row and returns null on invalid_grant from refresh", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "expired",
      connected_at: "2026-04-01T00:00:00Z",
      last_refreshed_at: null,
    });
    mockRefresh.mockRejectedValueOnce(new Error("invalid_grant"));

    const r = makeRequest("boxspreads_session=sess-1.mac");
    expect(await getSchwabClientForRequest(r)).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith("sess-1");
  });

  it("rethrows non-auth errors (so /status returns 503, not silent disconnect)", async () => {
    (verifySessionCookie as ReturnType<typeof vi.fn>).mockReturnValueOnce("sess-1");
    mockFind.mockResolvedValueOnce({
      session_id: "sess-1",
      refresh_token: "r1",
      connected_at: "2026-04-15T00:00:00Z",
      last_refreshed_at: null,
    });
    mockRefresh.mockRejectedValueOnce(new Error("network down"));

    const r = makeRequest("boxspreads_session=sess-1.mac");
    await expect(getSchwabClientForRequest(r)).rejects.toThrow(/network down/);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
