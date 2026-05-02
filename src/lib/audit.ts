import { databaseConfigured, getSql } from "@/lib/db";

type AuditMetadata = Record<string, boolean | number | string | null | undefined>;

export async function recordAuditEvent(eventType: string, actorId: string | null, metadata: AuditMetadata = {}) {
  if (!databaseConfigured()) return;

  try {
    const sql = getSql();
    await sql`
      insert into audit_events (event_type, actor_id, metadata)
      values (${eventType}, ${actorId}, ${JSON.stringify(metadata)}::jsonb)
    `;
  } catch {
    // Audit logging must never fail open into a user-facing outage.
  }
}
