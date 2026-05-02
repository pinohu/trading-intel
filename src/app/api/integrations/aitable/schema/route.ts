import { NextResponse } from "next/server";
import { aitableReadiness, aitableSchema } from "@/lib/aitable";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    readiness: aitableReadiness(),
    schema: Object.fromEntries(
      Object.entries(aitableSchema).map(([key, value]) => [
        key,
        {
          env: value.env,
          name: value.name,
          description: value.description,
          fields: value.fields,
        },
      ]),
    ),
  });
}
