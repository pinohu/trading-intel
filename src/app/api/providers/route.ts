import { NextResponse } from "next/server";
import { providerCatalog } from "@/lib/providers";

export function GET() {
  return NextResponse.json({
    providers: providerCatalog,
    note: "Free/no-license feeds are not equivalent to consolidated, execution-grade real-time market data.",
  });
}
