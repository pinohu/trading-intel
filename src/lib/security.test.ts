import { describe, expect, it } from "vitest";
import { authCookieName, cleanSecret, hasValidUserSession, rateLimit, securityHeaders } from "@/lib/security";

describe("security helpers", () => {
  it("normalizes copied secrets without accepting empty values", () => {
    expect(cleanSecret('\uFEFF"TI-MPHV10TK67"\n')).toBe("TI-MPHV10TK67");
    expect(cleanSecret("   ")).toBe("");
  });

  it("rate-limits repeated attempts inside the window", () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(rateLimit({ key, limit: 2, windowMs: 1000 }).allowed).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 1000 }).allowed).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 1000 }).allowed).toBe(false);
  });

  it("returns baseline browser security headers", () => {
    const headers = securityHeaders();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("detects valid user sessions from the auth cookie", () => {
    process.env.TRADING_ACCESS_TOKEN = "test-token";
    const request = new Request("https://example.com/api/broker/orders", {
      headers: { cookie: `${authCookieName}=test-token` },
    });

    expect(hasValidUserSession(request)).toBe(true);
    expect(hasValidUserSession(new Request("https://example.com"))).toBe(false);
  });
});
