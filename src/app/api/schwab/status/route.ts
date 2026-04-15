import { NextResponse } from "next/server";
import { getSchwabClientForRequest } from "@/lib/schwab/client";

export async function GET(req: Request) {
  try {
    const client = await getSchwabClientForRequest(req);
    return NextResponse.json({ connected: client !== null });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
