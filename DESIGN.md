---
version: alpha
name: Trading Command Center
description: A dense, risk-first trading intelligence interface for stocks, commodity proxies, and crypto. The product must feel like an operations console, not a marketing page.
colors:
  background: "#080A0D"
  surface: "#0D1117"
  surfaceRaised: "#121923"
  surfaceMuted: "#1A2431"
  border: "#5D6B7F"
  borderStrong: "#8A98AD"
  textPrimary: "#F8FAFC"
  textSecondary: "#DBE4EF"
  textMuted: "#C1CCDA"
  buy: "#6EE7B7"
  buySoft: "#062D25"
  sell: "#FF9AAA"
  sellSoft: "#34111A"
  wait: "#FFD166"
  waitSoft: "#302407"
  info: "#8BD6FF"
  infoSoft: "#07283A"
  proof: "#A7F3D0"
  danger: "#FF9AAA"
typography:
  h1:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: 0
  h2:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: 0
  body:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: 0
  mono:
    fontFamily: Geist Mono
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
rounded:
  sm: 3px
  md: 6px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.textPrimary}"
    rounded: "{rounded.lg}"
    padding: 16px
  tile:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.textPrimary}"
    rounded: "{rounded.md}"
    padding: 12px
  buy-badge:
    backgroundColor: "{colors.buy}"
    textColor: "#03130E"
    rounded: "{rounded.sm}"
    padding: 6px
  sell-badge:
    backgroundColor: "{colors.sell}"
    textColor: "#170307"
    rounded: "{rounded.sm}"
    padding: 6px
  wait-badge:
    backgroundColor: "{colors.waitSoft}"
    textColor: "{colors.wait}"
    rounded: "{rounded.sm}"
    padding: 6px
---

## Overview

Trading Command Center is a high-density operations interface. It should help a user answer, in order:

1. Is the data trustworthy enough?
2. What needs attention now?
3. What is the exact trade plan?
4. What proof exists that this signal has worked before?
5. What risk prevents action?

The UI must avoid decorative dashboards. Every panel must either reduce uncertainty, expose risk, or turn a signal into a written plan.

## Colors

Green only means a buy candidate or confirmed positive condition. Red only means sell, exit, avoid, or risk breach. Amber means wait, stale, unproven, or blocked. Blue means context or neutral system information.

Never use green to mean "successfully loaded" when the content is not trade-positive. Never use red for generic emphasis.

## Typography

Use Geist Sans for interface text and Geist Mono for prices, timestamps, symbols, ratios, and IDs. Keep headings compact. Use tabular-looking numbers wherever scan speed matters.

Hero-scale typography is not appropriate inside trading tools. The dashboard is a work surface, not a landing page.

## Accessibility And Usability

Every foreground/background pair in the core palette must meet WCAG AA for normal text at 4.5:1 or better; borders and non-text controls must meet at least 3:1 against adjacent surfaces. Muted copy is still copy, so it must remain readable instead of becoming decorative gray.

Interactive targets must be at least 44px high, have visible focus outlines, and never rely on color alone. Disabled controls should remain legible and explain the blocked state through nearby copy, status text, or button labels.

Do not reduce text contrast with opacity utilities. Do not use sub-12px labels. Letter spacing stays at 0 for interface text, including uppercase badges.

Nielsen Norman heuristics are part of the design contract:

- Visibility of system status: live feed age, broker readiness, stale data, and orchestration state stay visible.
- Match with the real world: use trading language users already know, such as trigger, stop, target, reward/risk, and position size.
- User control and freedom: provide clear refresh, import, export, clear chat, skip navigation, and manual execution gates.
- Consistency and standards: reuse panels, stats, badges, color semantics, and action names.
- Error prevention: keep locked broker state, stale data, and incomplete tickets visibly blocked before action.
- Recognition rather than recall: keep help text, labels, reasons, and reference report lessons close to the controls they explain.
- Flexibility and efficiency: support jump nav, quick chat questions, watchlist entry, polling controls, and export/import.
- Aesthetic and minimalist design: dense information is allowed only when each element reduces uncertainty or exposes risk.
- Help users recover from errors: errors must be plain-English, visible, and paired with retry or next-action context.
- Help and documentation: source explanations, report lessons, and stat/tooltips must be maintained with each UI change.

## Layout & Spacing

Use a dense 12px/16px spacing rhythm. Prefer tables, rows, and compact tiles over large cards. Keep primary decision panels above the fold:

- Live tape
- Trust/readiness strip
- Buy leads
- Sell/avoid
- Trade ticket
- Proof status

Desktop layout should use a wide main column and a narrower operations sidebar. Mobile layout should stack the same priority order.

## Components

### Live Ticker

Ticker rows show symbol, action badge, price, percent move, feed quality, and freshness. It must be obvious when data is stale.

### Trade Ticket

Trade tickets show entry trigger, stop, target, position size, maximum loss, reward/risk, and do-not-trade checklist. A ticket is incomplete if any of those are missing.

### Trust Matrix

The trust matrix lists platform trust capabilities by priority, current status, evidence standard, acceptance criteria, and remaining fix. It must not call a live capability "missing." Critical unresolved items should remain visible until implemented or proven with durable outcomes after slippage, fees, and different market conditions.

### Signal Rows

Signal rows should be comparable. Avoid forcing users to read long prose before seeing action, trigger, stop, target, quality, and data freshness.

## Do's and Don'ts

Do:

- Show proof status beside each major trading feature.
- Keep warnings visible and plain-English.
- Make stale data look blocked, not merely lower confidence.
- Use consistent action language: BUY WATCH, BUY LEAD, SELL / AVOID, HOLD, WAIT - STALE.
- Keep risk numbers near action labels.

Do not:

- Promise accuracy, certainty, or profits.
- Hide public/unofficial data limitations.
- Use decorative gradients, blobs, oversized hero art, or marketing copy.
- Put cards inside cards when a row/table would scan better.
- Let different agents invent new colors or spacing without updating this file.

## Agent Instructions

Codex, Claude Code, Cursor, OpenClaw, Hermes, and other agents must read this file before changing UI. When adding a component, map it to this design system or update this file first. If a requested design conflicts with risk clarity, risk clarity wins.
