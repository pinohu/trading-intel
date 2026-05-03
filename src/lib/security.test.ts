import { describe, expect, it } from "vitest";
import {
  authCookieName,
  cleanSecret,
  configuredAccessCode,
  hasValidUserSession,
  productionSecretsConfigured,
  rateLimit,
  securityHeaders,
} from "@/lib/security";

describe("security helpers", () => {
  it("normalizes copied secrets without accepting empty values", () => {
    expect(cleanSecret('\uFEFF"TI-MPHV10TK67"\n')).toBe("TI-MPHV10TK67");
    expect(cleanSecret("   ")).toBe("");
  });

  it("accepts ACCESS_CODE and falls back to TRADING_ACCESS_CODE", () => {
    const previousAccessCode = process.env.ACCESS_CODE;
    const previousTradingAccessCode = process.env.TRADING_ACCESS_CODE;
    const previousToken = process.env.TRADING_ACCESS_TOKEN;
    const restoreEnv = (key: "ACCESS_CODE" | "TRADING_ACCESS_CODE" | "TRADING_ACCESS_TOKEN", value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }
      process.env[key] = value;
    };

    process.env.ACCESS_CODE = "new-code";
    process.env.TRADING_ACCESS_CODE = "old-code";
    process.env.TRADING_ACCESS_TOKEN = "session-token";

    expect(configuredAccessCode()).toBe("new-code");
    expect(productionSecretsConfigured()).toBe(true);

    process.env.ACCESS_CODE = "";
    expect(configuredAccessCode()).toBe("old-code");

    restoreEnv("ACCESS_CODE", previousAccessCode);
    restoreEnv("TRADING_ACCESS_CODE", previousTradingAccessCode);
    restoreEnv("TRADING_ACCESS_TOKEN", previousToken);
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
