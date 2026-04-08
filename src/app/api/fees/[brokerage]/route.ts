import { NextResponse } from "next/server";
import { BROKERAGE_FEES } from "@/lib/constants";
import type { Brokerage } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brokerage: string }> }
) {
  const { brokerage } = await params;

  if (!(brokerage in BROKERAGE_FEES)) {
    return NextResponse.json(
      { error: `Unknown brokerage: ${brokerage}` },
      { status: 400 }
    );
  }

  return NextResponse.json(BROKERAGE_FEES[brokerage as Brokerage]);
}
