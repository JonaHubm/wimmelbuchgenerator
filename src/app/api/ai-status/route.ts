import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  AI_USAGE_COOKIE_NAME,
  getPublicAiStatus,
  readAiUsage,
  verifyAccessToken,
} from "@/lib/access-control";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const hasAccess = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE_NAME)?.value);

  if (!hasAccess) {
    return NextResponse.json({ error: "Private test access is required." }, { status: 401 });
  }

  const sessionUsed = await readAiUsage(request.cookies.get(AI_USAGE_COOKIE_NAME)?.value);

  return NextResponse.json(getPublicAiStatus(sessionUsed));
}
