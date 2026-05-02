import { NextResponse } from "next/server";
import { evaluatePreTradeControls, getTradingControlState, setTradingControlState } from "@/lib/executionControl";
import { parseBrokerMode, type ValidatedBrokerOrder } from "@/lib/broker";
import { hasValidUserSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getTradingControlState();
  return NextResponse.json({ ok: true, state });
}

export async function POST(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to update trading controls." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Control payload must be an object." }, { status: 400 });
  }
  const result = await setTradingControlState(body);
  return NextResponse.json({ ok: true, ...result });
}

export async function PUT(request: Request) {
  if (!hasValidUserSession(request)) {
    return NextResponse.json({ ok: false, error: "A user session is required to test trading controls." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Pre-trade payload must be an object." }, { status: 400 });
  }
  const item = body as { mode?: string; order?: unknown };
  const mode = parseBrokerMode(item.mode);
  if (!item.order || typeof item.order !== "object") {
    return NextResponse.json({ ok: false, error: "A validated order object is required." }, { status: 400 });
  }
  const result = await evaluatePreTradeControls({ mode, order: item.order as ValidatedBrokerOrder });
  return NextResponse.json({ ok: result.ok, result });
}
