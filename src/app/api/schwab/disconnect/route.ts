import { NextResponse } from "next/server";
import { deleteConnection } from "@/lib/schwab/connections";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
  getSessionSecret,
} from "@/lib/session";

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const p of header.split(/;\s*/)) {
    const eq = p.indexOf("=");
    if (eq > 0 && p.slice(0, eq) === name) {
      return decodeURIComponent(p.slice(eq + 1));
    }
  }
  return null;
}

export async function POST(req: Request) {
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  const sessionId = cookie ? verifySessionCookie(cookie, getSessionSecret()) : null;
  if (sessionId) {
    await deleteConnection(sessionId);
  }
  const clear = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": clear } });
}
