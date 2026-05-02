import { NextResponse } from "next/server";
import { databaseSchemaStatus } from "@/lib/db";
import { quoteCacheStats } from "@/lib/providerCache";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseSchemaStatus();
  return NextResponse.json({
    ok: true,
    databaseConfigured: database.configured,
    databaseReachable: database.reachable,
    schemaReady: database.schemaReady,
    persistenceEnabled: database.schemaReady,
    quoteCache: quoteCacheStats(),
    requiredSchema: "database/schema.sql",
    missingIfDisabled: database.schemaReady
      ? []
      : [
          !database.configured ? "DATABASE_URL" : "",
          database.configured && !database.reachable ? "reachable database connection" : "",
          database.reachable && !database.schemaReady ? "database/schema.sql not applied" : "",
        ].filter(Boolean),
    error: database.error,
  });
}
