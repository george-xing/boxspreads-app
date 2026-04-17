import { NextResponse } from "next/server";
import { getSchwabClientForRequest } from "@/lib/schwab/client";

export async function GET(req: Request) {
  try {
    const client = await getSchwabClientForRequest(req);
    return NextResponse.json({ connected: client !== null });
  } catch (err) {
    // A thrown error means something operational is broken (Supabase down,
    // env misconfigured, Schwab client failed to build with a non-auth
    // error). Do NOT flatten this into { connected: false } — that would
    // silently mask outages as a "please reconnect" state. Return 503 so
    // the client can surface "temporary problem" separately from "not
    // connected".
    console.error("status check failed:", err);
    return NextResponse.json(
      { error: "status_unavailable" },
      { status: 503 },
    );
  }
}
