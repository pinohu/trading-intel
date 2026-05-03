import { NextResponse } from "next/server";
import { providerCatalog } from "@/lib/providers";
import { buildResearchStackReadiness } from "@/lib/researchStack";

export const dynamic = "force-dynamic";

export function GET() {
  const stack = buildResearchStackReadiness();
  return NextResponse.json({
    ok: true,
    grade: stack.grade,
    marketData: providerCatalog,
    structuredNews: stack.components.filter((component) => component.category === "news"),
    filings: stack.components.filter((component) => component.category === "filings"),
    database: stack.components.filter((component) => component.category === "database"),
    freeReplacements: stack.freeReplacements,
    note: "Provider readiness is free-first by default; public data remains research-only unless a licensed execution-grade provider confirms it.",
  });
}
