import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/security";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(authCookieName);
  return response;
}
