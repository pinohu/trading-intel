import { NextResponse } from "next/server";
import { calculatePositionSize } from "@/lib/positionSizing";
import { parseNumberParam } from "@/lib/requestGuards";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(
    calculatePositionSize({
      accountSize: parseNumberParam(searchParams.get("accountSize"), 10000, 100, 100000000),
      riskPct: parseNumberParam(searchParams.get("riskPct"), 1, 0, 5),
      entry: parseNumberParam(searchParams.get("entry"), 100, 0.01, 10000000),
      stop: parseNumberParam(searchParams.get("stop"), 98, 0.01, 10000000),
      maxDailyLossPct: parseNumberParam(searchParams.get("maxDailyLossPct"), 3, 0.1, 20),
    }),
  );
}
