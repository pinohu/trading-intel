import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, cleanSecret, securityHeaders } from "@/lib/security";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/monitor",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

export function proxy(request: NextRequest) {
  const accessToken = cleanSecret(process.env.TRADING_ACCESS_TOKEN);
  const configuredCode = cleanSecret(process.env.TRADING_ACCESS_CODE);
  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const headers = securityHeaders();

  if (!accessToken || !configuredCode) {
    return NextResponse.json(
      { ok: false, error: "Private access is not configured. Access is closed." },
      { status: 503, headers },
    );
  }

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico";

  if (isPublic) {
    return withSecurityHeaders(NextResponse.next());
  }

  const cookie = request.cookies.get(authCookieName)?.value;
  if (pathname.startsWith("/api/broker/")) {
    if (cookie === accessToken) {
      return withSecurityHeaders(NextResponse.next());
    }
    return NextResponse.json({ ok: false, error: "Broker routes require a user session." }, { status: 401, headers });
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronHeader = request.headers.get("x-cron-secret");
  if (pathname.startsWith("/api/") && cronSecret && (bearer === cronSecret || cronHeader === cronSecret)) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (cookie === accessToken) {
    return withSecurityHeaders(NextResponse.next());
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return withSecurityHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function withSecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}
