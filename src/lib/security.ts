export const authCookieName = "trade_auth";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export function cleanSecret(value: string | undefined | null) {
  return value?.replace(/^\uFEFF/, "").trim().replace(/^["']|["']$/g, "");
}

export function configuredAccessCode() {
  return cleanSecret(process.env.ACCESS_CODE) || cleanSecret(process.env.TRADING_ACCESS_CODE);
}

export function productionSecretsConfigured() {
  return Boolean(configuredAccessCode() && cleanSecret(process.env.TRADING_ACCESS_TOKEN));
}

export function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown";
}

export function hasValidUserSession(request: Request) {
  const token = cleanSecret(process.env.TRADING_ACCESS_TOKEN);
  if (!token) return false;

  const cookies = request.headers.get("cookie") ?? "";
  return cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .some((cookie) => {
      const [name, ...valueParts] = cookie.split("=");
      return name === authCookieName && decodeURIComponent(valueParts.join("=")) === token;
    });
}

export function securityHeaders() {
  const production = process.env.NODE_ENV === "production";
  return {
    "content-security-policy": [
      "default-src 'self'",
      production ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self' wss://stream.data.alpaca.markets wss://api.alpaca.markets wss://paper-api.alpaca.markets",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-permitted-cross-domain-policies": "none",
  };
}
