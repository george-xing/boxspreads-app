import { NextResponse } from "next/server";
import { upsertConnection, deleteOtherConnections } from "@/lib/schwab/connections";
import {
  SESSION_COOKIE_NAME,
  generateSessionId,
  signSessionId,
  getSessionSecret,
} from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: string };

  // Server-side prerequisites are an admin-only configuration concern;
  // surface them as the same 403 an attacker would see for a wrong key.
  // Distinguishing "right key, server broken" from "wrong key" lets an
  // attacker confirm they have a valid ADMIN_KEY by probing — even when
  // SCHWAB_REFRESH_TOKEN happens to be unset (e.g. mid-deploy). One
  // generic 403 closes that oracle.
  const expected = process.env.ADMIN_KEY;
  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN;
  const keyOk = Boolean(expected && body.key === expected);
  const serverOk = Boolean(refreshToken);
  if (!keyOk || !serverOk) {
    if (keyOk && !serverOk) {
      // Log server-side so the operator sees the misconfig in the deploy
      // logs even though the client gets a generic 403.
      console.error(
        "admin/login: SCHWAB_REFRESH_TOKEN missing — login refused",
      );
    }
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // serverOk above guarantees refreshToken is non-empty; assert for TS.
  const validRefreshToken = refreshToken!;

  const sessionId = generateSessionId();
  // Write the new row first, then reap stale rows from prior admin logins.
  // Ordering matters: if the reap succeeded but the upsert failed we'd be
  // left with zero connections, forcing a re-auth even though the user did
  // nothing wrong.
  await upsertConnection(sessionId, validRefreshToken);
  await deleteOtherConnections(sessionId);

  const signed = signSessionId(sessionId, getSessionSecret());
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=604800",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");

  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": cookie } },
  );
}
