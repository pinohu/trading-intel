# Security Model

## Current Controls

- Private access gate is fail-closed when auth secrets are missing.
- Login route rate-limits repeated attempts per observed IP.
- Session cookie is HTTP-only and `SameSite=Strict`.
- Middleware adds baseline browser security headers.
- API query parameters are sanitized and clamped.
- Cron monitor requires `CRON_SECRET` through `Authorization`, `x-cron-secret`, or a manual `secret` query parameter.
- Login success/failure/rate-limit events and persistence creation events are written to `audit_events` when `DATABASE_URL` is configured.
- `/api/broker/*` routes require a browser user session and do not accept cron/bearer automation.
- Live broker orders require database-backed broker-order audit storage before submission.

## Known Limitations

- Shared access-code auth is not suitable for a paid SaaS or multi-user trading product.
- In-memory rate limiting is best-effort on serverless and must be replaced with Redis/KV for scale.
- There is no per-user authorization model yet.
- Audit events are database-backed but not yet immutable, exportable, or tied to per-user identities.
- Broker execution uses shared-app auth until a real auth provider and RBAC are added.
- There is no MFA yet.

## Required Before Public Launch

- Replace shared-code auth with Clerk, Auth0, Supabase Auth, or equivalent.
- Add MFA for admin/operator accounts.
- Add RBAC: owner, admin, analyst, read-only.
- Add distributed rate limits with Upstash Redis or Vercel KV.
- Add immutable audit retention, export, and alerting for logins, signal generation, ticket creation, alert delivery, and broker sync.
- Add CSP tuning after bundle/script requirements are stable.
- Add Terms, Privacy, and trading-risk disclosures.

## Secret Handling

Required production secrets:

- `TRADING_ACCESS_CODE`
- `TRADING_ACCESS_TOKEN`
- `CRON_SECRET`

Optional integration secrets:

- Market data provider keys.
- Alert provider keys.
- Broker read-only keys.
- Database URL.

Never commit real secrets to the repository.
