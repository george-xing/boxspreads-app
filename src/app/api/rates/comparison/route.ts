import { NextResponse } from "next/server";
import { COMPARISON_RATES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json(COMPARISON_RATES, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
