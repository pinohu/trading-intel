import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { databaseConfigured } from "@/lib/db";
import { consumePersistentRateLimit } from "@/lib/persistence";
import { authCookieName, cleanSecret, clientIp, configuredAccessCode, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuredCode = configuredAccessCode();
  const sessionToken = cleanSecret(process.env.TRADING_ACCESS_TOKEN);
  const actor = clientIp(request);

  if (!configuredCode || !sessionToken) {
    return NextResponse.json(
      { ok: false, error: "Authentication is not configured. Production access is closed." },
      { status: 503 },
    );
  }

  const limit = await loginRateLimit(`login:${clientIp(request)}`);
  if (!limit.allowed) {
    await recordAuditEvent("login.rate_limited", actor, { route: "/api/auth/login" });
    return NextResponse.json(
      { ok: false, error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = cleanSecret(body?.code);

  if (!code || code !== configuredCode) {
    await recordAuditEvent("login.failure", actor, { route: "/api/auth/login" });
    return NextResponse.json({ ok: false, error: "Invalid access code" }, { status: 401 });
  }

  await recordAuditEvent("login.success", actor, { route: "/api/auth/login" });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

async function loginRateLimit(key: string) {
  const options = {
    key,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  };
  if (!databaseConfigured()) return rateLimit(options);
  try {
    return await consumePersistentRateLimit(options);
  } catch {
    return rateLimit(options);
  }
}
