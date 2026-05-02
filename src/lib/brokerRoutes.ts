import { NextResponse } from "next/server";
import { type BrokerMode, brokerReadiness, parseBrokerMode } from "@/lib/broker";

export function modeFromRequest(request: Request) {
  return parseBrokerMode(new URL(request.url).searchParams.get("mode"));
}

export function safeLimit(value: string | null, fallback = 50, max = 500) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), max));
}

export function cleanSymbols(value: string | null, max = 50) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => /^[A-Z0-9./_-]{1,24}$/.test(symbol)),
    ),
  ).slice(0, max);
}

export function cleanSymbol(value: string | undefined) {
  const clean = value?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9./_-]{1,24}$/.test(clean) ? clean : "";
}

export function passthroughQuery(searchParams: URLSearchParams, omit: string[] = []) {
  const skip = new Set(["mode", ...omit]);
  const params = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (!skip.has(key) && key.length <= 40 && value.length <= 200) {
      params.set(key, value);
    }
  }
  return params.toString();
}

export async function requireBrokerCredentials(mode: BrokerMode) {
  const readiness = await brokerReadiness(mode);
  if (!readiness.credentialsConfigured) {
    return {
      readiness,
      response: NextResponse.json(
        { ok: false, mode, error: `${mode} Alpaca credentials are not configured.`, readiness },
        { status: 503 },
      ),
    };
  }
  return { readiness, response: null };
}

export function brokerUpstreamError(error: unknown, mode: BrokerMode, fallback: string) {
  return NextResponse.json(
    { ok: false, mode, error: error instanceof Error ? error.message : fallback },
    { status: 502 },
  );
}

export function truthyConfirmation(value: unknown, expected: string | undefined | null) {
  return typeof value === "string" && value.trim() === expected;
}
