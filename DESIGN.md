---
version: alpha
name: Trading Command Center
description: A dense, risk-first trading intelligence interface for stocks, commodity proxies, and crypto. The product must feel like an operations console, not a marketing page.
colors:
  background: "#080A0D"
  surface: "#0D1117"
  surfaceRaised: "#121820"
  surfaceMuted: "#171F29"
  border: "#27313F"
  borderStrong: "#3B4657"
  textPrimary: "#F5F7FA"
  textSecondary: "#B6C0CC"
  textMuted: "#7B8794"
  buy: "#2DD4A3"
  buySoft: "#11382F"
  sell: "#FF5C7A"
  sellSoft: "#3B1721"
  wait: "#F5B841"
  waitSoft: "#342711"
  info: "#57B7FF"
  infoSoft: "#102A3D"
  proof: "#A7F3D0"
  danger: "#EF4444"
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
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: 0
  mono:
    fontFamily: Geist Mono
    fontSize: 0.8125rem
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

The trust matrix lists platform capability gaps by priority and current status. Critical items should remain visible until implemented.

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
