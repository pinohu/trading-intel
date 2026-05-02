import { NextResponse } from "next/server";
import { marketEvents } from "@/lib/events";

export function GET() {
  return NextResponse.json({ events: marketEvents });
}
