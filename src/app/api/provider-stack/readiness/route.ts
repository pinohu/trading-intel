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
    note: "Provider readiness reports whether credentials or public fallbacks are available; it does not upgrade public data into licensed execution-grade data.",
  });
}
