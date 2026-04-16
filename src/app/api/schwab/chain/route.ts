import { NextResponse } from "next/server";
import { getSchwabClientForRequest } from "@/lib/schwab/client";
import { fetchChainSnapshot } from "@/lib/schwab/chain";
import { computeCandidates } from "@/lib/schwab/compute-candidates";

export async function GET(req: Request) {
  const client = await getSchwabClientForRequest(req);
  if (!client) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const url = new URL(req.url);
  const expiration = url.searchParams.get("expiration");
  const targetRaw = url.searchParams.get("target");
  const target = targetRaw ? Number(targetRaw) : NaN;
  const force = url.searchParams.get("force") === "1";

  if (!expiration || !Number.isFinite(target) || target <= 0 || target > 10_000_000) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  try {
    const snap = await fetchChainSnapshot(client, expiration, { force });
    const result = computeCandidates(snap, target);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("chain fetch failed:", err);
    return NextResponse.json(
      { error: "chain_unavailable" },
      { status: 503 },
    );
  }
}
