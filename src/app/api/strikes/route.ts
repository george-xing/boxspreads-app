import { NextResponse } from "next/server";
import { selectStrikes, findNearestExpiry } from "@/lib/strikes";
import type { Tenor } from "@/lib/types";
import { TENORS } from "@/lib/constants";

const CURRENT_SPX = 5500;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get("amount"));
  const tenor = searchParams.get("tenor") as Tenor;

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!TENORS.some((t) => t.value === tenor)) {
    return NextResponse.json({ error: "Invalid tenor" }, { status: 400 });
  }

  const contracts = 1;
  const { lower, upper } = selectStrikes(amount, contracts, CURRENT_SPX);
  const expiry = findNearestExpiry(tenor, new Date());
  const width = upper - lower; // actual strike width, not theoretical

  return NextResponse.json({
    lower,
    upper,
    width,
    contracts,
    expiry,
  });
}
