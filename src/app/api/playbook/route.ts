import { NextResponse } from "next/server";
import { dayTradingBestPractices, dayTradingRules } from "@/lib/dayTradingPlaybook";

export function GET() {
  return NextResponse.json({
    rules: dayTradingRules,
    bestPractices: dayTradingBestPractices,
    disclaimer:
      "Rule-based trading research only. No strategy can guarantee high accuracy, and this app does not place live trades.",
  });
}
