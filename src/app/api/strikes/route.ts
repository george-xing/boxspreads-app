import { NextResponse } from "next/server";
import { selectStrikes, calcDte } from "@/lib/strikes";

const CURRENT_SPX = 5500;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get("amount"));
  const expiry = searchParams.get("expiry");
  const rawSpot = Number(searchParams.get("spot"));
  const spot =
    rawSpot > 0 && Number.isFinite(rawSpot) ? rawSpot : CURRENT_SPX;

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return NextResponse.json({ error: "Invalid expiry" }, { status: 400 });
  }

  const contracts = 1;
  const { lower, upper } = selectStrikes(amount, contracts, spot);
  const width = upper - lower;
  const dte = calcDte(expiry);

  return NextResponse.json({
    lower,
    upper,
    width,
    contracts,
    expiry,
    dte,
  });
}
