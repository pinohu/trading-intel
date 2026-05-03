import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const designDoc = readFileSync(new URL("../../DESIGN.md", import.meta.url), "utf8");

const uiSources = [
  ["src/app/page.tsx", readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")],
  ["src/app/login/page.tsx", readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8")],
  ["src/components/PriceChart.tsx", readFileSync(new URL("../components/PriceChart.tsx", import.meta.url), "utf8")],
] as const;

function rootVariables(css: string) {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];
  if (!root) throw new Error("Missing :root design tokens");

  const variables = new Map<string, string>();
  for (const match of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    variables.set(`--${match[1]}`, match[2]);
  }
  return variables;
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const red = channelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const green = channelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const blue = channelToLinear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("accessibility design system", () => {
  it("keeps core color tokens above WCAG contrast thresholds", () => {
    const variables = rootVariables(globalsCss);
    const pairs = [
      ["primary text on app background", "--foreground", "--background", 4.5],
      ["secondary text on app background", "--text-secondary", "--background", 4.5],
      ["muted text on app background", "--text-muted", "--background", 4.5],
      ["muted text on surface", "--text-muted", "--surface", 4.5],
      ["panel border on app background", "--border", "--background", 3],
      ["panel border on surface", "--border", "--surface", 3],
      ["strong border on raised surface", "--border-strong", "--surface-raised", 3],
      ["buy text on buy tint", "--buy", "--buy-soft", 4.5],
      ["sell text on sell tint", "--sell", "--sell-soft", 4.5],
      ["wait text on wait tint", "--wait", "--wait-soft", 4.5],
      ["info text on info tint", "--info", "--info-soft", 4.5],
    ] as const;

    const failures = pairs
      .map(([name, foreground, background, minimum]) => {
        const foregroundValue = variables.get(foreground);
        const backgroundValue = variables.get(background);
        if (!foregroundValue || !backgroundValue) return `${name}: missing ${foreground} or ${background}`;
        const ratio = contrastRatio(foregroundValue, backgroundValue);
        return ratio >= minimum ? null : `${name}: ${ratio.toFixed(2)} below ${minimum}`;
      })
      .filter(Boolean);

    expect(failures).toEqual([]);
  });

  it("keeps global usability guardrails active", () => {
    expect(globalsCss).toContain("min-height: 44px");
    expect(globalsCss).toContain("outline: 3px solid var(--focus-ring)");
    expect(globalsCss).toContain("::placeholder");
    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toContain("@media (prefers-contrast: more)");
    expect(globalsCss).toContain(".disabled\\:opacity-50:disabled");
  });

  it("does not fade or undersize interface text in source components", () => {
    const forbidden = /(disabled:opacity-(?:50|60)|opacity-(?:50|60|70|75|80|90)|text-\[(?:[0-9]|1[01])px\]|tracking-(?:tight|wide|wider|widest))/;
    const offenders: string[] = [];

    for (const [file, source] of uiSources) {
      source.split(/\r?\n/).forEach((line, index) => {
        if (line.includes("animate-ping")) return;
        if (forbidden.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it("documents all Nielsen Norman usability heuristics in the design contract", () => {
    const heuristics = [
      "Visibility of system status",
      "Match with the real world",
      "User control and freedom",
      "Consistency and standards",
      "Error prevention",
      "Recognition rather than recall",
      "Flexibility and efficiency",
      "Aesthetic and minimalist design",
      "Help users recover from errors",
      "Help and documentation",
    ];

    for (const heuristic of heuristics) {
      expect(designDoc).toContain(heuristic);
    }
  });
});
