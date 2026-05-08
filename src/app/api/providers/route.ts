import { NextResponse } from "next/server";
import { providerCatalog } from "@/lib/providers";

export function GET() {
  return NextResponse.json({
    providers: providerCatalog,
    defaultProvider: "auto/free-first",
    note: "The default provider path avoids paid keys first. Free/no-license feeds are still not equivalent to consolidated, execution-grade real-time market data.",
  });
}
