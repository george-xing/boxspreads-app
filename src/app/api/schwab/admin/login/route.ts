import { NextResponse } from "next/server";
import { upsertConnection } from "@/lib/schwab/connections";
import {
  SESSION_COOKIE_NAME,
  generateSessionId,
  signSessionId,
  getSessionSecret,
} from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: string };

  const expected = process.env.ADMIN_KEY;
  if (!expected || body.key !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 500 },
    );
  }

  const sessionId = generateSessionId();
  await upsertConnection(sessionId, refreshToken);

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
